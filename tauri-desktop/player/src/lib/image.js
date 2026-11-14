// YouTube image hosts are blocked in Russia; covers go through the native bypass proxy.
const PROXIED_HOSTS = /(^|\.)(ytimg\.com|ggpht\.com|googleusercontent\.com)$/i;
const PROXY_BASE = 'http://whithin-music.localhost/img?u=';
// Few distinct sizes, so the same cover is fetched (and cached) once per bucket.
const SIZE_BUCKETS = [96, 160, 256, 400, 600];
const GOOGLE_SIZE = /=w\d+-h\d+[^/]*$/;
const APPLE_SIZE = /\/\d+x\d+(bb|cc)\.(jpg|png|webp)$/;
const YOUTUBE_VIDEO = /^(https:\/\/i\.ytimg\.com\/vi(?:_webp)?\/[^/]+\/)\w+\.(jpg|webp)$/;

export function proxiedImage(url) {
  if (!url) return url;
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol === 'https:' && PROXIED_HOSTS.test(hostname)) return PROXY_BASE + encodeURIComponent(url);
  } catch {
    /* not a URL */
  }
  return url;
}

/**
 * The rendition of a cover closest to `cssPx` on screen: YouTube Music and Apple serve any size
 * from the same URL, so a 48px row doesn't download the 600px artwork.
 */
export function sizedImage(url, cssPx) {
  if (!url || !cssPx) return url;
  const wanted = cssPx * (window.devicePixelRatio || 1);
  const px = SIZE_BUCKETS.find((b) => b >= wanted) || SIZE_BUCKETS[SIZE_BUCKETS.length - 1];
  if (GOOGLE_SIZE.test(url)) return url.replace(GOOGLE_SIZE, `=w${px}-h${px}`);
  if (APPLE_SIZE.test(url)) return url.replace(APPLE_SIZE, (_, crop) => `/${px}x${px}${crop}.webp`);
  if (px <= 160) return url.replace(YOUTUBE_VIDEO, '$1mqdefault.jpg');
  return url;
}

/** Sized and proxied `src` for an `<img>`. */
export function imageSrc(url, cssPx) {
  return proxiedImage(sizedImage(url, cssPx));
}

/** Starts downloading covers before their rows scroll into view. */
export function preloadImages(urls, cssPx) {
  for (const url of new Set(urls.filter(Boolean))) {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = imageSrc(url, cssPx);
  }
}

/** onError helper: retries the original URL once; returns false when there is nothing left to try. */
export function retryDirect(event, url) {
  const img = event.currentTarget;
  if (!url || img.dataset.direct) return false;
  img.dataset.direct = '1';
  img.src = url;
  return true;
}
