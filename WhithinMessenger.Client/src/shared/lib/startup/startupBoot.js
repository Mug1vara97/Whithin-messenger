const BOOT_SESSION_KEY = 'whithin:startup-boot-done';

export function hasStartupBootCompleted() {
  try {
    return sessionStorage.getItem(BOOT_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markStartupBootCompleted() {
  try {
    sessionStorage.setItem(BOOT_SESSION_KEY, '1');
  } catch {
    // sessionStorage may be unavailable in some environments
  }
}
