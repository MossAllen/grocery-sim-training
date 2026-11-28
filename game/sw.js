/* Keep this version in step with the ?v= values in index.html. */
const VERSION = '0.9.0-preview';
const base = new URL(self.registration.scope);
const cachePrefix = `grocery-training:${base.pathname}:`;
const cacheName = cachePrefix + VERSION;
const index = new URL('index.html', base);
const audioManifest = new URL(`assets/audio/manifest.js?v=${VERSION}`, base);
const spriteManifest = new URL(`assets/sprites/manifest.js?v=${VERSION}`, base);
const voiceManifest = new URL(`assets/voice/manifest.js?v=${VERSION}`, base);

function isGameAsset(url) {
  return url.origin === base.origin && url.pathname.startsWith(base.pathname) &&
    /\.(?:js|css|webmanifest|png|webp|jpe?g|woff2?|ttf|ogg|mp3)$/i.test(url.pathname);
}

function assetUrls(references, from = base) {
  return references.map((reference) => new URL(reference, from)).filter(isGameAsset);
}

async function storeAssets(cache, urls) {
  const unique = [...new Set(urls.map((url) => url.href))];
  await cache.addAll(unique.map((url) => new Request(url, { cache: 'reload' })));
}

async function prepareVersion() {
  const page = await fetch(base, { cache: 'reload' });
  if (!page.ok) throw new Error('Game page unavailable for offline use');
  const html = await page.clone().text();
  if (!html.includes(`js/install-app.js?v=${VERSION}`)) {
    throw new Error('Game page and offline version differ');
  }

  // Includes lazy scripts held in the lesson and walk templates.
  const links = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map((match) => match[1]);
  const core = assetUrls(links);
  const cache = await caches.open(cacheName);
  await storeAssets(cache, core);

  const manifest = await cache.match(new URL(`manifest.webmanifest?v=${VERSION}`, base));
  const { icons } = await manifest.json();
  const media = assetUrls(icons.map(({ src }) => src));
  const styleFiles = core.filter((url) => url.pathname.endsWith('.css'));
  for (const stylesheet of styleFiles) {
    const css = await (await cache.match(stylesheet)).text();
    const urls = [...css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)].map((match) => match[1]);
    media.push(...assetUrls(urls, stylesheet));
  }

  // Read existing asset lists without executing game scripts inside the worker.
  for (const url of [audioManifest, spriteManifest]) {
    const source = await (await cache.match(url)).text();
    const paths = [...source.matchAll(/^\s*\w+:\s*["'](assets\/[^"']+)["']/gm)].map((match) => match[1]);
    media.push(...assetUrls(paths));
  }
  const voices = await (await cache.match(voiceManifest)).text();
  const voiceFiles = [...voices.matchAll(/^\s*['"]([a-z0-9]+)['"],?\s*$/gm)]
    .map((match) => `assets/voice/${match[1]}.ogg`);
  media.push(...assetUrls(voiceFiles));

  // The touch icon may also be requested by iPadOS without its version query.
  media.push(new URL('assets/app/apple-touch-icon.png', base));
  await storeAssets(cache, media);
  await cache.put(base, page);
}

self.addEventListener('install', (event) => {
  event.waitUntil(prepareVersion());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)));
    // Updates use normal waiting so open games can finish with their original files.
    await self.clients.claim();
  })());
});

async function mediaRange(response, header) {
  const bytes = await response.blob();
  const range = /^bytes=(\d*)-(\d*)$/i.exec(header);
  const unavailable = () => new Response(null, {
    status: 416,
    headers: { 'Content-Range': `bytes */${bytes.size}` },
  });
  if (!range || (!range[1] && !range[2])) return unavailable();

  const start = range[1] ? Number(range[1]) : Math.max(0, bytes.size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(bytes.size - 1, Number(range[2])) : bytes.size - 1;
  if (start > end || start >= bytes.size) return unavailable();

  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${bytes.size}`,
      'Content-Type': response.headers.get('Content-Type') || 'audio/ogg',
    },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== base.origin) return;

  const entry = request.mode === 'navigate' && (url.pathname === base.pathname || url.pathname === index.pathname);
  if (!entry && !isGameAsset(url)) return;

  event.respondWith((async () => {
    const stored = await caches.open(cacheName)
      .then((cache) => cache.match(entry ? base : url, { ignoreVary: true }))
      .catch(() => undefined);
    if (!stored) return fetch(request);
    const range = request.headers.get('Range');
    return range && /\.(?:ogg|mp3)$/i.test(url.pathname) ? mediaRange(stored, range) : stored;
  })());
});
