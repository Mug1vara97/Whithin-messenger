import { useEffect, useState } from 'react';
import { Icon } from '../src/components/Icon';
import { anime, films } from './api';
import { useCinemaNav } from './nav';
import { continueList, useProgress } from './progress';
import { ErrorNote, PosterCard, Row, SkeletonCards, Tabs, useAsync } from './ui';

const continueItem = (t) => ({
  source: t.source,
  key: t.key,
  id: t.id,
  title: t.title,
  poster: t.poster,
  subtitle: t.episodeName ? `${t.season && t.source === 'rezka' ? `Сезон ${t.season} · ` : ''}${t.episodeName}` : 'Фильм',
});

function ContinueRow() {
  const titles = useProgress((s) => s.titles);
  const list = continueList(titles).slice(0, 20);
  const root = useCinemaNav((s) => s.root);
  if (!list.length) return null;
  return (
    <section className="row">
      <div className="row__head">
        <h2 className="section-title">Продолжить просмотр</h2>
        <button type="button" className="row__more" onClick={() => root('history')}>
          Вся история
        </button>
      </div>
      <div className="row__track">
        {list.map((t) => (
          <PosterCard key={t.key} item={continueItem(t)} progress={t.position / t.duration} />
        ))}
      </div>
    </section>
  );
}

function SourceRow({ source, section, title, onMore }) {
  const { data, error, loading } = useAsync(() => source.list(section.id), [section.id]);
  return <Row title={title || section.title} items={data} loading={loading} error={error} action="Все" onAction={onMore} />;
}

export function HomeView() {
  const root = useCinemaNav((s) => s.root);
  return (
    <div className="page">
      <h1 className="page__title">Кино</h1>
      <ContinueRow />
      <SourceRow source={anime} section={anime.sections[0]} title="Аниме: новые серии" onMore={() => root('anime')} />
      <SourceRow source={films} section={films.sections[0]} title="Популярные фильмы" onMore={() => root('films')} />
      <SourceRow source={films} section={films.sections[1]} title="Популярные сериалы" onMore={() => root('films')} />
      <SourceRow source={anime} section={anime.sections[1]} title="Популярное аниме" onMore={() => root('anime')} />
    </div>
  );
}

/** Tabbed catalog of one source with «Показать ещё» paging. */
export function BrowseView({ source, title, note }) {
  const [section, setSection] = useState(source.sections[0].id);
  const [pages, setPages] = useState({ items: [], page: 0, done: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (page) => {
    setLoading(true);
    setError(null);
    try {
      const items = await source.list(section, page);
      setPages((prev) => {
        const base = page === 1 ? [] : prev.items;
        const seen = new Set(base.map((i) => i.key));
        const fresh = items.filter((i) => !seen.has(i.key));
        return { items: [...base, ...fresh], page, done: fresh.length === 0 };
      });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPages({ items: [], page: 0, done: false });
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  return (
    <div className="page">
      <h1 className="page__title">{title}</h1>
      {note && <p className="page__note">{note}</p>}
      <Tabs tabs={source.sections} value={section} onChange={setSection} />
      {error && <ErrorNote error={error} onRetry={() => load(pages.page + 1 || 1)} />}
      <div className="grid">
        {pages.items.map((item) => (
          <PosterCard key={item.key} item={item} />
        ))}
        {loading && <SkeletonCards count={pages.items.length ? 6 : 18} />}
      </div>
      {!loading && !pages.done && pages.items.length > 0 && (
        <button type="button" className="pill-btn pill-btn--ghost more-btn" onClick={() => load(pages.page + 1)}>
          Показать ещё
        </button>
      )}
    </div>
  );
}

export function SearchView({ query }) {
  const a = useAsync(() => anime.search(query), [query]);
  const f = useAsync(() => films.search(query), [query]);
  const empty = !a.loading && !f.loading && !a.data?.length && !f.data?.length;
  return (
    <div className="page">
      <h1 className="page__title">«{query}»</h1>
      {empty && !a.error && !f.error && (
        <div className="empty">
          <Icon name="search" size={40} />
          <h2>Ничего не нашлось</h2>
          <p>Попробуйте другое название или оригинальное на английском</p>
        </div>
      )}
      {(a.loading || a.data?.length > 0 || a.error) && (
        <section className="row">
          <h2 className="section-title">Аниме · AniLibria</h2>
          {a.error ? (
            <ErrorNote error={a.error} />
          ) : (
            <div className="grid">{a.loading ? <SkeletonCards count={6} /> : a.data.map((item) => <PosterCard key={item.key} item={item} />)}</div>
          )}
        </section>
      )}
      {(f.loading || f.data?.length > 0 || f.error) && (
        <section className="row">
          <h2 className="section-title">Фильмы и сериалы · HDRezka</h2>
          {f.error ? (
            <ErrorNote error={f.error} />
          ) : (
            <div className="grid">{f.loading ? <SkeletonCards count={6} /> : f.data.map((item) => <PosterCard key={item.key} item={item} />)}</div>
          )}
        </section>
      )}
    </div>
  );
}

export function HistoryView() {
  const titles = useProgress((s) => s.titles);
  const remove = useProgress((s) => s.remove);
  const list = Object.values(titles).sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="page">
      <h1 className="page__title">История</h1>
      {!list.length ? (
        <div className="empty">
          <Icon name="clock" size={40} />
          <h2>Пока пусто</h2>
          <p>Здесь появится всё, что вы начали смотреть</p>
        </div>
      ) : (
        <div className="grid">
          {list.map((t) => (
            <div key={t.key} className="grid__cell">
              <PosterCard item={continueItem(t)} progress={t.position / t.duration} />
              <button type="button" className="grid__remove" onClick={() => remove(t.key)} title="Убрать из истории">
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
