import { useEffect, useRef, useState } from 'react';
import { AlbumView } from './components/AlbumView';
import { ArtistView } from './components/ArtistView';
import { HomeView } from './components/HomeView';
import { Icon } from './components/Icon';
import { LibraryView } from './components/LibraryView';
import { NowPlayingBar } from './components/NowPlayingBar';
import { QueuePanel } from './components/QueuePanel';
import { Sidebar } from './components/Sidebar';
import { listen } from './lib/tauri';
import { useLibrary } from './store/library';
import { useNav } from './store/nav';
import { usePlayer } from './store/player';
import { useSearch } from './store/search';

function Page({ page, scrollRef }) {
  switch (page.name) {
    case 'library':
      return <LibraryView onSearch={() => useNav.getState().root('home')} />;
    case 'artist':
      return <ArtistView key={page.id} id={page.id} />;
    case 'album':
      return <AlbumView key={page.id} id={page.id} />;
    default:
      return <HomeView scrollRef={scrollRef} />;
  }
}

export function App() {
  const stack = useNav((s) => s.stack);
  const [queueOpen, setQueueOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);
  const page = stack[stack.length - 1];

  useEffect(() => {
    const library = useLibrary.getState();
    library.load();
    listen('music-library-changed', () => useLibrary.getState().sync());
    const onFocus = () => useLibrary.getState().syncIfStale();
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement.type !== 'range';
      if (e.code === 'Space' && !typing) {
        e.preventDefault();
        usePlayer.getState().togglePlay();
      }
      if (e.altKey && e.key === 'ArrowLeft') useNav.getState().back();
    };
    const onMouse = (e) => {
      if (e.button === 3) useNav.getState().back();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mouseup', onMouse);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mouseup', onMouse);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [page]);

  return (
    <div className={`app${queueOpen ? ' app--queue' : ''}`}>
      <Sidebar
        view={stack[0].name}
        onNavigate={(name) => {
          if (name === 'home' && stack.length === 1 && stack[0].name === 'home') useSearch.getState().setQuery('');
          useNav.getState().root(name);
        }}
      />
      <main
        ref={scrollRef}
        className={`panel main${scrolled ? ' main--scrolled' : ''}`}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
      >
        {stack.length > 1 && (
          <button type="button" className="back-btn" onClick={() => useNav.getState().back()} title="Назад">
            <Icon name="back" size={20} />
          </button>
        )}
        <Page page={page} scrollRef={scrollRef} />
      </main>
      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
      <NowPlayingBar queueOpen={queueOpen} onToggleQueue={() => setQueueOpen((v) => !v)} />
    </div>
  );
}
