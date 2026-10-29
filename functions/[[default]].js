// ============================================================
// 随机图片 API
// 兼容 Cloudflare Pages / EdgeOne Pages / Vercel
//
// 路由：
//   /random              所有目录随机
//
// 参数：
//   type=目录[,目录]      指定目录，可多选，如 ?type=bd、?type=bd,lai
//   return=302|json      返回方式，默认 302 重定向
//
// 约定：
//   图床仓库里每个一级子目录就是一个分类，目录名就是 ?type= 的取值
//   目录下的图片（webp/jpg/jpeg/png/gif/avif/bmp）和视频（mp4）文件名不限，
//   清单记录在 functions/_manifest.js（由 scripts/gen-manifest.mjs 从图床仓库生成）
//
// 图源：
//   图片不再由本站托管，302 / json.url 直接指向图床基地址 + 目录 + 文件名，
//   默认 GitHub CDN（jsDelivr），可用环境变量 IMAGE_CDN_BASE 覆盖为其他图床（如 EdgeOne Pages）
// ============================================================

import manifestData from './_manifest.js';

// 图片基地址：默认走 GitHub CDN（jsDelivr 的 gh 通道），可用环境变量 IMAGE_CDN_BASE 覆盖，
// 例如图床部署到 EdgeOne Pages 后配置为 https://<你的图床域名>
const DEFAULT_IMAGE_CDN_BASE = 'https://cdn.jsdelivr.net/gh/lb94wpz/ecy-wallpaper@master';

const STATIC_EXTENSIONS = new Set([
  '.html', '.htm', '.js', '.mjs', '.css', '.json', '.webp', '.png', '.jpg',
  '.jpeg', '.svg', '.ico', '.txt', '.xml', '.map', '.woff', '.woff2', '.mp4',
]);

const API_PATH = '/random';

const RETURN_REDIRECT = '302';
const RETURN_JSON = 'json';

// -------- 目录清单（构建时打包进函数，无需运行时 fetch） --------
// { 目录名: { title, files } }
const FOLDERS = normalizeManifest(manifestData);

// ========================================
// 配置
// ========================================
// 每个请求从 env 读一份配置，显式传参，不用模块级可变状态
// ALLOWED_DOMAINS 为空 = 完全公开；ALLOW_EMPTY_REQUEST 控制是否放行无 Origin/Referer 的请求
function readConfig(env) {
  const config = { allowedDomains: [], allowEmptyRequest: true };

  if (env.ALLOWED_DOMAINS && typeof env.ALLOWED_DOMAINS === 'string') {
    config.allowedDomains = env.ALLOWED_DOMAINS
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
  }

  if (env.ALLOW_EMPTY_REQUEST !== undefined) {
    config.allowEmptyRequest =
      env.ALLOW_EMPTY_REQUEST === true ||
      env.ALLOW_EMPTY_REQUEST === 'true' ||
      env.ALLOW_EMPTY_REQUEST === '1';
  }

  return config;
}

function isPublicMode(config) {
  return config.allowedDomains.length === 0;
}

// ========================================
// CORS / 防盗链
// ========================================
function extractDomain(urlString) {
  if (!urlString) return null;
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// 域名白名单：精确匹配或子域名
function isDomainAllowed(domain, config) {
  if (!domain) return false;

  const lowerDomain = domain.toLowerCase();

  return config.allowedDomains.some((allowed) => {
    const lowerAllowed = allowed.toLowerCase();
    return lowerDomain === lowerAllowed || lowerDomain.endsWith('.' + lowerAllowed);
  });
}

function checkAntiLeech(request, config) {
  const refererDomain = extractDomain(request.headers.get('Referer'));
  const origin = request.headers.get('Origin');
  const originDomain = extractDomain(origin);

  if (isPublicMode(config)) {
    return { allowed: true };
  }

  if (originDomain && isDomainAllowed(originDomain, config)) {
    return { allowed: true };
  }

  if (refererDomain && isDomainAllowed(refererDomain, config)) {
    return { allowed: true };
  }

  if (!origin && !refererDomain && config.allowEmptyRequest) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: '域名未授权 (Origin: ' + (originDomain || '无') + ', Referer: ' + (refererDomain || '无') + ')',
  };
}

function resolveCorsOrigin(request, config) {
  const origin = request.headers.get('Origin');

  if (isPublicMode(config)) {
    return origin || '*';
  }

  if (origin && isDomainAllowed(extractDomain(origin), config)) {
    return origin;
  }

  if (!origin && config.allowEmptyRequest) {
    return '*';
  }

  return null;
}

function handlePreflight(request, config) {
  // resolveCorsOrigin 返回 null 就说明不在白名单里
  const corsOrigin = resolveCorsOrigin(request, config);
  if (!corsOrigin) {
    return textResponse('CORS 未授权', 403, null);
  }

  const headers = buildHeaders(corsOrigin, {
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });

  return new Response(null, { status: 204, headers });
}

function buildHeaders(corsOrigin, extra = {}) {
  const headers = new Headers(extra);

  if (corsOrigin) {
    headers.set('Access-Control-Allow-Origin', corsOrigin);
    if (corsOrigin !== '*') {
      headers.set('Vary', 'Origin');
    }
  }

  return headers;
}

function makeResponse(body, contentType, status, corsOrigin, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: buildHeaders(corsOrigin, { 'Content-Type': contentType, ...extraHeaders }),
  });
}

function jsonResponse(body, status, corsOrigin, extraHeaders = {}) {
  return makeResponse(
    JSON.stringify(body),
    'application/json; charset=utf-8',
    status,
    corsOrigin,
    extraHeaders,
  );
}

function textResponse(text, status, corsOrigin, extraHeaders = {}) {
  return makeResponse(text, 'text/plain; charset=utf-8', status, corsOrigin, extraHeaders);
}

// ========================================
// 目录清单
// functions/_manifest.js 形如 { "moe": { "title": "萌系壁纸", "files": ["1.webp", ...] } }
// 由 scripts/gen-manifest.mjs 从图床仓库拉取生成
// ========================================
// 只保留有图片的目录，标题缺失时退回目录名
function normalizeManifest(data) {
  const folders = {};

  for (const [name, entry] of Object.entries(data || {})) {
    const files = entry && entry.files;

    if (Array.isArray(files) && files.length > 0) {
      folders[name] = {
        title: typeof entry.title === 'string' && entry.title ? entry.title : name,
        files,
      };
    }
  }

  return folders;
}

// ========================================
// 参数解析
// ========================================
// ?type=bd,lai -> ['bd', 'lai']；未传 -> null；传了空值 -> []
function parseTypeParam(raw) {
  if (raw === null) return null;

  const names = raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  return [...new Set(names)];
}

function parseReturnType(raw) {
  if (raw === null || raw === '') return RETURN_REDIRECT;

  const value = raw.trim().toLowerCase();

  if (value === RETURN_JSON) return RETURN_JSON;
  if (value === RETURN_REDIRECT) return RETURN_REDIRECT;

  return null;
}

// ========================================
// 目录选择
// ========================================
// ========================================
// 随机取图
// ========================================
function pickImage(folders, names) {
  // 按文件数加权：目录里图越多，被选中的概率越大
  const total = names.reduce((sum, name) => sum + folders[name].files.length, 0);

  if (total <= 0) return null;

  let index = Math.floor(Math.random() * total);

  for (const name of names) {
    const files = folders[name].files;

    if (index < files.length) {
      return { folder: name, file: files[index] };
    }

    index -= files.length;
  }

  return null;
}

// ========================================
// 请求处理
// ========================================
export async function handleRequest(request, env) {
  // 有的平台不传 env，统一补一个空对象，后面就不用到处判空
  const safeEnv = env || {};
  const config = readConfig(safeEnv);

  let corsOrigin = null;

  try {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return handlePreflight(request, config);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return textResponse('只支持 GET / HEAD', 405, null, {
        Allow: 'GET, HEAD, OPTIONS',
      });
    }

    const leech = checkAntiLeech(request, config);
    if (!leech.allowed) {
      return jsonResponse({ error: leech.reason }, 403, null);
    }

    corsOrigin = resolveCorsOrigin(request, config);

    // 只有 /random 是接口，其他路径（/、/images/... 等静态资源除外）都是 404
    if (url.pathname !== API_PATH) {
      return textResponse('接口不存在', 404, corsOrigin);
    }

    const returnType = parseReturnType(url.searchParams.get('return'));
    if (returnType === null) {
      return textResponse('return 只支持 302 或 json', 400, corsOrigin);
    }

    if (Object.keys(FOLDERS).length === 0) {
      return textResponse('图片清单为空，请先执行 ./scripts/gen-manifest.sh 并重新部署', 503, corsOrigin);
    }

    // ?info：返回每个目录的标题和图片数量，供首页卡片展示
    if (url.searchParams.has('info')) {
      const info = {};

      for (const [dir, entry] of Object.entries(FOLDERS)) {
        info[dir] = { title: entry.title, count: entry.files.length };
      }

      return jsonResponse(info, 200, corsOrigin, { 'Cache-Control': 'no-store' });
    }

    // type 指定目录：传几个就在几个目录里随机（不看设备方向）
    // 没传 type：所有目录一起随机
    const typeNames = parseTypeParam(url.searchParams.get('type'));

    if (typeNames !== null && typeNames.length === 0) {
      return textResponse('type 不能为空，格式如 ?type=bd 或 ?type=bd,lai', 400, corsOrigin);
    }

    let targetFolders;

    if (typeNames !== null) {
      const unknown = typeNames.filter((name) => FOLDERS[name] === undefined);

      if (unknown.length > 0) {
        return textResponse('目录不存在: ' + unknown.join(', '), 404, corsOrigin);
      }

      targetFolders = typeNames;
    } else {
      targetFolders = Object.keys(FOLDERS);
    }

    const picked = pickImage(FOLDERS, targetFolders);
    if (!picked) {
      return textResponse('没有图片', 404, corsOrigin);
    }

    const imageCdnBase = ((safeEnv.IMAGE_CDN_BASE || '') + '').trim().replace(/\/+$/, '') || DEFAULT_IMAGE_CDN_BASE;
    // 目录名和文件名都要编码，中文目录名才不会拼出非法地址
    const imagePath =
      imageCdnBase + '/' + encodeURIComponent(picked.folder) + '/' + encodeURIComponent(picked.file);

    if (returnType === RETURN_JSON) {
      return jsonResponse(
        { url: new URL(imagePath, url.origin).toString() },
        200,
        corsOrigin,
        { 'Cache-Control': 'no-store' }
      );
    }

    return new Response(null, {
      status: 302,
      headers: buildHeaders(corsOrigin, {
        Location: imagePath,
        'Cache-Control': 'no-store',
      }),
    });
  } catch (error) {
    console.error('请求失败:', error);
    return textResponse('服务器内部错误', 500, corsOrigin);
  }
}

// ========================================
// 平台入口
// ========================================

// Pages Functions（Cloudflare / EdgeOne）是 catch-all，平台会把**所有**请求都交给
// onRequest，包括 /images/** 静态图片。静态资源必须用 context.next() 交还给静态
// 托管，否则图片会 404；Vercel 走 api/random.js 适配层，不经过这里。
function isStaticPath(pathname) {
  // 首页、目录页和带后缀的文件交给静态托管；/random 不带后缀，会走接口
  if (pathname === '/') return true;
  if (pathname.startsWith('/images/')) return true;
  if (pathname.endsWith('/')) return true;

  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  const dot = last.lastIndexOf('.');

  return dot > 0 && STATIC_EXTENSIONS.has(last.slice(dot).toLowerCase());
}

// 标准 Pages Functions 入口（Cloudflare + EdgeOne）
export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);

  if (isStaticPath(pathname) && typeof context.next === 'function') {
    return context.next();
  }

  return handleRequest(context.request, context.env);
}

// EdgeOne Edge Functions / Workers 风格兜底入口
export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
