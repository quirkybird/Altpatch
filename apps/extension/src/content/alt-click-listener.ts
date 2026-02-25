import { resolveSourceLocation } from '@packages/core';

export function registerAltClick(onLocate: (loc: ReturnType<typeof resolveSourceLocation>) => void): void {
  window.addEventListener('click', (event) => {
    if (!event.altKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const location = resolveSourceLocation(target);
    onLocate(location);
  }, true);
}
