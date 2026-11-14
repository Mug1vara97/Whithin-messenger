export const tauri = () =>
  new Promise((resolve) => {
    const tick = () => (window.__TAURI__?.core?.invoke ? resolve(window.__TAURI__) : setTimeout(tick, 20));
    tick();
  });

export const invoke = async (command, args) => (await tauri()).core.invoke(command, args);

export const listen = async (event, handler) => (await tauri()).event.listen(event, (e) => handler(e.payload));

export const emitTo = async (target, event, payload) => (await tauri()).event.emitTo(target, event, payload).catch(() => {});
