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
assets/                 # 微信二维码等公共图
```

现有作品:`ai-paradigm/`、`private-domain/`、`investment-system/`、`kexue-shangwang/`(科学上网清单，个人思考首篇)。

## 加一篇「个人思考」文章

1. 新建 `<slug>/web.html`,**风格照 `investment-system/web.html` 或 `kexue-shangwang/web.html`**(暖金阅读版:`.hero/.part/.kick/.pt/.shot/.punch/.end`,支持深色模式)。配图放 `<slug>/images/`。
2. 在 `index.html` 里找到 `<!-- 个人思考 -->`(#works 内 `xp-label` 为「个人思考」的 `.grid.cols-3`),复制一张 `.card` 改内容,链接到 `<slug>/web.html`。卡片有 `reveal` 类(靠首屏 JS 显示,别删)。
3. 本地预览:`python3 -m http.server 8812` → <http://localhost:8812/>。
4. `git add -A && git commit && git push` 上线。

## 内容/发布约定(重要)

- 本仓库是**海外 GitHub Pages**,是我个人公开内容(含个人思考)的默认发布地。
- **不要**把内容发到大陆备案站 `www.fupanjun.com`(南京服务器、已备案的商务站);二者定位不同,敏感内容发备案站有下架风险。
- 提交署名用 `AaronWU`。
