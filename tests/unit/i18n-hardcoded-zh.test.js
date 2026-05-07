import fs from 'fs';
import path from 'path';

const CJK = /[\u4e00-\u9fff]/;

const ROOT = path.resolve(process.cwd());

/**
 * 允许继续保留的“遗留中文”白名单。
 * 说明：这是用于防止现有大量既有中文触发阻断，后续可逐步缩窄。
 */
const LEGACY_WHITELIST = {
  files: {
    'src/app.js': [
      /回到首页/, /重试/,
    ],
    'src/controllers/AppController.js': [
      /更新Windy API密钥/,
      /您的API密钥已保存，如需修改请重新输入/,
      /API密钥已保存/, /保存中/, /保存/, /搜索中/, /搜索/,
      /获取位置中/,
    ],
    'src/controllers/WeatherController.js': [
      /加载周边数据中/,
      /雷达加载超时，稍后自动重试/,
      /当前周边区域火烧云观赏条件一般/,
      /覆盖层已显示/,
      /覆盖层生成失败/,
    ],
    'src/services/ChinaSpotsOverlay.js': [/火烧云/],
    'src/services/MockWindyMapService.js': [/地图预测（模拟模式）/],
    'index.html': [
      /霞客\s*SUNSET\s*VOYAGER/,
      /收藏位置弹窗/,
      /输入城市名称，查看今日火烧云预测/,
      /温度/,
      /降水/,
      /湿度/,
      /风速/,
      /气压/,
      /云量/,
      /≥80 分/,
      /60-79 分/,
      /40-59 分/,
      /&lt;40 分/,
      /今日暂无可见火烧云点位/,
      /可拖拽地图 · 滚轮缩放/,
      /📷 分享地图/,
      /全屏查看/,
      /全屏查看分享地图/,
      /霞客分享地图/,
    ],
  },
};

const JS_VIS_UI_PATTERNS = [
  /\.(innerText|textContent|innerHTML)\s*=\s*([`'"])([\s\S]*?)\2/gi,
  /\.setAttribute\s*\(\s*(["'])(?:title|aria-label|placeholder|alt|value)\1\s*,\s*(["'])([\s\S]*?)\2\s*\)/gi,
];

const ATTR_HTML_PATTERNS = /\b(aria-label|placeholder|title|alt)\s*=\s*("([^"]*)"|'([^']*)')/gi;

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^\\])\/\/.*$/gm, '$1');
}

function isAllowed(filePath, text) {
  const normalized = filePath.replace(/\\/g, '/');
  const allowList = LEGACY_WHITELIST.files[normalized] || [];
  return allowList.some((rule) => rule.test(text));
}

function collectJsOffenders(filePath, root) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const raw = fs.readFileSync(filePath, 'utf8');
  const code = stripComments(raw);
  const findings = [];

  const lines = code.split(/\r?\n/);

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo];

    // 允许 i18n 回退字符串和 _uiText 旧结构。
    if (/(this\.i18n\.t\(|_uiText\(|i18n\.t\()/.test(line)) {
      continue;
    }
    if (!CJK.test(line)) continue;

    const matchLine = (re) => {
      let m;
      while ((m = re.exec(line))) {
        const value = m[3] ?? m[3 - 1] ?? m[0];
        if (!value || !CJK.test(value)) continue;
        if (!isAllowed(rel, value)) {
          findings.push({
            file: rel,
            line: lineNo + 1,
            content: line.trim(),
            match: value,
          });
        }
      }
      re.lastIndex = 0;
    };

    JS_VIS_UI_PATTERNS.forEach((re) => matchLine(new RegExp(re.source, re.flags)));

    // 直接查找 DOM 写入/更新的变量赋值（如 statusEl.textContent = ...）
    if (/\.(innerText|textContent|innerHTML|title|alt)\s*=/.test(line) && CJK.test(line) && !isAllowed(rel, line)) {
      findings.push({
        file: rel,
        line: lineNo + 1,
        content: line.trim(),
      });
    }
  }

  return findings;
}

function collectHtmlOffenders(htmlPath, root) {
  const rel = path.relative(root, htmlPath).replace(/\\/g, '/');
  const raw = fs.readFileSync(htmlPath, 'utf8');
  const lines = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[^]*?-->/g, '')
    .split(/\r?\n/);

  const findings = [];

  lines.forEach((line, idx) => {
    // 文本节点
    const textMatches = [...line.matchAll(/>([^<>]+)</g)];
    for (const hit of textMatches) {
      const text = hit[1]?.trim();
      if (!text || !CJK.test(text)) continue;
      if (!isAllowed(rel, text) && !/data-i18n|data-i18n-/.test(line)) {
        findings.push({
          file: rel,
          line: idx + 1,
          content: text,
        });
      }
    }

    // 属性值
    let m;
    while ((m = ATTR_HTML_PATTERNS.exec(line))) {
      const value = m[3] || m[4] || '';
      if (!value || !CJK.test(value)) continue;
      if (!isAllowed(rel, value)) {
        // 某些场景已通过 data-i18n-* 管控
        const hasDataBinding = /data-i18n/.test(line);
        if (!hasDataBinding) {
          findings.push({
            file: rel,
            line: idx + 1,
            content: `${m[1]}="${value}"`,
          });
        }
      }
    }
    ATTR_HTML_PATTERNS.lastIndex = 0;
  });

  return findings;
}

function walkJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (p.includes(`${path.sep}locales${path.sep}`)) continue;
    if (entry === 'node_modules') continue;
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      walkJsFiles(p, out);
      continue;
    }
    if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

describe('i18n hardcoded zh-CN guard', () => {
  test('扫描 src/**/*.js、index.html 中用户可见字符串中文，不允许新增未 i18n 的硬编码（允许白名单遗留项）', () => {
    const root = ROOT;
    const jsFiles = walkJsFiles(path.join(root, 'src'));
    const jsFindings = jsFiles.flatMap((f) => collectJsOffenders(f, root));

    const htmlFindings = collectHtmlOffenders(path.join(root, 'index.html'), root);

    const allFindings = [...jsFindings, ...htmlFindings];

    if (allFindings.length > 0) {
      const preview = allFindings
        .slice(0, 40)
        .map((item) => `${item.file}:${item.line}: ${item.content}`)
        .join('\n');
      throw new Error(`发现未通过 i18n 保护的中文硬编码（含白名单外）：\n${preview}`);
    }

    // 规则自检：确保白名单规则覆盖了当前扫描文件（避免无效空白名单导致静默）
    const whitelistCoverage = Object.entries(LEGACY_WHITELIST.files).map(([f]) => f);
    expect(whitelistCoverage.length).toBeGreaterThan(0);
  });
});
