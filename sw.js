/* THPS School Manager - offline copy of the app (the data stays in the Google Sheet) */
var CACHE = 'thps-manager-v13.0';
var SHELL = ['./', 'index.html', 'app.js', 'app.css', 'config.js', 'marks.html', 'manifest.webmanifest',  "icons/bank.png",  "icons/bar_chart.png",  "icons/books.png",  "icons/building_construction.png",  "icons/busts_in_silhouette.png",  "icons/calendar.png",  "icons/card_index.png",  "icons/chart_increasing.png",  "icons/check_mark_button.png",  "icons/clipboard.png",  "icons/cloud.png",  "icons/coin.png",  "icons/counterclockwise_arrows_button.png",  "icons/door.png",  "icons/envelope_with_arrow.png",  "icons/floppy_disk.png",  "icons/gear.png",  "icons/graduation_cap.png",  "icons/house.png",  "icons/identification_card.png",  "icons/inbox_tray.png",  "icons/key.png",  "icons/label.png",  "icons/ledger.png",  "icons/light_bulb.png",  "icons/link.png",  "icons/locked.png",  "icons/magnifying_glass_tilted_left.png",  "icons/memo.png",  "icons/money_bag.png",  "icons/outbox_tray.png",  "icons/page_facing_up.png",  "icons/pencil.png",  "icons/plus.png",  "icons/printer.png",  "icons/pushpin.png",  "icons/receipt.png",  "icons/school.png",  "icons/shield.png",  "icons/spiral_calendar.png",  "icons/student.png",  "icons/teacher.png",  "icons/triangular_flag.png",  "icons/trophy.png",  "icons/warning.png",  "icons/wastebasket.png",  "img/app-192.png",  "img/app-512.png",  "img/province.png",  "img/school.png",];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;     // the database calls always go to the network
  // network first for the app files (so updates arrive), the saved copy when offline
  e.respondWith(fetch(e.request).then(function (r) {
    var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); }); }));
});
