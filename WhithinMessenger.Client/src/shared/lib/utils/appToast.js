const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4500;

let toasts = [];
const listeners = new Set();
let seq = 0;

function emit() {
  const snapshot = toasts.slice();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

export function subscribeAppToasts(listener) {
  listeners.add(listener);
  listener(toasts.slice());
  return () => listeners.delete(listener);
}

export function dismissAppToast(id) {
  const next = toasts.filter((toast) => toast.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function clearAppToasts() {
  if (!toasts.length) return;
  toasts = [];
  emit();
}

/**
 * Show a beUI-style motion alert toast.
 * @param {object|string} input
 * @param {'default'|'info'|'success'|'warning'|'destructive'} [input.variant]
 * @param {string} [input.title]
 * @param {string} [input.description]
 * @param {number} [input.duration]
 */
export function showAppToast(input) {
  const payload = typeof input === 'string' ? { description: input } : input || {};
  const id = `toast-${Date.now()}-${++seq}`;
  const variant = payload.variant || 'info';
  const title = payload.title || defaultTitle(variant);
  const description = payload.description || payload.message || '';
  const duration =
    payload.duration === 0
      ? 0
      : Math.max(1200, Number(payload.duration) || DEFAULT_DURATION);

  const toast = { id, variant, title, description, duration, createdAt: Date.now() };
  toasts = [toast, ...toasts].slice(0, MAX_TOASTS);
  emit();

  if (duration > 0) {
    window.setTimeout(() => dismissAppToast(id), duration);
  }

  return id;
}

function defaultTitle(variant) {
  switch (variant) {
    case 'success':
      return 'Готово';
    case 'warning':
      return 'Внимание';
    case 'destructive':
      return 'Ошибка';
    case 'info':
      return 'Сведения';
    default:
      return 'Уведомление';
  }
}

function push(variant, message, options = {}) {
  if (message == null || message === '') return null;
  const text = String(message);
  return showAppToast({
    variant,
    title: options.title,
    description: text,
    duration: options.duration,
  });
}

/** Drop-in replacement for window.alert — routes to motion toasts. */
export function appAlert(message, options = {}) {
  const text = String(message ?? '');
  const looksSuccess =
    /приглаш|сохран|успеш|готово|скопир|обновлен|принят|добавлен|создан/i.test(text);
  return push(looksSuccess ? 'success' : options.variant || 'destructive', text, options);
}

export const appToast = {
  show: showAppToast,
  dismiss: dismissAppToast,
  clear: clearAppToasts,
  info: (message, options) => push('info', message, options),
  success: (message, options) => push('success', message, options),
  warning: (message, options) => push('warning', message, options),
  error: (message, options) => push('destructive', message, options),
  /** Alias used as alert() replacement */
  alert: appAlert,
};

export default appToast;
