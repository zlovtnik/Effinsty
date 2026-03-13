const LIVE_REGION_ID = 'app-live-region';

function getRegion(polite: boolean): HTMLDivElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const existing = document.getElementById(LIVE_REGION_ID) as HTMLDivElement | null;
  if (existing) {
    existing.dataset.politeness = polite ? 'polite' : 'assertive';
    return existing;
  }

  const node = document.createElement('div');
  node.id = LIVE_REGION_ID;
  node.className = 'sr-only';
  node.dataset.politeness = polite ? 'polite' : 'assertive';
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'true');
  node.style.position = 'absolute';
  node.style.width = '1px';
  node.style.height = '1px';
  node.style.overflow = 'hidden';
  node.style.clip = 'rect(0, 0, 0, 0)';
  node.style.margin = '-1px';
  node.setAttribute('aria-live', 'polite');
  document.body.appendChild(node);

  return node;
}

export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined') {
    return;
  }

  const node = getRegion(politeness === 'polite');
  if (!node) {
    return;
  }

  node.setAttribute('aria-live', politeness);
  node.textContent = '';

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      node.textContent = message;
    });
  } else {
    setTimeout(() => {
      node.textContent = message;
    }, 0);
  }
}

export function clearLiveMessage(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const existing = document.getElementById(LIVE_REGION_ID) as HTMLDivElement | null;
  if (existing) {
    existing.textContent = '';
  }
}
