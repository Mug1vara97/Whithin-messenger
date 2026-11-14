import { useEffect, useRef, useState } from 'react';
import { Icon } from '../src/components/Icon';
import { anime, films } from './api';
import { CinemaIcon } from './CinemaIcon';
import { useCinemaNav } from './nav';
import { BrowseView, HistoryView, HomeView, SearchView } from './pages';
import { TitleView } from './TitleView';
import { VideoPlayer } from './VideoPlayer';

const NAV = [
  { id: 'home', label: 'Главная', icon: <Icon name="home" size={22} /> },
  { id: 'anime', label: 'Аниме', icon: <CinemaIcon name="anime" size={22} /> },
  { id: 'films', label: 'Фильмы и сериалы', icon: <CinemaIcon name="film" size={22} /> },
  { id: 'history', label: 'История', icon: <CinemaIcon name="history" size={22} /> },
];

function Page({ page }) {
  switch (page.name) {
    case 'anime':
      return <BrowseView key="anime" source={anime} title="Аниме" note="Озвучка AniLibria · до 1080p" />;
    case 'films':
      return <BrowseView key="films" source={films} title="Фильмы и сериалы" note="Каталог HDRezka · озвучки на выбор" />;
    case 'history':
      return <HistoryView />;
    case 'search':
      return <SearchView key={page.query} query={page.query} />;
    case 'title':
      return <TitleView key={page.key} item={page.item} />;
    default:
      return <HomeView />;
  }
}

function SearchBox() {
  const [value, setValue] = useState('');
  const push = useCinemaNav((s) => s.push);
  const submit = () => {
    const query = value.trim();
    if (query) push({ name: 'search', key: query, query });
  };
  return (
    <form
      className="search-input cinema-search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Icon name="search" size={20} />
      <input
        type="text"
        value={value}
        placeholder="Найти аниме, фильм или сериал"
        spellCheck={false}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setValue('')}
      />
      {value && (
        <button type="button" className="search-input__clear" onClick={() => setValue('')} title="Очистить">
          <Icon name="close" size={18} />
        </button>
      )}
    </form>
  );
}

export function App() {
  const stack = useCinemaNav((s) => s.stack);
  const playing = useCinemaNav((s) => s.playing);
  const closePlayer = useCinemaNav((s) => s.closePlayer);
  const scrollRef = useRef(null);
  const page = stack[stack.length - 1];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    const onKey = (e) => {
      if (playing) return;
      if (e.altKey && e.key === 'ArrowLeft') useCinemaNav.getState().back();
    };
    const onMouse = (e) => {
      if (!playing && e.button === 3) useCinemaNav.getState().back();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mouseup', onMouse);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mouseup', onMouse);
    };
  }, [playing]);

  return (
    <div className="app cinema">
      <aside className="sidebar">
        <nav className="panel sidebar__nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${stack[0].name === item.id ? ' nav-item--active' : ''}`}
              onClick={() => useCinemaNav.getState().root(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <section className="panel sidebar__about">
          <p>
            <strong>Аниме</strong> — AniLibria, <strong>фильмы и сериалы</strong> — HDRezka. Видео всегда играет в плеере Whithin.
          </p>
          <button type="button" className="pill-btn pill-btn--ghost" onClick={() => films.openAccount()}>
            <CinemaIcon name="user" size={16} />
            Аккаунт HDRezka
          </button>
          <span className="sidebar__hint">Вход нужен, если сайт пишет, что видео недоступно в вашем регионе</span>
        </section>
      </aside>

      <main ref={scrollRef} className="panel main cinema__main">
        <header className="cinema__top">
          {stack.length > 1 && (
            <button type="button" className="cinema__back" onClick={() => useCinemaNav.getState().back()} title="Назад">
              <Icon name="back" size={20} />
            </button>
          )}
          <SearchBox />
        </header>
        <Page page={page} />
      </main>

      {playing && <VideoPlayer key={playing.title.key} session={playing} onClose={closePlayer} />}
    </div>
  );
}
