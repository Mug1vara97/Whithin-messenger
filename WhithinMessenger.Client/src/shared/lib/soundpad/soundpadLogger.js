const isEnabled = () => {
  try {
    return import.meta.env.DEV || localStorage.getItem('soundpadDebug') === 'true';
  } catch {
    return true;
  }
};

const emit = (level, ...args) => {
  if (!isEnabled()) return;
  const fn = console[level] || console.log;
  fn('[Soundpad]', ...args);
};

export const soundpadLog = (...args) => emit('log', ...args);
export const soundpadWarn = (...args) => emit('warn', ...args);
export const soundpadError = (...args) => emit('error', ...args);
