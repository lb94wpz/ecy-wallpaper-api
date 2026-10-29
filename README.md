# 二次元壁纸 API

> 收集二次元壁纸的个人小站，也是一个开箱即用的随机图片 API。
>
> 纯静态 + 边缘函数实现；同一套代码兼容 **Cloudflare Pages**、**Vercel** 和 **EdgeOne Pages**，Fork 后一键部署即可拥有同款。

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare-F38020?logo=cloudflare&logoColor=white&style=for-the-badge)](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
[![Deploy with Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white&style=for-the-badge)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flb94wpz%2Fecy-wallpaper-api&project-name=ecy-wallpaper-api&repository-name=ecy-wallpaper-api)
[![Deploy to EdgeOne Pages](https://img.shields.io/badge/Deploy-EdgeOne%20Pages-0052D9?logo=tencentqq&logoColor=white&style=for-the-badge)](https://console.cloud.tencent.com/edgeone/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Flb94wpz%2Fecy-wallpaper-api&project-name=ecy-wallpaper-api&build-command=node%20scripts%2Fgen-manifest.mjs)

## 项目由来

给自己的[个人主页](https://wpz.cool?bg=3)实现壁纸切换功能时，发现了 [t.alcy.cc](https://t.alcy.cc/) 网站，该网站界面简洁、美观，并且壁纸质量精美，一眼就相中了上面的壁纸。

相较于使用第三方的链接，个人还是习惯自己部署搭建自己的平台，毕竟第三方可能随时都无法使用。

进一步了解到 [t.alcy.cc](https://t.alcy.cc/) 网站的作者开源了服务端项目 [ecyAPI](https://cnb.cool/pupu/ecyAPI)，不过它是 Go 语言项目，需要自己找服务器编译部署，没法在 Pages 平台上一键跑起来。

于是 Vibe Coding 了该项目，支持一键部署到 **Cloudflare Pages**、**Vercel** 和 **EdgeOne Pages**，毕竟白嫖的更香。

## 声明与致谢

- 本站的页面结构、交互和视觉风格参考了 **[t.alcy.cc](https://t.alcy.cc/)**，在此向原作者表示感谢。
- 站内壁纸、动态壁纸来自 **[t.alcy.cc](https://t.alcy.cc/)** 及网络公开资源，**版权归各自原作者所有**。本项目只做个人收藏与展示，不提供任何商业用途。
- 如果你是某张图片 / 视频的作者，且不希望作品出现在这里，请通过 [GitHub Issues](https://github.com/lb94wpz/ecy-wallpaper/issues) 联系我，说明具体资源，我会在收到通知后尽快删除。

## 一键部署

三个按钮都在页面最上方，点进去登录后按下面的步骤操作即可。

### Cloudflare Pages

1. Fork 该项目到自己的仓库中;
2. 点击上方 **Deploy Cloudflare** 按钮，进入控制台，选择 **Workers & Pages → Create application → Continue to Pages → Import an existing Git repository** 授权并选择 Fork 后的仓库；
3. 在 **Build settings** 里 **Build command** 填 `node scripts/gen-manifest.mjs`，然后点击 **Save and Deploy** 开始部署；
4. 部署完后环境变量在项目里的 **Settings → Variables and Secrets** 中配置，保存后需要重新部署才生效。

### Vercel

1. 点击上方 **Deploy Vercel** 按钮，登录后直接点击 **Create** 开始部署；
2. 部署完后环境变量在项目里的 **Settings → Environment Variables** 中配置，保存后需要重新部署才生效。

### EdgeOne Pages

1. 点击上方 **Deploy EdgeOne Pages** 按钮，登录国内站（国际站请[点这里](https://console.tencentcloud.com/edgeone/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Flb94wpz%2Fecy-wallpaper-api&project-name=ecy-wallpaper-api&build-command=node%20scripts%2Fgen-manifest.mjs)）后，直接点击 **立即创建** 开始部署；
2. 部署完后环境变量在项目里的 **项目设置 → 环境变量** 中配置，保存后需要重新部署才生效。

PS: 通过点击 **Deploy EdgeOne Pages** 按钮跳转链接部署的，由于链接里携带了 **build-command** 参数，所以无需手动填写**构建命令**，如果是 Fork 了该项目自己手动部署的，记得在 **构建命令** 处填 `node scripts/gen-manifest.mjs`。

### 环境变量

环境变量不是必须设置的，视个人情况而定，三个平台变量名完全一致：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `ALLOWED_DOMAINS` | 空（完全公开） | 逗号分隔的域名白名单，如 `example.com,www.example.com`；子域名自动匹配 |
| `ALLOW_EMPTY_REQUEST` | `true` | 是否放行既没有 `Origin` 也没有 `Referer` 的请求。想真正做到"只有白名单能访问"，需要设为 `false` |
| `IMAGE_CDN_BASE` | `https://cdn.jsdelivr.net/gh/lb94wpz/ecy-wallpaper@master` | 图床地址。默认走 GitHub CDN（jsDelivr 的 gh 通道） |
| `GITHUB_IMAGE_REPO` | `lb94wpz/ecy-wallpaper` | GitHub 图床仓库，格式 `owner/repo`
| `GITHUB_IMAGE_BRANCH` | `master` | GitHub 图床仓库分支 |
| `GITHUB_TOKEN` | 空 | 可选，**构建时**读取。传了就带 `Authorization` 请求 GitHub API，避免未认证状态下 60 次/小时/IP 的限流 |

> 防盗链的边界：白名单只校验请求头，引用方设置 `Referrer-Policy: no-referrer`、服务端抓取、或直接访问重定向后的图片直链都能绕过。要彻底防盗链只能在 CDN / 对象存储层面做签名或 Referer 校验。

## 项目结构

```
ecy-wallpaper-api
├── favicon.svg               # 站点图标
├── index.html                # 首页
├── functions/
│   ├── [[default]].js        # catch-all：/random 接口 + 静态资源交还托管
├── api/
│   └── random.js             # Vercel Edge Function 适配层
├── vercel.json               # Vercel 构建配置 + 重写规则：/random → /api/random
├── LICENSE                   # MIT License
├── scripts/
│   ├── gen-manifest.mjs      # 从图床仓库拉取清单与标题，生成 functions/_manifest.js
│   ├── gen-manifest.sh       # 同上（shell 入口，内部转调 node 脚本）
│   ├── dev.mjs               # 本地开发服务器，执行顺序对齐 Pages
│   └── dev.sh                # 本地预览入口（启动前自动生成 _manifest.js），可传端口
└── README.md
```

> 图片存放在独立的图床仓库 [**lb94wpz/ecy-wallpaper**](https://github.com/lb94wpz/ecy-wallpaper)。

## API 说明

| 接口 | 说明 | 返回 |
|---|---|---|
| `GET /random` | 在图床仓库的所有目录里随机返回一张壁纸 | 302 |
| `GET /random?type=bd` | 只在图床仓库的 `bd` 目录下随机返回一张壁纸 | 302 |
| `GET /random?type=bd,lai` | 多个目录合并随机返回一张壁纸，逗号分隔 | 302 |
| `GET /random?return=json` | 随机返回一张壁纸的 URL | JSON |
| `GET /random?info` | 返回每个目录的标题与壁纸数量 | JSON |
| `OPTIONS /random` | CORS 预检 | 204 |

## 本地预览

```bash
./scripts/dev.sh          # 默认 http://127.0.0.1:8787，启动前自动生成 _manifest.js
./scripts/dev.sh 3000     # 指定端口
# 或者
node scripts/gen-manifest.mjs && node scripts/dev.mjs
```

## 新增壁纸

1. Fork 图床仓库 [**lb94wpz/ecy-wallpaper**](https://github.com/lb94wpz/ecy-wallpaper) 到自己的项目下；
2. 按图床仓库要求上传壁纸；
3. 重新部署本仓库即可——构建时会自动从图床仓库拉取最新的目录清单；本地验证可执行 `./scripts/gen-manifest.sh` 查看清单内容。

PS: 记得修改环境变量 **IMAGE_CDN_BASE/GITHUB_IMAGE_REPO/GITHUB_IMAGE_BRANCH** 为自己 Fork 的仓库。

## License

代码基于 [MIT License](LICENSE) 开源，可自由使用、修改与二次分发。

注意：站内壁纸、动态壁纸等**素材不在 MIT 覆盖范围内**，版权归原作者所有（见「声明与致谢」），使用本项目时请自行替换为你有权使用的素材。
