const CACHE_NAME = 'aldahia-v2'; // قمنا بتغيير الإصدار هنا

self.addEventListener('install', (event) => {
  self.skipWaiting(); // يجبر المتصفح على تفعيل التحديث فوراً
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // يسيطر على الصفحة فوراً
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
