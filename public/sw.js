self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Service Worker simplificado apenas para satisfazer o requisito PWA de instalabilidade
});
