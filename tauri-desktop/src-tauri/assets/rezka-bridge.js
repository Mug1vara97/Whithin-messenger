// Runs inside the hidden HDRezka window (the site's own origin), so requests look like the site's own AJAX.
// Rust starts jobs with __wz.start() and polls __wz.take(); nothing here can reach the app's IPC.
(() => {
  if (window.__wz) return;

  const jobs = new Map();
  const squash = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const text = (el) => squash(el?.textContent);
  const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
  const challenge = (url) => new Error(`challenge:${url}`);
  const local = (url) => {
    const parsed = new URL(url, location.origin);
    return parsed.pathname + parsed.search;
  };

  async function page(url) {
    const res = await fetch(local(url), { credentials: 'include' });
    const html = await res.text();
    if (html.includes('anubis_challenge')) throw challenge(new URL(local(url), location.origin).href);
    return parse(html);
  }

  async function ajax(path, data) {
    const res = await fetch(`${path}?t=${Date.now()}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams(data),
    });
    const body = await res.text();
    if (body.includes('anubis_challenge')) throw challenge(location.href);
    const json = JSON.parse(body);
    if (json.success === false) throw new Error(json.message || 'HDRezka отклонила запрос');
    return json;
  }

  // Stream links come base64-encoded with junk inserted; same cleanup as the hdrezka library.
  const TRASH = /^#h|\/\/_\/\/|(?:I[01UV]|[JQ][EF]|X[kl])(?:[A4][=hjk]|[B5][Ae])|(?:I[Sy]|[JQ]C|Xi)(?:[EMQ][=hjk]|[FNR][Ae])/g;
  function decode(raw) {
    if (!raw.startsWith('#h')) return raw;
    let s = raw.replace(TRASH, '').replace(/=+$/, '');
    while (s.length % 4) s += '=';
    return atob(s);
  }

  const height = (label) => {
    const k = label.match(/(\d+)\s*K/i);
    if (k) return Number(k[1]) === 4 ? 2160 : Number(k[1]) * 720;
    return parseInt(label, 10) || 0;
  };

  function streams(raw) {
    if (!raw || typeof raw !== 'string') return [];
    return decode(raw)
      .split(/,(?=\[)/)
      .map((part) => {
        const m = part.match(/^\[([^\]]*)\]([\s\S]*)$/);
        if (!m) return null;
        const label = squash(m[1].replace(/<[^>]+>/g, ''));
        const urls = m[2].split(' or ').map((u) => u.trim()).filter(Boolean);
        const hls = urls.find((u) => u.endsWith('.m3u8')) || null;
        const mp4 = urls.find((u) => !u.endsWith('.m3u8')) || (hls ? hls.replace(/:hls:manifest\.m3u8$/, '') : null);
        return hls || mp4 ? { label, height: height(label), hls, mp4 } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.height - b.height);
  }

  function subtitles(raw) {
    if (!raw || typeof raw !== 'string') return [];
    return raw
      .split(/,(?=\[)/)
      .map((part) => part.match(/^\[([^\]]*)\]([\s\S]*)$/))
      .filter(Boolean)
      .map((m) => ({ label: squash(m[1]), url: m[2].trim() }));
  }

  function items(doc) {
    return [...doc.querySelectorAll('.b-content__inline_item')].map((el) => {
      const link = el.querySelector('.b-content__inline_item-link a');
      return {
        id: el.dataset.id,
        url: el.dataset.url || link?.href,
        title: text(link),
        meta: text(el.querySelector('.b-content__inline_item-link div')),
        poster: el.querySelector('.b-content__inline_item-cover img')?.src || null,
        kind: text(el.querySelector('.entity')),
        info: text(el.querySelector('.cat + .info, .info')),
      };
    });
  }

  function episodesFrom(root) {
    const seasons = [...root.querySelectorAll('.b-simple_season__item')].map((el) => ({
      id: Number(el.dataset.tab_id),
      name: text(el),
    }));
    const episodes = [...root.querySelectorAll('.b-simple_episode__item')].map((el) => ({
      season: Number(el.dataset.season_id),
      episode: Number(el.dataset.episode_id),
      name: text(el),
    }));
    if (!seasons.length && episodes.length) {
      [...new Set(episodes.map((e) => e.season))].forEach((id) => seasons.push({ id, name: `Сезон ${id}` }));
    }
    return { seasons, episodes };
  }

  const ops = {
    async list({ path, page: n = 1 }) {
      const [p, q] = path.split('?');
      const url = n > 1 ? `${p.replace(/\/$/, '')}/page/${n}/${q ? `?${q}` : ''}` : path;
      return { items: items(await page(url)) };
    },

    async search({ query, page: n = 1 }) {
      const q = encodeURIComponent(query);
      return { items: items(await page(`/search/?do=search&subaction=search&q=${q}${n > 1 ? `&page=${n}` : ''}`)) };
    },

    async post({ url }) {
      const doc = await page(url);
      const q = (s) => doc.querySelector(s);
      const type = (q('meta[property="og:type"]')?.content || '').replace('video.', '');
      const script = [...doc.querySelectorAll('script')].map((s) => s.textContent).find((t) => t.includes('initCDN')) || '';
      const init = script.match(/initCDN(?:Movies|Series)Events\((\d+),\s*(\d+)/);
      const info = {};
      doc.querySelectorAll('.b-post__info tr').forEach((row) => {
        const key = text(row.querySelector('h2, .l'))?.replace(/:$/, '');
        const value = text(row.querySelectorAll('td')[1]);
        if (key && value) info[key] = value;
      });
      const translators = [...doc.querySelectorAll('.b-translator__item')].map((el) => ({
        id: Number(el.dataset.translator_id),
        name: squash(el.title || el.textContent),
        premium: el.classList.contains('b-prem_translator'),
        camrip: el.dataset.camrip || '0',
        ads: el.dataset.ads || '0',
        director: el.dataset.director || '0',
      }));
      const rate = (sel) => {
        const m = text(q(sel)).match(/([\d.]+)/);
        return m ? Number(m[1]) : null;
      };
      return {
        id: Number(q('#post_id')?.value || init?.[1]),
        url: location.origin + local(url),
        type,
        title: text(q('.b-post__title')),
        original: text(q('.b-post__origtitle')),
        poster: q('.b-sidecover a')?.href || q('.b-sidecover img')?.src || null,
        description: text(q('.b-post__description_text')),
        imdb: rate('.b-post__info_rates.imdb'),
        kp: rate('.b-post__info_rates.kp'),
        info,
        status: text(q('.b-post__infolast')),
        translator: init ? Number(init[2]) : translators[0]?.id ?? null,
        translators,
        restricted: text(q('.b-player__restricted')) || null,
        ...(type === 'tv_series' ? episodesFrom(doc) : { seasons: [], episodes: [] }),
      };
    },

    async episodes({ id, translator }) {
      const json = await ajax('/ajax/get_cdn_series/', { id, translator_id: translator, action: 'get_episodes' });
      const root = parse(`<ul>${json.seasons || ''}</ul><ul>${json.episodes || ''}</ul>`);
      return episodesFrom(root);
    },

    async stream({ id, translator, season, episode, movie, camrip = '0', ads = '0', director = '0' }) {
      const data = movie
        ? { id, translator_id: translator, is_camrip: camrip, is_ads: ads, is_director: director, action: 'get_movie' }
        : { id, translator_id: translator, season, episode, action: 'get_stream' };
      const json = await ajax('/ajax/get_cdn_series/', data);
      const list = streams(json.url);
      return {
        streams: list,
        subtitles: subtitles(json.subtitle),
        restricted: list.length ? null : 'Видео недоступно в вашем регионе или требует входа в аккаунт HDRezka',
        referer: location.origin + '/',
      };
    },
  };

  window.__wz = {
    start(id, op, args) {
      jobs.set(id, null);
      Promise.resolve()
        .then(() => {
          if (!ops[op]) throw new Error(`unknown op ${op}`);
          return ops[op](args || {});
        })
        .then((v) => jobs.set(id, { ok: true, v }))
        .catch((e) => jobs.set(id, { ok: false, e: String(e?.message || e) }));
      return true;
    },
    take(id) {
      if (!jobs.has(id)) return { lost: true };
      const result = jobs.get(id);
      if (result) jobs.delete(id);
      return result;
    },
  };
})();
