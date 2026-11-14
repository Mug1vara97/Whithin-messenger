import { create } from 'zustand';

const ROOT_KEY = 'whithin.music.view';
const ROOTS = ['home', 'library'];
const savedRoot = localStorage.getItem(ROOT_KEY);

/** Page stack: top-level sections reset it, artist / album pages push onto it. */
export const useNav = create((set, get) => ({
  stack: [{ name: ROOTS.includes(savedRoot) ? savedRoot : 'home' }],

  page() {
    const { stack } = get();
    return stack[stack.length - 1];
  },

  root(name) {
    localStorage.setItem(ROOT_KEY, name);
    set({ stack: [{ name }] });
  },

  open(name, id) {
    const top = get().page();
    if (top.name === name && top.id === id) return;
    set({ stack: [...get().stack, { name, id }] });
  },

  back() {
    const { stack } = get();
    if (stack.length > 1) set({ stack: stack.slice(0, -1) });
  },
}));

export const openArtist = (id) => id && useNav.getState().open('artist', id);
export const openAlbum = (id) => id && useNav.getState().open('album', id);
