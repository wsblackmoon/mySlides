# mySlides — 吴斯 Aaron Wu 个人主页

这是我的**个人主页**仓库(GitHub Pages)。这个文件夹专门用来维护主页。

- 线上地址:<https://wsblackmoon.github.io/mySlides/>
- 根域名 <https://wsblackmoon.github.io/> 已设为**自动跳转**到本主页(跳转页在另一个仓库 `wsblackmoon.github.io`,只有一个 index.html,一般不用动)。
- 部署方式:**`git push origin main` 即自动上线**(GitHub Pages,约 30–60s 生效;看不到更新先硬刷新 Cmd+Shift+R)。

## 结构

```
index.html              # 主页：导航(个人主页/作品集/AI战略咨询) + 作品集(企业服务 / 个人思考)
<slug>/                 # 每个作品/文章一个文件夹
  ├─ slides.html        # 幻灯片版(可选)
  ├─ web.html           # 网页阅读版
  └─ images/            # 该文的配图
private/                # 私享会:构建生成的加密页面(勿手改)
tools/vault-build.mjs   # 私享会加密构建脚本(每份资料独立口令)
assets/                 # 微信二维码等公共图
  ├─ vault/             # 私享会口令页(vault.css + vault.js)
  └─ deck/              # 幻灯片演示工具(deck.css + deck.js),所有 slides.html 共用
```

现有作品:`ai-paradigm/`、`private-domain/`、`investment-system/`(投资交易系统·上:工具与信息)、`investment-system-2/`(下:分析与执行)、`kexue-shangwang/`(科学上网清单，个人思考首篇)。私享会内容在 `private/`(加密,见下)。

## 加一篇「个人思考」文章

1. 新建 `<slug>/web.html`,**风格照 `investment-system/web.html` 或 `kexue-shangwang/web.html`**(暖金阅读版:`.hero/.part/.kick/.pt/.shot/.punch/.end`,不需要深色模式)。配图放 `<slug>/images/`,用 `<img loading="lazy" src="images/xxx.png">` 引用,**不要 base64 内嵌**。
2. 在 `index.html` 里找到 `<!-- 个人思考 -->`(#works 内 `xp-label` 为「个人思考」的 `.grid.cols-3`),复制一张 `.card` 改内容,链接到 `<slug>/web.html`。卡片有 `reveal` 类(靠首屏 JS 显示,别删)。
3. 本地预览:`python3 -m http.server 8812` → <http://localhost:8812/>。
4. `git add -A && git commit && git push` 上线。

## 幻灯片演示工具(`assets/deck/`)

所有 `slides.html` 都用同一套演示外壳:翻页(键盘 ← → 空格 / 点击左右 / 滑动)、分步揭示、底部进度条、左侧目录(M 键开关)、计时器、F 全屏、返回作品集。页面只写内容和内容样式,外壳由脚本自动注入。

```html
<link rel="stylesheet" href="../assets/deck/deck.css">   <!-- 放在页面自己的 <style> 之前 -->
<style>/* 内容样式;.slide 是整屏舞台(flex 列),在这里设 padding/对齐 */</style>
<body>                                   <!-- 深色背景用 <body class="deck-dark"> -->
<div class="deck">                       <!-- 可选 data-back="…" 改返回链接,默认 ../index.html#works -->
  <section class="slide">…</section>
  <section class="slide" data-group="分组" data-nav="目录名">…<div class="body">…</div></section>
</div>
<script src="../assets/deck/deck.js"></script>
```

- **目录**:分组取 `data-group`,或 `.kick` 里的 `PART n / 分组 · 小标题`;条目名取 `data-nav` > 小标题 > 页内 h1/h2。
- **分步揭示**:页内有 `.body` 时,第一下只显示标题,第二下显示 `.body`;不想分步就不写 `.body`。
- **配色**:在页面里覆盖 `--ui-prog`(进度条)、`--ui-bar`(进度条底)、`--ui-accent`(目录高亮)等变量。
- 图片可以写 `loading="lazy"`,引擎会提前加载当前页和下一页。
- 参考:`investment-system/slides.html`(整屏排版)、`ai-paradigm/slides.html`(居中卡片)、`private-domain/slides.html`(整页图片 + 深色)。

## 私享会(每份资料独立口令)

私密内容(持仓、群内信息等)只放在主页「私享会」分类下,**仓库里只能有密文**(仓库是公开的)。

- 明文源放在仓库外:`~/AItools/mySlides-private/`——`manifest.json`(每条含 slug/file/title/desc/bullets/date/**pass**)+ 各页 HTML,图片放同目录,构建时会内联进密文。
- **一份资料一个口令**(manifest 里的 `pass`)。口令只存在这个本地目录,**不要写进仓库、提交信息或本文件**。
- 同一份资料的幻灯片版:单独一条(自己的 slug/file/pass),加 `"card": "<网页版 slug>", "version": "slides"`,目录页会和网页版合并成一张卡片(两个按钮)。
- 临时下线某份:在 manifest 该条加 `"offline": true` 后重新构建(源文件和口令保留,删掉该字段即可恢复)。
- 新增/修改/换口令:改源目录 → 仓库根目录运行 `node tools/vault-build.mjs` → 提交 `private/` 并推送。
- 访问方式:目录页 `private/` 只有一个口令框,不公开任何标题;输入哪份的口令就打开哪份,本机解锁过的资料会列在下面。资料页 `private/<slug>.html` 也可直接分享,打开时要求输入该资料的口令。
- 原理:PBKDF2(60 万次)派生密钥 + AES-GCM,浏览器本地解密;解锁后本机按资料记住密钥,目录页「锁定本机」清除。
- **绝不**把私享会内容放进普通 `<slug>/` 目录或「个人思考」卡片。

## 内容/发布约定(重要)

- 本仓库是**海外 GitHub Pages**,是我个人公开内容(含个人思考)的默认发布地。
- **不要**把内容发到大陆备案站 `www.fupanjun.com`(南京服务器、已备案的商务站);二者定位不同,敏感内容发备案站有下架风险。
- 提交署名用 `AaronWU`。
