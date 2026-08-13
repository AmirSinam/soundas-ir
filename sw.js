/// The app's own service worker, so soundAS keeps working with no network.
///
/// Flutter used to generate one. As of Flutter 3.44 that generated worker is
/// deprecated and ships as a stub whose `activate` handler calls
/// `registration.unregister()` — it deliberately removes itself, leaving no
/// offline support at all. So the app brings its own, and the build is run with
/// `--pwa-strategy=none` to stop Flutter emitting the self-erasing one.
///
/// ## Why the cache is stamped with the build
///
/// A Flutter build's file names are stable across releases: `main.dart.js` and
/// `canvaskit/*.wasm` keep their names while their contents change. So a cache
/// keyed by name alone can never tell a stale entry from a fresh one, and the
/// previous version dealt with that by revalidating every hit in the background
/// — which meant every single launch went back to the network for ~3 MB worth
/// of requests even though it already had all of it. On a slow connection those
/// background fetches are what the launch is competing with.
///
/// Instead the cache name carries the build, and `609860004dfa` is replaced with
/// the commit at deploy time (see .github/workflows/deploy-web.yml). A new
/// release changes sw.js itself, so the browser installs the new worker, fills
/// a new cache and drops the old one. Within one build nothing is ever
/// revalidated: a hit is served and that is the end of it, network untouched.
///
const CACHE = 'soundas-609860004dfa';

/// Caching is switched off entirely when the app is served locally.
///
/// `609860004dfa` is only ever replaced at deploy time, so a local run has one
/// cache name for all time — and since nothing is revalidated within a build,
/// the browser would keep serving the first `main.dart.js` it ever saw. Every
/// rebuild would appear to change nothing, on the laptop and on the phone
/// testing over the LAN, until someone thought to clear storage by hand. So a
/// local origin gets no worker behaviour at all: requests pass straight
/// through, which is what a local run wants anyway.
const LOCAL = /^(localhost|127\.0\.0\.1|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/
    .test(self.location.hostname);

// Everything the app needs to boot. Fetched during install so the *second*
// launch is offline-capable in full rather than in pieces.
const SHELL = [
  './',
  './index.html',
  './flutter_bootstrap.js',
  './main.dart.js',
  './flutter.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  if (LOCAL) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Individually, not addAll: one 404 would otherwise reject the whole
      // install and leave the app with no worker at all.
      await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      // Locally that clears the lot, which also cleans up after a worker that
      // was installed before this rule existed. The inbox is never dropped: a
      // song shared in but not yet imported must survive a release.
      await Promise.all(
        names
            .filter((n) => n !== INBOX)
            .filter((n) => LOCAL || n !== CACHE)
            .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/// Where songs shared into the app wait to be picked up. Separate from the
/// build cache so a new release, which drops the old one, cannot take a song
/// with it that the app has not imported yet.
const INBOX = 'soundas-shared';

/// "Share to soundAS" from a file manager or a chat app.
///
/// The manifest points Android's share sheet at ./share as a POST. There is no
/// server to receive that, so it lands here: the files come out of the form,
/// go into a cache under names the app can find, and the browser is sent on to
/// the app itself. The app empties the inbox on startup.
///
/// A redirect rather than a page: the share sheet is waiting for a navigation,
/// and answering with anything else leaves the user staring at a blank tab.
async function takeShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll('songs').filter((f) => f && f.name);
    if (files.length) {
      const inbox = await caches.open(INBOX);
      for (const file of files) {
        // The name is carried in the URL because a cached Response keeps its
        // headers but not the File it came from.
        const key = './shared-file/' + encodeURIComponent(file.name);
        await inbox.put(new Request(key), new Response(file));
      }
    }
  } catch (_) {
    // A malformed share is not worth failing the navigation over; the app will
    // simply find an empty inbox.
  }
  return Response.redirect('./?shared=1', 303);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Before the LOCAL bypass and before the GET check: this is the one POST the
  // app ever answers, and it has to be answered wherever it is served from.
  if (request.method === 'POST' && new URL(request.url).pathname.endsWith('/share')) {
    event.respondWith(takeShare(request));
    return;
  }

  if (LOCAL) return;

  // Only our own GETs. A range request (audio seeking) must never be served
  // from a cache entry that holds the whole body, so those go straight out.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.headers.has('range')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // A navigation is answered from the cached shell when we have it. This is
      // what makes a repeat launch open at once instead of waiting on the
      // network for index.html first — and it is the same path that makes the
      // installed app work offline.
      if (request.mode === 'navigate') {
        const shell =
          (await cache.match('./index.html')) || (await cache.match('./'));
        if (shell) return shell;
        try {
          return await fetch(request);
        } catch (_) {
          return Response.error();
        }
      }

      const hit = await cache.match(request);
      if (hit) return hit;

      const res = await fetch(request);
      if (res.ok && res.status === 200) {
        cache.put(request, res.clone()).catch(() => {});
      }
      return res;
    })(),
  );
});
