import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
const manifest = JSON.parse(await readFile("out/manifest.webmanifest", "utf8"));
manifest.start_url = `${base}/`;
manifest.scope = `${base}/`;
manifest.icons = manifest.icons.map((i) => ({ ...i, src: `${base}${i.src}` }));
await writeFile("out/manifest.webmanifest", JSON.stringify(manifest));
async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else if (!path.endsWith(".map")) result.push(path);
  }
  return result;
}
const assets = (await walk("out"))
  .filter((f) => !f.endsWith("sw.js"))
  .map((f) => `${base}${f.slice(3)}`);
const version = createHash("sha256")
  .update(await readFile("out/index.html"))
  .digest("hex")
  .slice(0, 12);
await writeFile(
  "out/sw.js",
  `const CACHE=${JSON.stringify("together-cart-" + base + "-" + version)};const PREFIX=${JSON.stringify("together-cart-" + base + "-")};const ASSETS=${JSON.stringify(assets)};const HOME=${JSON.stringify(base + "/index.html")};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;const key=u.pathname;if(e.request.mode==='navigate'&&key.startsWith(${JSON.stringify(base + "/")})){e.respondWith(fetch(e.request).catch(()=>caches.match(HOME)));return}if(ASSETS.includes(key))e.respondWith(caches.match(key).then(hit=>hit||fetch(e.request)))});
`,
);
console.log(`Prepared static app and scoped offline cache at ${base || "/"}.`);
