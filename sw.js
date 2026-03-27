/**
 * BookVibe Service Worker
 * Provides offline caching and PWA support.
 */

const CACHE_NAME = 'bookvibe-v2';
const APP_SHELL = [
    './',
    './index.html',
    './library.html',
    './detail.html',
    './profile.html',
    './styles.css',
    './script.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

const FONT_CACHE = 'bookvibe-fonts-v1';
const API_CACHE = 'bookvibe-api-v1';

// Install — precache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== FONT_CACHE && key !== API_CACHE)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — strategy per request type
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Google Fonts — cache first
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(
            caches.open(FONT_CACHE).then(cache =>
                cache.match(event.request).then(cached => {
                    if (cached) return cached;
                    return fetch(event.request).then(response => {
                        if (response.ok) cache.put(event.request, response.clone());
                        return response;
                    });
                })
            )
        );
        return;
    }

    // Google Books API — network first, fallback to cache
    if (url.hostname === 'www.googleapis.com') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(API_CACHE).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // App shell — cache first, fallback to network
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // Cache new resources dynamically
                if (response.ok && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        }).catch(() => {
            // Offline fallback for navigation
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});
