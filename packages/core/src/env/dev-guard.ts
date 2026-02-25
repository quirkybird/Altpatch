export function isDevLocalhost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return /localhost|127\.0\.0\.1/.test(window.location.host);
}
