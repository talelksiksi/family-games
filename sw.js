// Keeps a copy of the games on the device so they open without internet.
// When online, the newest version is fetched (and saved); when offline or on a very slow
// connection, the saved copy is used. Bump CACHE when the file list changes.
var CACHE = "family-games-v1";
var FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) {
    if (r || req.mode !== "navigate") return r;
    // Opening the app from its icon: always fall back to the saved page
    return caches.match("./").then(function (p) { return p || caches.match("index.html"); });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(new Promise(function (resolve) {
    var done = false;
    function finish(r) { if (!done && r) { done = true; resolve(r); } }

    // Slow connection: after 3 seconds, use the saved copy instead of waiting.
    var timer = setTimeout(function () { fromCache(req).then(finish); }, 3000);

    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      finish(res);
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (r) { finish(r || new Response("Offline", { status: 503 })); });
    });
  }));
});
