//! YouTube traffic from Russia (port of the Android `YouTubeHttp`).
//!
//! Operator DNS returns nothing for YouTube hosts and DPI drops TLS sessions whose
//! ClientHello names them. Every YouTube request (RustyPipe, stream resolution, audio,
//! covers) goes through a loopback CONNECT proxy that resolves those hosts over HTTPS
//! and cuts the ClientHello inside every SNI label into separate TLS records, sending
//! the first one with TTL=1 so the filter sees the pieces out of order. The proxy
//! only relays bytes: certificates are still verified end to end by the client.
//!
//! Some ISPs serve googlevideo only from in-network caches that no ClientHello trick
//! gets through, so YouTube connections go through a TCP tunnel on the Whithin server
//! first (`/api/yt-tunnel`, an HTTP/1.1 upgrade over TLS to whithin.ru). Everything
//! then leaves from the server's IP, which keeps stream URLs and downloads consistent.
//! The local tricks are the fallback while the server is unreachable.

use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::net::{IpAddr, Ipv4Addr, Shutdown, SocketAddr, TcpListener, TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use tokio::io::{AsyncReadExt, AsyncWriteExt};

const YOUTUBE_DOMAINS: &[&str] = &[
    "youtube.com",
    "googlevideo.com",
    "ytimg.com",
    "ggpht.com",
    "googleusercontent.com",
    "youtube-nocookie.com",
    "youtu.be",
    "youtubei.googleapis.com",
];

const DOH_ENDPOINTS: &[&str] = &[
    "https://1.1.1.1/dns-query",
    "https://1.0.0.1/dns-query",
    "https://8.8.8.8/resolve",
    "https://8.8.4.4/resolve",
];

const DNS_TTL: Duration = Duration::from_secs(10 * 60);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(15);
const MAX_HEAD: usize = 8 * 1024;

/// stderr plus `%TEMP%\whithin-music.log` (the audio host runs detached, without a console).
pub fn log(line: &str) {
    eprintln!("{line}");
    let path = std::env::temp_dir().join("whithin-music.log");
    if std::fs::metadata(&path).is_ok_and(|m| m.len() > 1024 * 1024) {
        let _ = std::fs::remove_file(&path);
    }
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        let _ = writeln!(file, "{now} [{}] {line}", std::process::id());
    }
}

pub fn is_youtube_host(host: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    YOUTUBE_DOMAINS
        .iter()
        .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
}

/// `http://127.0.0.1:<port>` of this process's proxy (started on first use).
pub fn proxy_url() -> Option<String> {
    static PROXY: OnceLock<Option<String>> = OnceLock::new();
    PROXY
        .get_or_init(|| match start_proxy() {
            Ok(url) => Some(url),
            Err(e) => {
                log(&format!("[yt-net] proxy unavailable, direct connections: {e}"));
                None
            }
        })
        .clone()
}

pub fn reqwest_proxy() -> Option<reqwest::Proxy> {
    reqwest::Proxy::https(proxy_url()?).ok()
}

pub fn ureq_proxy() -> Option<ureq::Proxy> {
    ureq::Proxy::new(proxy_url()?).ok()
}

/// Other googlevideo servers that accept the URL's signature: the `mn` cluster nodes and
/// neighbouring `rrN` servers in them. Servers that worked before come first, dead ones are left out.
pub fn alternate_hosts(url: &str) -> Vec<String> {
    let Ok(parsed) = url::Url::parse(url) else { return Vec::new() };
    let Some(host) = parsed.host_str() else { return Vec::new() };
    if !host.ends_with(".googlevideo.com") {
        return Vec::new();
    }
    let param = |name: &str| parsed.query_pairs().find(|(k, _)| k == name).map(|(_, v)| v.into_owned());
    let (current_rr, current_node) = host
        .trim_end_matches(".googlevideo.com")
        .trim_start_matches("rr")
        .split_once("---")
        .map(|(rr, node)| (rr.to_string(), node.to_string()))
        .unwrap_or_default();
    let fvip = param("fvip").unwrap_or(current_rr);
    let mut nodes = vec![current_node];
    for node in param("mn").unwrap_or_default().split(',').filter(|n| !n.is_empty()) {
        if !nodes.iter().any(|n| n == node) {
            nodes.push(node.to_string());
        }
    }
    let mut hosts: Vec<String> = Vec::new();
    let mut push = |candidate: String| {
        if candidate != host && !hosts.contains(&candidate) && !is_dead(&candidate) {
            hosts.push(candidate);
        }
    };
    for node in nodes.iter().filter(|n| !n.is_empty()) {
        push(format!("rr{fvip}---{node}.googlevideo.com"));
    }
    for rr in 1..=8 {
        for node in nodes.iter().filter(|n| !n.is_empty()) {
            push(format!("rr{rr}---{node}.googlevideo.com"));
        }
    }
    let health = health().lock().unwrap();
    hosts.sort_by_key(|h| !health.alive.contains(h));
    hosts
}

#[derive(Default)]
struct Health {
    alive: std::collections::HashSet<String>,
    dead: HashMap<String, Instant>,
}

fn health() -> &'static Mutex<Health> {
    static HEALTH: OnceLock<Mutex<Health>> = OnceLock::new();
    HEALTH.get_or_init(Default::default)
}

const DEAD_FOR: Duration = Duration::from_secs(15 * 60);

pub fn mark_alive(host: &str) {
    let mut health = health().lock().unwrap();
    health.dead.remove(host);
    health.alive.insert(host.to_string());
}

pub fn mark_dead(host: &str) {
    let mut health = health().lock().unwrap();
    health.alive.remove(host);
    health.dead.insert(host.to_string(), Instant::now());
}

pub fn is_dead(host: &str) -> bool {
    health().lock().unwrap().dead.get(host).is_some_and(|at| at.elapsed() < DEAD_FOR)
}

/// `url` with its host replaced.
pub fn with_host(url: &str, host: &str) -> Option<String> {
    let mut parsed = url::Url::parse(url).ok()?;
    parsed.set_host(Some(host)).ok()?;
    Some(parsed.into())
}

// ---------- DNS over HTTPS ----------

fn dns_cache() -> &'static Mutex<HashMap<String, (Vec<IpAddr>, Instant)>> {
    static CACHE: OnceLock<Mutex<HashMap<String, (Vec<IpAddr>, Instant)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn doh_lookup(host: &str) -> Option<Vec<IpAddr>> {
    if let Some((ips, at)) = dns_cache().lock().unwrap().get(host) {
        if at.elapsed() < DNS_TTL {
            return Some(ips.clone());
        }
    }
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    let agent = AGENT.get_or_init(|| {
        ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(4))
            .timeout(Duration::from_secs(6))
            .build()
    });
    for endpoint in DOH_ENDPOINTS {
        let response = agent
            .get(endpoint)
            .query("name", host)
            .query("type", "A")
            .set("Accept", "application/dns-json")
            .call();
        let Ok(response) = response else { continue };
        let Ok(json) = serde_json::from_reader::<_, serde_json::Value>(response.into_reader()) else { continue };
        let ips: Vec<IpAddr> = json["Answer"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|answer| answer["type"].as_u64() == Some(1))
            .filter_map(|answer| answer["data"].as_str()?.parse::<Ipv4Addr>().ok())
            .map(IpAddr::V4)
            .collect();
        if !ips.is_empty() {
            dns_cache().lock().unwrap().insert(host.to_string(), (ips.clone(), Instant::now()));
            return Some(ips);
        }
    }
    None
}

fn resolve(host: &str, port: u16) -> io::Result<Vec<SocketAddr>> {
    if let Ok(ip) = host.trim_matches(['[', ']']).parse::<IpAddr>() {
        return Ok(vec![SocketAddr::new(ip, port)]);
    }
    if is_youtube_host(host) {
        if let Some(ips) = doh_lookup(host) {
            return Ok(ips.into_iter().map(|ip| SocketAddr::new(ip, port)).collect());
        }
        log(&format!("[yt-net] DoH failed for {host}, using system DNS"));
    }
    Ok((host, port).to_socket_addrs()?.collect())
}

// ---------- CONNECT proxy ----------

fn strategy_file() -> std::path::PathBuf {
    std::env::temp_dir().join("whithin-yt-strategy")
}

/// The working strategy is shared by the app and the audio host and survives restarts, so a new
/// session doesn't re-probe before its first track.
fn save_strategy(index: usize) {
    let _ = std::fs::write(strategy_file(), STRATEGIES[index].name);
}

fn load_strategy() -> Option<usize> {
    let name = std::fs::read_to_string(strategy_file()).ok()?;
    STRATEGIES.iter().position(|s| s.name == name.trim())
}

fn start_proxy() -> io::Result<String> {
    let initial = std::env::var("WHITHIN_YT_STRATEGY")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .map(|s| s % STRATEGIES.len())
        .or_else(load_strategy);
    if let Some(strategy) = initial {
        STRATEGY.store(strategy, Ordering::Relaxed);
    }
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
    let url = format!("http://127.0.0.1:{}", listener.local_addr()?.port());
    std::thread::Builder::new().name("yt-proxy".into()).spawn(move || {
        for client in listener.incoming().flatten() {
            let _ = std::thread::Builder::new().name("yt-proxy-conn".into()).spawn(move || {
                if let Err(e) = handle(client) {
                    if e.kind() != io::ErrorKind::ConnectionReset && e.kind() != io::ErrorKind::ConnectionAborted {
                        log(&format!("[yt-net] {e}"));
                    }
                }
            });
        }
    })?;
    Ok(url)
}

fn read_head(client: &mut TcpStream) -> io::Result<String> {
    let mut head = Vec::with_capacity(256);
    let mut byte = [0u8; 1];
    while !head.ends_with(b"\r\n\r\n") {
        if head.len() >= MAX_HEAD || client.read(&mut byte)? == 0 {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "bad proxy request"));
        }
        head.push(byte[0]);
    }
    Ok(String::from_utf8_lossy(&head).into_owned())
}

fn handle(mut client: TcpStream) -> io::Result<()> {
    client.set_read_timeout(Some(HANDSHAKE_TIMEOUT))?;
    let head = read_head(&mut client)?;
    let mut words = head.lines().next().unwrap_or_default().split_whitespace();
    let (method, target) = (words.next().unwrap_or_default(), words.next().unwrap_or_default());
    if !method.eq_ignore_ascii_case("CONNECT") {
        client.write_all(b"HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n")?;
        return Ok(());
    }
    let (host, port) = match target.rsplit_once(':') {
        Some((host, port)) => (host, port.parse().unwrap_or(443)),
        None => (target, 443),
    };
    if port == 443 && is_youtube_host(host) && tunnel_usable() && via_server(&mut client, host)? {
        return Ok(());
    }
    let upstream = match connect(host, port) {
        Ok(stream) => stream,
        Err(e) => {
            let _ = client.write_all(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n");
            return Err(io::Error::new(e.kind(), format!("{host}: {e}")));
        }
    };
    client.write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")?;
    if !is_youtube_host(host) {
        return relay(client, upstream);
    }
    let hello = read_client_hello(&mut client)?;
    if hello.is_empty() {
        return Ok(());
    }
    let pinned = STRATEGY.load(Ordering::Relaxed);
    // Try the strategy that worked last first; it usually succeeds and skips the probing cost.
    let order = std::iter::once(pinned).chain((0..STRATEGIES.len()).filter(move |&i| i != pinned));
    let mut upstream = Some(upstream);
    let mut reachable = false;
    for strategy in order {
        let stream = match upstream.take() {
            Some(stream) => stream,
            None => match connect(host, port) {
                Ok(stream) => stream,
                Err(e) => {
                    mark_dead(host);
                    return Err(io::Error::new(e.kind(), format!("{host}: {e}")));
                }
            },
        };
        let started = Instant::now();
        match handshake(&stream, &hello, STRATEGIES[strategy]) {
            Ok(reply) => {
                if strategy != pinned {
                    STRATEGY.store(strategy, Ordering::Relaxed);
                    save_strategy(strategy);
                    log(&format!("[yt-net] {host}: strategy «{}» works", STRATEGIES[strategy].name));
                }
                mark_alive(host);
                client.write_all(&reply)?;
                return relay(client, stream);
            }
            Err(e) => {
                // A reset means the server answered and DPI cut it: the host is reachable, keep probing.
                reachable |= e.kind() == io::ErrorKind::ConnectionReset;
                log(&format!(
                    "[yt-net] {host}: «{}» failed after {:?}: {}",
                    STRATEGIES[strategy].name,
                    started.elapsed(),
                    e.kind()
                ));
            }
        }
    }
    if !reachable {
        mark_dead(host);
    }
    Err(io::Error::new(io::ErrorKind::ConnectionAborted, format!("{host}: every strategy failed")))
}

// ---------- server tunnel ----------

const TUNNEL_HOST: &str = "whithin.ru";
const TUNNEL_PROTOCOL: &str = "whithin-yt-tunnel";
const TUNNEL_TIMEOUT: Duration = Duration::from_secs(10);
/// After a failed tunnel, connections go direct for a while instead of waiting on the server each time.
const TUNNEL_RETRY_AFTER: Duration = Duration::from_secs(60);

fn tunnel_down_since() -> &'static Mutex<Option<Instant>> {
    static DOWN: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();
    DOWN.get_or_init(Default::default)
}

fn tunnel_usable() -> bool {
    if std::env::var("WHITHIN_YT_TUNNEL").is_ok_and(|v| v == "0") {
        return false;
    }
    !tunnel_down_since().lock().unwrap().is_some_and(|at| at.elapsed() < TUNNEL_RETRY_AFTER)
}

fn tls_connector() -> tokio_rustls::TlsConnector {
    static CONFIG: OnceLock<Arc<tokio_rustls::rustls::ClientConfig>> = OnceLock::new();
    let config = CONFIG.get_or_init(|| {
        use tokio_rustls::rustls;
        let mut roots = rustls::RootCertStore::empty();
        roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        let mut config = rustls::ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_safe_default_protocol_versions()
            .expect("ring supports the default TLS versions")
            .with_root_certificates(roots)
            .with_no_client_auth();
        // nginx would pick HTTP/2, which has no Upgrade.
        config.alpn_protocols = vec![b"http/1.1".to_vec()];
        Arc::new(config)
    });
    tokio_rustls::TlsConnector::from(config.clone())
}

async fn open_tunnel(host: &str) -> io::Result<tokio_rustls::client::TlsStream<tokio::net::TcpStream>> {
    let tcp = tokio::net::TcpStream::connect((TUNNEL_HOST, 443)).await?;
    tcp.set_nodelay(true)?;
    let name = tokio_rustls::rustls::pki_types::ServerName::try_from(TUNNEL_HOST).expect("valid host name");
    let mut tls = tls_connector().connect(name, tcp).await?;
    let request = format!(
        "GET /api/yt-tunnel?host={host} HTTP/1.1\r\nHost: {TUNNEL_HOST}\r\nConnection: Upgrade\r\nUpgrade: {TUNNEL_PROTOCOL}\r\n\r\n"
    );
    tls.write_all(request.as_bytes()).await?;
    let mut head = Vec::with_capacity(256);
    let mut byte = [0u8; 1];
    while !head.ends_with(b"\r\n\r\n") {
        if head.len() >= MAX_HEAD || tls.read(&mut byte).await? == 0 {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "tunnel closed before reply"));
        }
        head.push(byte[0]);
    }
    let head = String::from_utf8_lossy(&head);
    let status_line = head.lines().next().unwrap_or_default();
    if status_line.split_whitespace().nth(1) != Some("101") {
        return Err(io::Error::new(io::ErrorKind::ConnectionRefused, format!("tunnel: {status_line}")));
    }
    Ok(tls)
}

/// Relays the CONNECT through the server tunnel; false (nothing sent to the client yet) when the
/// tunnel can't be opened and the caller should connect directly.
fn via_server(client: &mut TcpStream, host: &str) -> io::Result<bool> {
    if !host.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-') {
        return Ok(false);
    }
    let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build()?;
    runtime.block_on(async {
        let started = Instant::now();
        let mut upstream = match tokio::time::timeout(TUNNEL_TIMEOUT, open_tunnel(host)).await {
            Ok(Ok(stream)) => stream,
            result => {
                let error = match result {
                    Ok(Err(e)) => e.to_string(),
                    _ => "timed out".to_string(),
                };
                log(&format!("[yt-net] {host}: server tunnel failed after {:?}: {error}; going direct", started.elapsed()));
                *tunnel_down_since().lock().unwrap() = Some(Instant::now());
                return Ok(false);
            }
        };
        if tunnel_down_since().lock().unwrap().take().is_some() {
            log("[yt-net] server tunnel is back");
        }
        client.write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")?;
        client.set_read_timeout(None)?;
        client.set_nonblocking(true)?;
        let mut local = tokio::net::TcpStream::from_std(client.try_clone()?)?;
        let _ = tokio::io::copy_bidirectional(&mut local, &mut upstream).await;
        Ok(true)
    })
}

#[derive(Clone, Copy)]
enum Split {
    None,
    Labels,
    Fine,
}

/// One way to slip the ClientHello past DPI. `ttl` sends the first fragment with a low hop limit so
/// it dies past the DPI but before the server, which then sees the fragments reordered; 0 leaves TTL
/// alone. The right TTL depends on how many hops away the DPI sits, so several values are tried.
#[derive(Clone, Copy)]
struct Strategy {
    name: &'static str,
    split: Split,
    ttl: u8,
    oob: bool,
}

const fn s(name: &'static str, split: Split, ttl: u8, oob: bool) -> Strategy {
    Strategy { name, split, ttl, oob }
}

const STRATEGIES: &[Strategy] = &[
    s("labels ttl3", Split::Labels, 3, false),
    s("labels ttl4", Split::Labels, 4, false),
    s("labels ttl2", Split::Labels, 2, false),
    s("labels ttl5", Split::Labels, 5, false),
    s("labels ttl6", Split::Labels, 6, false),
    s("labels ttl8", Split::Labels, 8, false),
    s("labels ttl1", Split::Labels, 1, false),
    s("labels oob ttl3", Split::Labels, 3, true),
    s("fine ttl4", Split::Fine, 4, false),
    s("labels", Split::Labels, 0, false),
    s("oob", Split::Labels, 0, true),
    s("plain", Split::None, 0, false),
];
static STRATEGY: AtomicUsize = AtomicUsize::new(0);
const FIRST_REPLY_TIMEOUT: Duration = Duration::from_secs(3);

/// Sends the ClientHello with `strategy`; the server's first bytes on success.
fn handshake(upstream: &TcpStream, hello: &[u8], strategy: Strategy) -> io::Result<Vec<u8>> {
    send_client_hello(upstream, hello, strategy)?;
    upstream.set_read_timeout(Some(FIRST_REPLY_TIMEOUT))?;
    let mut buf = vec![0u8; 16 * 1024];
    let n = (&mut &*upstream).read(&mut buf)?;
    upstream.set_read_timeout(None)?;
    if n == 0 {
        return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "closed before ServerHello"));
    }
    buf.truncate(n);
    Ok(buf)
}

fn connect(host: &str, port: u16) -> io::Result<TcpStream> {
    let mut last = io::Error::new(io::ErrorKind::NotFound, "no address");
    for addr in resolve(host, port)?.into_iter().take(4) {
        match TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT) {
            Ok(stream) => {
                stream.set_nodelay(true)?;
                if host.ends_with("googlevideo.com") {
                    log(&format!("[yt-net] {host} -> {addr}"));
                }
                return Ok(stream);
            }
            Err(e) => {
                log(&format!("[yt-net] {host} -> {addr}: {e}"));
                last = e;
            }
        }
    }
    Err(last)
}

fn relay(client: TcpStream, upstream: TcpStream) -> io::Result<()> {
    client.set_read_timeout(None)?;
    let (mut from_server, mut to_client) = (upstream.try_clone()?, client.try_clone()?);
    let downstream = std::thread::spawn(move || {
        let _ = io::copy(&mut from_server, &mut to_client);
        let _ = to_client.shutdown(Shutdown::Write);
    });
    let result = io::copy(&mut &client, &mut &upstream);
    let _ = upstream.shutdown(Shutdown::Write);
    let _ = downstream.join();
    result.map(|_| ())
}

/// Everything the client sent up to the end of its first TLS record.
fn read_client_hello(client: &mut TcpStream) -> io::Result<Vec<u8>> {
    let mut buf = Vec::with_capacity(2048);
    let mut chunk = [0u8; 4096];
    loop {
        let n = client.read(&mut chunk)?;
        if n == 0 {
            return Ok(buf);
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf[0] != 0x16 || (buf.len() >= 5 && buf.len() >= 5 + u16_at(&buf, 3)) {
            return Ok(buf);
        }
    }
}

fn send_client_hello(upstream: &TcpStream, hello: &[u8], strategy: Strategy) -> io::Result<()> {
    let mut out = upstream;
    let record_end = if hello[0] == 0x16 && hello.len() >= 5 { (5 + u16_at(hello, 3)).min(hello.len()) } else { hello.len() };
    let parts = match strategy.split {
        Split::None => None,
        Split::Labels => split_client_hello(&hello[..record_end], false),
        Split::Fine => split_client_hello(&hello[..record_end], true),
    };
    let Some(parts) = parts else {
        return out.write_all(hello);
    };
    let disorder = strategy.ttl > 0 && upstream.peer_addr()?.is_ipv4();
    let default_ttl = upstream.ttl()?;
    if disorder {
        upstream.set_ttl(strategy.ttl as u32)?;
    }
    if strategy.oob {
        let mut first = parts[0].clone();
        first.push(b'a');
        let sent = socket2::SockRef::from(upstream).send_out_of_band(&first)?;
        if sent != first.len() {
            return Err(io::Error::new(io::ErrorKind::WriteZero, "short OOB write"));
        }
    } else {
        out.write_all(&parts[0])?;
    }
    if disorder {
        // Windows may put the segment on the wire after send() returns; restoring the TTL too early
        // would send the first fragment normally and lose the reordering.
        std::thread::sleep(Duration::from_millis(10));
        upstream.set_ttl(default_ttl)?;
    }
    for part in &parts[1..] {
        out.write_all(part)?;
    }
    out.write_all(&hello[record_end..])
}

// ---------- ClientHello splitting ----------

const RECORD_HEADER: usize = 5;

fn u16_at(b: &[u8], at: usize) -> usize {
    ((b[at] as usize) << 8) | b[at + 1] as usize
}

/// TLS records cut in the middle of every SNI label ("yout|ubei.goog|leapis.com"), or every
/// second byte of the name when `fine`; None if `record` isn't a lone ClientHello.
fn split_client_hello(record: &[u8], fine: bool) -> Option<Vec<Vec<u8>>> {
    if record.len() <= RECORD_HEADER + 4 || record[0] != 0x16 || record[RECORD_HEADER] != 0x01 {
        return None;
    }
    let length = u16_at(record, 3);
    if length != record.len() - RECORD_HEADER {
        return None;
    }
    let payload = &record[RECORD_HEADER..];
    let cuts = sni_cuts(payload, fine).unwrap_or_else(|| vec![1]);
    let mut bounds = vec![0];
    bounds.extend(cuts.into_iter().filter(|&c| c > 0 && c < length));
    bounds.push(length);
    bounds.dedup();
    Some(
        bounds
            .windows(2)
            .map(|w| {
                let piece = &payload[w[0]..w[1]];
                let mut out = Vec::with_capacity(RECORD_HEADER + piece.len());
                out.extend_from_slice(&record[..3]);
                out.extend_from_slice(&(piece.len() as u16).to_be_bytes());
                out.extend_from_slice(piece);
                out
            })
            .collect(),
    )
}

/// Ascending cut offsets (relative to the handshake payload) inside the SNI host name.
fn sni_cuts(b: &[u8], fine: bool) -> Option<Vec<usize>> {
    let end = b.len();
    let mut p = 4 + 2 + 32; // handshake header, client version, random
    if p >= end {
        return None;
    }
    p += 1 + b[p] as usize; // session id
    if p + 2 > end {
        return None;
    }
    p += 2 + u16_at(b, p); // cipher suites
    if p >= end {
        return None;
    }
    p += 1 + b[p] as usize; // compression methods
    if p + 2 > end {
        return None;
    }
    let extensions_end = end.min(p + 2 + u16_at(b, p));
    p += 2;
    while p + 4 <= extensions_end {
        let kind = u16_at(b, p);
        let ext_length = u16_at(b, p + 2);
        let data = p + 4;
        if kind == 0 && data + 5 <= extensions_end {
            let name_length = u16_at(b, data + 3);
            let name_start = data + 5;
            if name_length < 2 || name_start + name_length > extensions_end {
                return None;
            }
            if fine {
                return Some((1..name_length).step_by(2).map(|cut| name_start + cut).collect());
            }
            let name = std::str::from_utf8(&b[name_start..name_start + name_length]).ok()?;
            return Some(label_midpoints(name).into_iter().map(|cut| name_start + cut).collect());
        }
        p = data + ext_length;
    }
    None
}

/// Middle of each label except the TLD: "music.youtube.com" → "mu|sic.you|tube.com".
fn label_midpoints(name: &str) -> Vec<usize> {
    let labels: Vec<&str> = name.split('.').collect();
    let mut cuts = Vec::new();
    let mut label_start = 0;
    for (index, label) in labels.iter().enumerate() {
        if index + 1 < labels.len() && label.len() >= 2 {
            cuts.push(label_start + label.len() / 2);
        }
        label_start += label.len() + 1;
    }
    if cuts.is_empty() {
        cuts.push(name.len() / 2);
    }
    cuts
}

/// `--yt-net-selftest`: DoH and a request through the proxy, printed to stdout.
pub fn selftest() -> i32 {
    for host in ["music.youtube.com", "rr1---sn-4g5e6nsz.googlevideo.com", "i.ytimg.com"] {
        println!("doh {host}: {:?}", doh_lookup(host));
    }
    let Some(proxy) = ureq_proxy() else {
        println!("proxy: failed to start");
        return 1;
    };
    let agent = ureq::AgentBuilder::new().proxy(proxy).timeout(Duration::from_secs(20)).build();
    let mut ok = true;
    for url in ["https://music.youtube.com/generate_204", "https://i.ytimg.com/generate_204", "https://www.youtube.com/generate_204"] {
        let started = Instant::now();
        match agent.get(url).call() {
            Ok(r) => println!("{url}: {} in {:?}", r.status(), started.elapsed()),
            Err(e) => {
                ok = false;
                println!("{url}: {e} after {:?}", started.elapsed());
            }
        }
    }
    ok &= crate::music::selftest_playback();
    if ok { 0 } else { 2 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn label_midpoints_skip_tld() {
        assert_eq!(label_midpoints("music.youtube.com"), vec![2, 9]);
    }

    #[test]
    fn alternate_hosts_from_mn() {
        let url = "https://rr3---sn-abc.googlevideo.com/videoplayback?fvip=3&mn=sn-abc%2Csn-def";
        let hosts = alternate_hosts(url);
        assert_eq!(hosts[0], "rr3---sn-def.googlevideo.com");
        assert!(hosts.contains(&"rr1---sn-abc.googlevideo.com".to_string()));
    }
}
