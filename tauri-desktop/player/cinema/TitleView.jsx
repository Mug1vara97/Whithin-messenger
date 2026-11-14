import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../src/components/Icon';
import { formatTime } from '../src/lib/format';
import { films, sourceFor } from './api';
import { CinemaIcon } from './CinemaIcon';
import { useCinemaNav } from './nav';
import { WATCHED, episodeKey, useProgress } from './progress';
import { ErrorNote, Poster, useAsync } from './ui';

const order = (a, b) => a.season - b.season || a.episode - b.episode;

export function TitleView({ item }) {
  const source = sourceFor(item);
  const { data: title, error, loading } = useAsync(() => source.title(item.id), [item.key]);
  const saved = useProgress((s) => s.titles[title?.key || item.key]);
  const play = useCinemaNav((s) => s.play);

  const [translator, setTranslator] = useState(null);
  const [list, setList] = useState(null);
  const [listError, setListError] = useState(null);
  const [season, setSeason] = useState(null);

  // Starting voice: the one last watched, else the site's default.
  useEffect(() => {
    if (!title) return;
    const voices = title.translators || [];
    const start =
      voices.find((t) => t.id === saved?.translator) || voices.find((t) => t.id === title.translator) || voices[0] || (title.translator ? { id: title.translator, name: '' } : null);
    setTranslator(start);
    setList({ seasons: title.seasons || [], episodes: title.episodes || [] });
    setSeason(saved?.season || title.seasons?.[0]?.id || 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // Rezka: each voice has its own set of episodes.
  useEffect(() => {
    if (!title || title.source !== 'rezka' || title.kind !== 'series' || !translator) return;
    if (translator.id === title.translator) {
      setList({ seasons: title.seasons, episodes: title.episodes });
      return;
    }
    let cancelled = false;
    setListError(null);
    setList(null);
    films
      .episodes(title.postId, translator.id)
      .then((res) => {
        if (cancelled) return;
        setList(res);
        setSeason((s) => (res.seasons.some((x) => x.id === s) ? s : res.seasons[0]?.id || 1));
      })
      .catch((e) => !cancelled && setListError(String(e?.message || e)));
    return () => {
      cancelled = true;
    };
  }, [title, translator]);

  const queue = useMemo(() => {
    if (!title) return [];
    if (title.kind === 'movie') return [{ season: 0, episode: 0, name: title.title }];
    return [...(list?.episodes || [])].sort(order);
  }, [title, list]);

  if (loading) {
    return (
      <div className="page">
        <div className="thero thero--skeleton" />
      </div>
    );
  }
  if (error || !title) {
    return (
      <div className="page">
        <ErrorNote error={error || 'Не удалось открыть'}>
          {item.source === 'rezka' && (
            <button type="button" className="pill-btn pill-btn--ghost" onClick={() => films.openAccount()}>
              Открыть HDRezka
            </button>
          )}
        </ErrorNote>
      </div>
    );
  }

  const start = (ep) => {
    const index = Math.max(0, queue.findIndex((e) => e.season === ep.season && e.episode === ep.episode));
    const sameAsSaved = saved && (title.kind === 'movie' || (saved.season === ep.season && saved.episode === ep.episode));
    const resume = sameAsSaved && saved.position / saved.duration < WATCHED ? saved.position : 0;
    play({ title, translator, episodes: queue, index, resume });
  };

  const resumeTarget = (() => {
    if (!queue.length) return null;
    if (!saved) return { ep: queue[0], label: title.kind === 'movie' ? 'Смотреть' : 'Смотреть с начала' };
    const i = queue.findIndex((e) => title.kind === 'movie' || (e.season === saved.season && e.episode === saved.episode));
    if (i < 0) return { ep: queue[0], label: 'Смотреть' };
    const done = saved.position / saved.duration >= WATCHED;
    if (done && queue[i + 1]) return { ep: queue[i + 1], label: `Дальше: ${queue[i + 1].name}` };
    if (done) return { ep: queue[i], label: 'Посмотреть снова' };
    return { ep: queue[i], label: `Продолжить${title.kind === 'movie' ? '' : ` · ${queue[i].name}`} · ${formatTime(saved.position)}` };
  })();

  const seasonEpisodes = queue.filter((e) => title.kind === 'movie' || e.season === season);
  const voices = title.translators || [];

  return (
    <div className="page title">
      <div className="thero">
        {title.backdrop && <div className="thero__backdrop" style={{ backgroundImage: `url("${title.backdrop}")` }} />}
        <div className="thero__poster">
          <Poster src={title.poster} icon={title.source === 'anime' ? 'anime' : 'film'} />
        </div>
        <div className="thero__body">
          <span className="thero__kind">
            {title.source === 'anime' ? 'Аниме · AniLibria' : `${title.kind === 'movie' ? 'Фильм' : 'Сериал'} · HDRezka`}
          </span>
          <h1 className="thero__title">{title.title}</h1>
          {title.original && <div className="thero__original">{title.original}</div>}
          <div className="thero__facts">
            {title.rating && (
              <span className="thero__rating">
                {title.rating.label} {title.rating.value}
              </span>
            )}
            {title.facts.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
          {title.genres?.length > 0 && <div className="thero__genres">{title.genres.join(', ')}</div>}
          <div className="thero__actions">
            {resumeTarget && !title.restricted && (
              <button type="button" className="pill-btn pill-btn--primary thero__play" onClick={() => start(resumeTarget.ep)}>
                <Icon name="play" size={20} />
                <span>{resumeTarget.label}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {title.restricted && (
        <ErrorNote error={`HDRezka: ${title.restricted}`}>
          <button type="button" className="pill-btn pill-btn--ghost" onClick={() => films.openAccount()}>
            Войти в HDRezka
          </button>
        </ErrorNote>
      )}

      {title.description && <p className="title__about">{title.description}</p>}

      {voices.length > 1 && (
        <section className="title__section">
          <h2 className="section-title">Озвучка</h2>
          <div className="chips">
            {voices.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`chip${translator?.id === v.id ? ' chip--on' : ''}`}
                onClick={() => setTranslator(v)}
                title={v.premium ? 'Только для премиум-аккаунта HDRezka' : v.name}
              >
                {v.name}
                {v.premium && <span className="chip__tag">premium</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {title.kind === 'series' && (
        <section className="title__section">
          <div className="title__episodes-head">
            <h2 className="section-title">Серии</h2>
            {list?.seasons?.length > 1 && (
              <div className="chips chips--seasons">
                {list.seasons.map((s) => (
                  <button key={s.id} type="button" className={`chip${season === s.id ? ' chip--on' : ''}`} onClick={() => setSeason(s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {listError && <ErrorNote error={listError} />}
          {!list && !listError && <div className="episodes episodes--loading" />}
          <div className="episodes">
            {seasonEpisodes.map((ep) => (
              <EpisodeRow key={episodeKey(ep.season, ep.episode)} titleKey={title.key} ep={ep} current={saved?.season === ep.season && saved?.episode === ep.episode} onPlay={() => start(ep)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EpisodeRow({ titleKey, ep, current, onPlay }) {
  const fraction = useProgress((s) => s.titles[titleKey]?.episodes?.[episodeKey(ep.season, ep.episode)] || 0);
  return (
    <button type="button" className={`episode${current ? ' episode--current' : ''}${fraction >= WATCHED ? ' episode--watched' : ''}`} onClick={onPlay}>
      <span className="episode__thumb">
        {ep.preview ? <img src={ep.preview} alt="" loading="lazy" /> : <span className="episode__num">{ep.episode}</span>}
        <span className="episode__play">
          <Icon name="play" size={20} />
        </span>
        {fraction > 0 && (
          <span className="pcard__progress">
            <span style={{ width: `${Math.min(100, fraction * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="episode__meta">
        <span className="episode__name">{ep.name}</span>
        <span className="episode__sub">
          {fraction >= WATCHED ? (
            <>
              <CinemaIcon name="history" size={13} /> Просмотрено
            </>
          ) : ep.duration ? (
            formatTime(ep.duration)
          ) : current ? (
            'Вы остановились здесь'
          ) : (
            ''
          )}
        </span>
      </span>
    </button>
  );
}
