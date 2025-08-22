import { base } from '$service-worker';

// Add a minimal install event listener to ensure SvelteKit generates the file.
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  // No caching, just ensuring the SW installs and activates quickly.
  event.waitUntil(self.skipWaiting());
});

// Service Worker is now only for push notifications.
// Caching for offline support and performance has been removed as requested.

// 푸시 알림 처리
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: `${base}/icons/icon-192x192.png`,
      badge: `${base}/icons/badge-72x72.png`,
      vibrate: [100, 50, 100],
      data: data.data,
      actions: [
        {
          action: 'view',
          title: '보기'
        },
        {
          action: 'close',
          title: '닫기'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click event');
  
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(base || '/')
    );
  }
});