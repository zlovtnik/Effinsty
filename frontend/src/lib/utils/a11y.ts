export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  const node = document.createElement('div');
  node.setAttribute('aria-live', politeness);
  node.setAttribute('aria-atomic', 'true');
  node.style.position = 'absolute';
  node.style.width = '1px';
  node.style.height = '1px';
  node.style.overflow = 'hidden';
  node.style.clip = 'rect(0 0 0 0)';
  document.body.appendChild(node);

  const announceMessage = () => {
    node.textContent = message;
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(announceMessage);
  } else {
    setTimeout(announceMessage, 0);
  }

  setTimeout(() => node.remove(), 1000);
}
