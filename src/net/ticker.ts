/**
 * A steady timer that keeps running when the tab is in the background.
 * Browsers pause requestAnimationFrame in hidden tabs, and throttle setInterval
 * on the page to ~1 Hz, but timers inside a Web Worker keep firing. The host
 * uses this so the game never freezes for everyone if the host switches tabs.
 */
export function startTicker(callback: () => void, intervalMs = 4): () => void {
  const source = `setInterval(() => postMessage(0), ${intervalMs});`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url);
  worker.onmessage = callback;
  return () => {
    worker.terminate();
    URL.revokeObjectURL(url);
  };
}
