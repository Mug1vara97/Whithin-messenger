//! `whithin-cinema` scheme: video CDNs send no CORS headers and Rezka's wants its Referer, so every
//! playlist, segment and poster goes through here. Playlists are rewritten so nested URIs come back too.

use std::sync::OnceLock;
use std::time::Duration;

use url::Url;

pub const SCHEME: &str = "whithin-cinema";
const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
/// Progressive files (Rezka's mp4 fallback) are served in slices so a 2 GB film never lands in memory.
const RANGE_CHUNK: u64 = 4 * 1024 * 1024;

pub(crate) fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(60))
            .build()
            .expect("cinema http client")
    })
}

/// URL the webview can load for `target`; Windows maps custom schemes to http://<scheme>.localhost.
pub fn proxied(target: &str, referer: Option<&str>) -> String {
    let mut query = url::form_urlencoded::Serializer::new(String::new());
    query.append_pair("u", target);
    if let Some(referer) = referer.filter(|r| !r.is_empty()) {
        query.append_pair("r", referer);
    }
    let query = query.finish();
    if cfg!(windows) {
        format!("http://{SCHEME}.localhost/m?{query}")
    } else {
        format!("{SCHEME}://localhost/m?{query}")
    }
}

fn reply(status: u16, mime: &str, body: Vec<u8>) -> tauri::http::Response<Vec<u8>> {
    tauri::http::Response::builder()
        .status(status)
        .header("Content-Type", mime)
        .header("Access-Control-Allow-Origin", "*")
        .body(body)
        .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
}

/// `bytes=S-` or `bytes=S-E`, capped to one chunk.
fn bounded_range(header: &str) -> Option<String> {
    let spec = header.trim().strip_prefix("bytes=")?;
    let (start, end) = spec.split_once('-')?;
    let start: u64 = start.trim().parse().ok()?;
    let cap = start + RANGE_CHUNK - 1;
    let end = end.trim().parse::<u64>().map(|e| e.min(cap)).unwrap_or(cap);
    Some(format!("bytes={start}-{end}"))
}

fn rewrite_playlist(body: &str, base: &Url, referer: Option<&str>) -> String {
    let absolute = |uri: &str| base.join(uri.trim()).map(|u| u.to_string()).unwrap_or_else(|_| uri.to_string());
    body.lines()
        .map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return line.to_string();
            }
            if !trimmed.starts_with('#') {
                return proxied(&absolute(trimmed), referer);
            }
            // EXT-X-KEY / EXT-X-MAP / EXT-X-MEDIA carry their own URI="…".
            match trimmed.find("URI=\"") {
                Some(at) => {
                    let start = at + 5;
                    match trimmed[start..].find('"') {
                        Some(len) => {
                            let uri = &trimmed[start..start + len];
                            format!("{}{}{}", &trimmed[..start], proxied(&absolute(uri), referer), &trimmed[start + len..])
                        }
                        None => line.to_string(),
                    }
                }
                None => line.to_string(),
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub async fn serve(request: tauri::http::Request<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
    if request.uri().path() != "/m" {
        return reply(404, "text/plain", b"not found".to_vec());
    }
    let mut target = None;
    let mut referer = None;
    for (key, value) in url::form_urlencoded::parse(request.uri().query().unwrap_or_default().as_bytes()) {
        match key.as_ref() {
            "u" => target = Some(value.into_owned()),
            "r" => referer = Some(value.into_owned()),
            _ => {}
        }
    }
    let Some(target) = target.and_then(|t| Url::parse(&t).ok()).filter(|u| matches!(u.scheme(), "http" | "https")) else {
        return reply(400, "text/plain", b"bad url".to_vec());
    };

    let mut upstream = client().get(target.clone());
    if let Some(referer) = referer.as_deref() {
        upstream = upstream.header("Referer", referer);
        if let Ok(origin) = Url::parse(referer) {
            upstream = upstream.header("Origin", origin.origin().ascii_serialization());
        }
    }
    let range = request
        .headers()
        .get("range")
        .and_then(|v| v.to_str().ok())
        .and_then(bounded_range);
    if let Some(range) = &range {
        upstream = upstream.header("Range", range);
    }

    let response = match upstream.send().await {
        Ok(r) => r,
        Err(e) => return reply(502, "text/plain", format!("upstream: {e}").into_bytes()),
    };
    let status = response.status().as_u16();
    let final_url = response.url().clone();
    let headers = response.headers().clone();
    let mime = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = match response.bytes().await {
        Ok(b) => b.to_vec(),
        Err(e) => return reply(502, "text/plain", format!("upstream body: {e}").into_bytes()),
    };

    let is_playlist = mime.contains("mpegurl") || final_url.path().ends_with(".m3u8") || bytes.starts_with(b"#EXTM3U");
    if is_playlist {
        let text = String::from_utf8_lossy(&bytes);
        let body = rewrite_playlist(&text, &final_url, referer.as_deref());
        return tauri::http::Response::builder()
            .status(status)
            .header("Content-Type", "application/vnd.apple.mpegurl")
            .header("Cache-Control", "no-store")
            .header("Access-Control-Allow-Origin", "*")
            .body(body.into_bytes())
            .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()));
    }

    let mut builder = tauri::http::Response::builder()
        .status(status)
        .header("Content-Type", mime)
        .header("Accept-Ranges", "bytes")
        .header("Cache-Control", "public, max-age=3600")
        .header("Access-Control-Allow-Origin", "*");
    if let Some(content_range) = headers.get("content-range").and_then(|v| v.to_str().ok()) {
        builder = builder.header("Content-Range", content_range);
    }
    builder.body(bytes).unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
}

#[tauri::command]
pub fn cinema_proxy_url(url: String, referer: Option<String>) -> String {
    proxied(&url, referer.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn caps_open_ranges() {
        assert_eq!(bounded_range("bytes=0-").as_deref(), Some("bytes=0-4194303"));
        assert_eq!(bounded_range("bytes=10-20").as_deref(), Some("bytes=10-20"));
    }

    #[test]
    fn rewrites_segments_and_keys() {
        let base = Url::parse("https://cdn.example/v/720/index.m3u8").unwrap();
        let out = rewrite_playlist("#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\"\nseg0.ts\n", &base, None);
        assert!(out.contains("u=https%3A%2F%2Fcdn.example%2Fv%2F720%2Fseg0.ts"));
        assert!(out.contains("u=https%3A%2F%2Fcdn.example%2Fv%2F720%2Fkey.bin"));
    }
}
