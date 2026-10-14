// 私享会构建:每份资料用它自己的口令加密,生成到 private/(仓库里只有密文)。用法见 CLAUDE.md「私享会」。
//   node tools/vault-build.mjs [源目录]
// 源目录默认 ~/AItools/mySlides-private(不进仓库),内含 manifest.json(每条带自己的 pass)和各页面 HTML。
import { webcrypto as crypto } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ITER = 600000;
const src = path.resolve(process.argv[2] || process.env.VAULT_SRC || path.join(os.homedir(), 'AItools/mySlides-private'));
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(repo, 'private');

const manifestPath = path.join(src, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
// 盐固定存在 manifest 里:重新构建不会让已解锁的设备失效;换口令后旧设备自动要求重输
if (!manifest.salt) {
  manifest.salt = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
const b64 = (u) => Buffer.from(u).toString('base64');
const keyCache = new Map();
async function keyFor(pass) {
  if (!keyCache.has(pass)) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    keyCache.set(pass, await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: Buffer.from(manifest.salt, 'base64'), iterations: ITER, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']));
  }
  return keyCache.get(pass);
}
async function seal(pass, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(pass), new TextEncoder().encode(text));
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}
const box = (extra) => JSON.stringify({ salt: manifest.salt, iter: ITER, ...extra });

// 页面里引用的本地图片内联成 data URI 一起加密,否则图片会以明文暴露在仓库里
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function inlineImages(html) {
  return html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/g, (m, a, ref, z) => {
    if (/^(data:|https?:|\/\/)/.test(ref)) return m;
    const file = path.join(src, ref);
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime || !fs.existsSync(file)) { console.warn('  ! 图片未找到,保持原样:', ref); return m; }
    return a + `data:${mime};base64,` + fs.readFileSync(file).toString('base64') + z;
  });
}

const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const head = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>私享会 · 吴斯 Aaron Wu</title>
<link rel="stylesheet" href="../assets/vault/vault.css">
</head>
<body>
<div id="vault-gate" class="vg" hidden>
  <form class="vg-card">
    <div class="vg-ic">${LOCK}</div>
    <h1>私享会</h1>
    <p class="vg-sub">这份资料需要口令才能查看</p>
    <input type="password" autocomplete="current-password" placeholder="口令" aria-label="口令">
    <button type="submit">进入</button>
    <div class="vg-err" role="alert"></div>
    <a class="vg-back" href="../index.html#works">← 返回个人主页</a>
  </form>
</div>
`;
const tail = (data) => `<script type="application/json" id="vault-data">${data}</script>
<script src="../assets/vault/vault.js"></script>
</body>
</html>
`;
const hubPage = (data) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>私享会 · 吴斯 Aaron Wu</title>
<link rel="stylesheet" href="../assets/vault/vault.css">
</head>
<body>
<main class="vh">
  <div class="vh-top"><a href="../index.html#works">← 返回个人主页</a><button id="vh-lock" hidden onclick="vaultLock()">🔒 锁定本机</button></div>
  <div class="vh-eyebrow">私享会</div>
  <h1>仅对受邀朋友开放的内容</h1>
  <p class="vh-lead">每份资料有独立口令,输入口令即可打开对应资料。请勿外传。</p>
  <div id="vault-gate" class="vh-gate">
    <form class="vg-card">
      <div class="vg-ic">${LOCK}</div>
      <input type="password" autocomplete="current-password" placeholder="输入资料口令" aria-label="口令">
      <button type="submit">进入</button>
      <div class="vg-err" role="alert"></div>
    </form>
  </div>
  <div id="vh-list" hidden><div class="vh-sub">本机已解锁</div><div class="vh-grid"></div></div>
</main>
<script>
window.vaultRenderHub=function(items){
  if(!items.length)return;
  function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
  var grid=document.querySelector('#vh-list .vh-grid');
  items.forEach(function(it){
    var c=el('a','vh-card');c.href=it.href;
    c.append(el('div','d',it.date||''),el('h3',null,it.title),el('p',null,it.desc||''));
    var ul=el('ul');(it.bullets||[]).forEach(function(b){ul.append(el('li',null,b));});c.append(ul,el('div','go','阅读 →'));
    grid.append(c);
  });
  document.getElementById('vh-list').hidden=false;document.getElementById('vh-lock').hidden=false;
};
</script>
<script type="application/json" id="vault-data">${data}</script>
<script src="../assets/vault/vault.js"></script>
</body>
</html>
`;

fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (f.endsWith('.html')) fs.rmSync(path.join(out, f));

const entries = [];
for (const it of manifest.items) {
  if (it.offline) { console.log('  - 已下线,跳过:', it.slug); continue; }
  if (!it.pass) { console.error(`  ✗ ${it.slug} 缺少 pass(每份资料需要独立口令)`); process.exit(1); }
  const html = inlineImages(fs.readFileSync(path.join(src, it.file), 'utf8'));
  fs.writeFileSync(path.join(out, `${it.slug}.html`), head + tail(box({ kind: 'page', slug: it.slug, ...await seal(it.pass, html) })));
  const meta = { slug: it.slug, title: it.title, desc: it.desc, bullets: it.bullets, date: it.date, href: `${it.slug}.html` };
  entries.push(await seal(it.pass, JSON.stringify(meta)));
  console.log('  ✓', `private/${it.slug}.html`);
}
// 目录条目打乱顺序,不暴露先后
entries.sort(() => Math.random() - 0.5);
fs.writeFileSync(path.join(out, 'index.html'), hubPage(box({ kind: 'hub', entries })));
console.log('  ✓ private/index.html  共', entries.length, '份');
