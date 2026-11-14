import { useEffect, useState } from 'react';
import { Icon } from '../src/components/Icon';
import { CinemaIcon } from './CinemaIcon';
import { useCinemaNav } from './nav';

/** `run` result with loading/error state; re-runs when `deps` change. */
export function useAsync(run, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ data: s.data, error: null, loading: true }));
    Promise.resolve()
      .then(run)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((e) => !cancelled && setState({ data: null, error: String(e?.message || e), loading: false }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function Poster({ src, alt = '', icon = 'film' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return src && !broken ? (
    <img src={src} alt={alt} loading="lazy" draggable={false} onError={() => setBroken(true)} />
  ) : (
    <span className="poster-fallback">
      <CinemaIcon name={icon} size={36} />
    </span>
  );
}

export function PosterCard({ item, progress }) {
  const openTitle = useCinemaNav((s) => s.openTitle);
  return (
    <button type="button" className="pcard" onClick={() => openTitle(item)} title={item.title}>
      <span className="pcard__art">
        <Poster src={item.poster} alt="" icon={item.source === 'anime' ? 'anime' : 'film'} />
        {item.badge && <span className="pcard__badge">{item.badge}</span>}
        {item.note && <span className="pcard__note">{item.note}</span>}
        {progress > 0 && (
          <span className="pcard__progress">
            <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </span>
        )}
        <span className="pcard__play">
          <Icon name="play" size={22} />
        </span>
      </span>
      <span className="pcard__title">{item.title}</span>
      {item.subtitle && <span className="pcard__sub">{item.subtitle}</span>}
    </button>
  );
}

export function SkeletonCards({ count = 8 }) {
  return Array.from({ length: count }, (_, i) => (
    <span key={i} className="pcard pcard--skeleton">
      <span className="pcard__art" />
      <span className="pcard__line" />
      <span className="pcard__line pcard__line--short" />
    </span>
  ));
}

export function Row({ title, items, loading, error, action, onAction }) {
  return (
    <section className="row">
      <div className="row__head">
        <h2 className="section-title">{title}</h2>
        {action && (
          <button type="button" className="row__more" onClick={onAction}>
            {action}
          </button>
        )}
      </div>
      {error ? (
        <ErrorNote error={error} />
      ) : (
        <div className="row__track">
          {loading && !items?.length ? <SkeletonCards count={8} /> : items?.map((item) => <PosterCard key={item.key} item={item} />)}
        </div>
      )}
    </section>
  );
}

export function ErrorNote({ error, onRetry, children }) {
  return (
    <div className="note note--error">
      <Icon name="cloudOff" size={20} />
      <span>{error}</span>
      {children}
      {onRetry && (
        <button type="button" className="pill-btn pill-btn--ghost" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          className={`tabs__tab${t.id === value ? ' tabs__tab--on' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.title}
        </button>
      ))}
    </div>
  );
}
