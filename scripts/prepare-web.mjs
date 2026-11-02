import { readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
const base = (process.env.PAGES_BASE_PATH || "").replace(/\/$/, "");
await copyFile("assets/lift-icon.png", "dist/icon.png");
await copyFile("src/InterVariable.woff2", "dist/InterVariable.woff2");
let html = await readFile("dist/index.html", "utf8");
html = html.replace(/href="[^"]*favicon.ico"/g, `href="${base}/lift-icon.svg"`);
html = html.replace(
  "</head>",
  `<link rel="manifest" href="${base}/manifest.json"><link rel="apple-touch-icon" href="${base}/icon.png"><meta name="theme-color" content="#0B0F0D"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><style>@font-face{font-family:Inter;src:url("${base}/InterVariable.woff2") format("woff2");font-weight:100 900;font-display:swap}html{background:#0B0F0D;height:auto;min-height:100%;overflow-y:auto;overflow-x:clip}body{background:#0B0F0D;height:auto;min-height:100dvh;overflow:visible}#root{height:auto;min-height:100dvh;display:block}input{font-size:16px!important;}button,input{touch-action:manipulation;}</style></head>`,
);
html = html.replace(
  "</body>",
  `<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('${base}/sw.js',{updateViaCache:'none'}).catch(()=>{}));}</script></body>`,
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
  `const CACHE=${JSON.stringify(version)};const ASSETS=${JSON.stringify(assets.filter((p) => p != "/sw.js").map((p) => base + p))};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(${JSON.stringify("lift-" + base + "-")})&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request,e.request.mode==='navigate'?{cache:'no-cache'}:{}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('${base}/index.html'):Response.error()))));});`,
);
console.log("Prepared installable website with offline app-shell support.");
