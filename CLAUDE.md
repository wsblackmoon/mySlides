# mySlides — 吴斯 Aaron Wu 个人主页

这是我的**个人主页**仓库(GitHub Pages)。这个文件夹专门用来维护主页。

- 线上地址:<https://wsblackmoon.github.io/mySlides/>
- 根域名 <https://wsblackmoon.github.io/> 已设为**自动跳转**到本主页(跳转页在另一个仓库 `wsblackmoon.github.io`,只有一个 index.html,一般不用动)。
- 部署方式:**`git push origin main` 即自动上线**(main 上有每日数据的自动提交,推送前先 `git pull --rebase origin main`)(GitHub Pages,约 30–60s 生效;看不到更新先硬刷新 Cmd+Shift+R)。

## 结构

```
index.html              # 主页：导航(个人主页/作品集/AI战略咨询) + 作品集(企业服务 / 个人思考)
<slug>/                 # 每个作品/文章一个文件夹
  ├─ slides.html        # 幻灯片版(可选)
  ├─ web.html           # 网页阅读版
  └─ images/            # 该文的配图
nz-rates/               # 「新西兰存款利率」页面(主页导航第 4 个入口)
  └─ data/              # rates.json(当前利率)+ history.jsonl(每日快照),由采集脚本生成,勿手改;savings.json(活期储蓄)人工维护
private/                # 私享会:构建生成的加密页面(勿手改)
tools/vault-build.mjs   # 私享会加密构建脚本(每份资料独立口令)
tools/nz-rates-scrape.py # 新西兰存款利率采集脚本
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
- **自动适配**:某页内容超出一屏(窗口矮、目录展开)时,引擎会把整页按比例缩小到放得下(最低 55%)。前提是溢出要能被测到:不要给表格等容器设 `max-height` + 内部滚动,弹性布局里的内容子项设 `flex-shrink:0`。
- 参考:`investment-system/slides.html`(整屏排版)、`ai-paradigm/slides.html`(居中卡片)、`private-domain/slides.html`(整页图片 + 深色)。

## 新西兰存款利率(`nz-rates/`)

主页导航里的独立页面:各银行定存利率总表(普通定存 / PIE 定存切换,排序/筛选)、最高利率速览、税后收益计算器、中文说明。银行名统一显示英文。页面用 JS 读取 `nz-rates/data/rates.json` 渲染。

- 数据:`python3 tools/nz-rates-scrape.py` 从 termdepositrates.co.nz 的普通定存总表和 PIE 表采集(一天一次,只取利率/评级/起存额这些事实数据),写入 `rates.json`(PIE 在 `pie` 字段;PIE 表采集失败时沿用上一份并打印警告,不影响主表),并往 `history.jsonl` 追加当天快照(留给以后做走势图)。`--check` 只校验不写文件。
- **每日自动更新**:`.github/workflows/nz-rates.yml` 每天 UTC 02:30 跑一次采集,数据有变化就由 `github-actions[bot]` 提交到 main。所以 **main 上会有机器人的提交:本地推送前先 `git pull --rebase origin main`**。也可以在 GitHub Actions 页面手动点 Run workflow,或 `gh workflow run nz-rates`。
- 校验不过(银行数太少、利率离谱、单日大面积跳变)时脚本报错退出、不动文件,页面继续显示上一份数据;数据超过 3 天没更新,页面会自动提示。
- 新增银行:需要归入「四大行」或「中资」时,在脚本的 `GROUPS` 里补一行,否则归入 `other`。
- **活期储蓄**(利率总表里「产品」的第三个选项;随存随取 / 奖励账户 / 通知存款 / Revolut 档位):数据在 `nz-rates/data/savings.json`,**人工维护,不是每日采集**。每条利率都要在该银行**官网**核实并带上 `source` 链接;核对一轮后把 `verified` 改成当天日期(超过 45 天页面会提示)。Revolut 的新客优惠有 `until` 日期,过期后页面自动隐藏。
  - **不要用 interest.co.nz**:它的使用条款明确禁止自动采集、系统性复制和 AI 平台采集。其他聚合站也不作为利率来源。
  - 读官网的门路:Heartland、TSB、SBS、Westpac 用 curl 就能读;Kiwibank 有公开数据接口 `rates.kiwibank.co.nz/api/v1/rates`;Co-operative Bank 读 `/api/content/content/website/rates`;ANZ、ASB、BNZ、Rabobank、Revolut 要用浏览器打开;Bank of India 官网有验证页,读不到,目前没收录。
- 内容边界:**只采数字**,说明文字自己写,不搬原站文案和银行 logo;页脚保留数据来源链接和「不构成投资建议」声明。
- 税率、存款保障等说明以官方为准:利息预扣税(RWT)和 PIR 看 IRD,存款保障计划看 RBNZ(`rbnz.govt.nz/dcs`);官方调整后同步改 `nz-rates/index.html` 里的说明和计算器选项。

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
