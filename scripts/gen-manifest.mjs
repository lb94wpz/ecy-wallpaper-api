// 从图床仓库（GitHub）拉取文件清单，生成 functions/_manifest.js
// 用法：node scripts/gen-manifest.mjs
// 可用环境变量：
//   GITHUB_IMAGE_REPO     GitHub 图床仓库（owner/repo），默认 lb94wpz/ecy-wallpaper
//   GITHUB_IMAGE_BRANCH   GitHub 图床仓库分支，默认 master
//   GITHUB_TOKEN          可选，提升 API 限流额度（未认证 60 次/小时/IP）
// 仓库里每个一级子目录就是一个分类，目录名就是接口 ?type= 的取值
// 仓库根目录可选放一份 folders.json（目录 -> 卡片标题），缺失时标题用目录名
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITHUB_IMAGE_REPO = process.env.GITHUB_IMAGE_REPO || 'lb94wpz/ecy-wallpaper';
const GITHUB_IMAGE_BRANCH = process.env.GITHUB_IMAGE_BRANCH || 'master';

const IMAGE_EXTENSIONS = /\.(webp|jpe?g|png|gif|avif|bmp|mp4)$/i;

const headers = { 'User-Agent': 'ecy-wallpaper-manifest' };
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
}

// 文件树：一次请求拿全仓库，单目录超 1000 文件也不会截断
const apiUrl = `https://api.github.com/repos/${GITHUB_IMAGE_REPO}/git/trees/${GITHUB_IMAGE_BRANCH}?recursive=1`;
const response = await fetch(apiUrl, { headers });

if (!response.ok) {
  console.error(`拉取文件树失败: HTTP ${response.status} ${await response.text()}`);
  process.exit(1);
}

const tree = await response.json();
if (tree.truncated) {
  console.error('文件树被 GitHub 截断，清单可能不完整，请拆分仓库或联系支持');
  process.exit(1);
}

// 一级目录 -> 文件名列表（排除仓库根目录的散文件）
const folders = {};
for (const entry of tree.tree) {
  if (entry.type !== 'blob') continue;
  const slash = entry.path.indexOf('/');
  if (slash === -1) continue;

  const file = entry.path.slice(slash + 1);
  if (file.includes('/') || !IMAGE_EXTENSIONS.test(file)) continue;

  const dir = entry.path.slice(0, slash);
  (folders[dir] ??= []).push(file);
}

for (const files of Object.values(folders)) files.sort();

const folderNames = Object.keys(folders);
if (folderNames.length === 0) {
  console.error(`仓库 ${GITHUB_IMAGE_REPO}@${GITHUB_IMAGE_BRANCH} 下没有图片，请先上传`);
  process.exit(1);
}

// 卡片标题：拉取仓库根目录的 folders.json，可选
const configUrl = `https://raw.githubusercontent.com/${GITHUB_IMAGE_REPO}/${GITHUB_IMAGE_BRANCH}/folders.json`;
const configRes = await fetch(configUrl, { headers });

let titles = {};
if (configRes.ok) {
  const data = await configRes.json();
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    titles = data;
  } else {
    console.error('folders.json 格式不对（应为 目录名 -> 标题 的对象），标题将使用目录名');
  }
} else if (configRes.status === 404) {
  console.error(`仓库里没有 folders.json，标题将使用目录名`);
} else {
  console.error(`拉取 folders.json 失败: HTTP ${configRes.status}，标题将使用目录名`);
}

const body = JSON.stringify(
  Object.fromEntries(folderNames.map((name) => [name, { title: titles[name] || name, files: folders[name] }])),
  null,
  2,
);
writeFileSync(
  join(root, 'functions/_manifest.js'),
  `// 由 scripts/gen-manifest.mjs 自动生成，请勿手改\n// 数据源: ${GITHUB_IMAGE_REPO}@${GITHUB_IMAGE_BRANCH}\nexport default ${body};\n`,
);

console.log(`已从 ${GITHUB_IMAGE_REPO}@${GITHUB_IMAGE_BRANCH} 生成 functions/_manifest.js:`);
for (const name of folderNames) {
  const note = name in titles ? '' : '  ← 未在图床 folders.json 中配置，首页标题将显示目录名';
  console.log(`  ${name}: ${folders[name].length} 个文件${note}`);
}
