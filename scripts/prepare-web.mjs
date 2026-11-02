import { readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
const base = (process.env.PAGES_BASE_PATH || "").replace(/\/$/, "");
await copyFile("assets/icon.png", "dist/icon.png");
let html = await readFile("dist/index.html", "utf8");
html = html.replace(
  "</head>",
  `<link rel="manifest" href="${base}/manifest.json"><link rel="apple-touch-icon" href="${base}/icon.png"><meta name="theme-color" content="#101714"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><style>html,body,#root{background:#101714;min-height:100%;}input{font-size:16px!important;}button,input{touch-action:manipulation;}</style></head>`,
);
html = html.replace(
  "</body>",
  `<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('${base}/sw.js').catch(()=>{}));}</script></body>`,
);
await writeFile("dist/index.html", html);
async function files(dir) {
  let out = [];
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    out.push(...(f.isDirectory() ? await files(p) : [p.replace(/^dist/, "")]));
  }
  return out;
}
const assets = await files("dist");
const version = "lift-" + base + "-" + Date.now();
await writeFile(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(version)};const ASSETS=${JSON.stringify(assets.filter((p) => p != "/sw.js").map(p => base + p))};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(${JSON.stringify('lift-' + base + '-')})&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('${base}/index.html'):Response.error()))));});`,
);
console.log("Prepared installable website with offline app-shell support.");
