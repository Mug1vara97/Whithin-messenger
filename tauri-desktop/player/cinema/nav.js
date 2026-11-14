import { create } from 'zustand';

/** Page stack like the music player's: roots are sidebar sections, titles push on top. */
export const useCinemaNav = create((set, get) => ({
  stack: [{ name: 'home' }],
  query: '',
  /** What's open in the player overlay, if anything. */
  playing: null,

  root(name) {
    set({ stack: [{ name }] });
  },
  push(page) {
    const top = get().stack[get().stack.length - 1];
    if (top.name === page.name && top.key === page.key) return;
    set({ stack: [...get().stack, page] });
  },
  back() {
    const { stack } = get();
    if (stack.length > 1) set({ stack: stack.slice(0, -1) });
  },
  openTitle(item) {
    get().push({ name: 'title', key: item.key, item });
  },
  setQuery(query) {
    set({ query });
  },
  play(session) {
    set({ playing: session });
  },
  closePlayer() {
    set({ playing: null });
  },
}));
