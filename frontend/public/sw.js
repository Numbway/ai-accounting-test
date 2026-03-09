// Service Worker for AI 记账 PWA
const CACHE_NAME = 'ai-accounting-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
]

// 安装时缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// 拦截请求，优先使用缓存
self.addEventListener('fetch', (event) => {
  // 跳过 API 请求
  if (event.request.url.includes('/api/')) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // 缓存命中，返回缓存
      if (response) {
        return response
      }

      // 否则发起网络请求
      return fetch(event.request).then((response) => {
        // 只缓存成功的 GET 请求
        if (
          !response ||
          response.status !== 200 ||
          response.type !== 'basic' ||
          event.request.method !== 'GET'
        ) {
          return response
        }

        const responseToCache = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache)
        })

        return response
      })
    })
  )
})
