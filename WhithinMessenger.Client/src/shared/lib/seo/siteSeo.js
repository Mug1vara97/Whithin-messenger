export const SITE_URL = 'https://whithin.ru';

export const DEFAULT_SITE_TITLE = 'Whithin — мессенджер с чатами и голосовыми звонками';

export const DEFAULT_SITE_DESCRIPTION =
  'Whithin — мессенджер для общения: личные и групповые чаты, голосовые звонки, серверы и синхронизация между вебом, ПК и Android.';

const INDEX_ROBOTS = 'index, follow, max-snippet:160, max-image-preview:large';
const AUTH_ROBOTS = 'noindex, follow';

const AUTH_PAGE_TITLE = 'Вход — Whithin';

function setMetaContent(selector, content) {
  const element = document.querySelector(selector);
  if (element) {
    element.setAttribute('content', content);
  }
}

export function applySiteSeo({
  title = DEFAULT_SITE_TITLE,
  description = DEFAULT_SITE_DESCRIPTION,
  path = '/',
  robots = INDEX_ROBOTS,
} = {}) {
  if (typeof document === 'undefined') return;

  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[name="robots"]', robots);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', `${SITE_URL}${path}`);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute('href', `${SITE_URL}${path}`);
  }
}

export function applyAuthPageSeo(path) {
  applySiteSeo({
    title: AUTH_PAGE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    path: '/',
    robots: AUTH_ROBOTS,
  });
}
