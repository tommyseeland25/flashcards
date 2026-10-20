import { toast } from './ui/toast.js';

/**
 * Register the service worker (production builds only: in dev it would cache stale files).
 * When an updated version has been downloaded in the background, offer a Reload button.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  // On the very first visit the new worker "takes control" too; only reload for real updates.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            toast('A new version is ready.', { actionLabel: 'Reload', onAction: () => worker.postMessage('skip-waiting'), ms: 60000 });
          }
        });
      });
    } catch (err) {
      console.error('Service worker registration failed', err);
    }
  });
}
