#!/usr/bin/env node
/**
 * validate-links.js — Wiki 链接验证脚本
 *
 * 扫描 wiki/ 目录下所有 .md 文件，验证 [[wikilink]] 的有效性。
 *
 * 用法:
 *   node scripts/validate-links.js                  # 基础检查（断链 + 前缀缺失）
 *   node scripts/validate-links.js --strict         # 断链触发 exit 1
 *   node scripts/validate-links.js --all            # 全部检查（含启发式 + 孤页）
 *   node scripts/validate-links.js --json           # JSON 输出（CI 用）
 *   node scripts/validate-links.js --csv            # CSV 输出
 *   node scripts/validate-links.js --scope entities # 仅检查指定子目录
 *
 * 检查项:
 *   ❌ 断链      — 目标 .md 文件不存在
 *   ⚠️ 前缀缺失  — [[练气期]] 未指定 entities/ 或 concepts/
 *   ⚠️ 歧义链接  — 无前缀链接可匹配多个文件
 *   💡 前缀可疑  — 文件名暗示它可能放错了文件夹 (--prefix-check 开启)
 *   📄 孤立页面  — 无任何入站链接的页面 (--orphans 开启)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================

const WIKI_DIR = path.resolve(__dirname, '..', 'wiki');

const VALID_FOLDERS = [
  'entities',
  'concepts',
  'sources',
  'synthesis',
  'comparisons',
  'queries',
  'log-archive',
];

// 启发式前缀检测：文件名的尾词是否暗示了正确的分类
const ENTITY_SUFFIX_KW = [
  '门', '宗', '谷', '派', '城', '国', '帮', '堡', '岛', '宫',
  '族', '教', '会', '山', '岭', '观', '楼', '阁', '堂', '洞',
  '府', '庄', '镇', '村', '坊', '盟', '园', '湖', '海', '店',
];

const CONCEPT_SUFFIX_KW = [
  '丹', '术', '功', '法', '诀', '经', '鼎', '剑', '瓶', '符',
  '阵', '虫', '焰', '雷', '火', '冰', '魂', '气', '脉', '体',
  '灵', '芝', '草', '木', '藤', '竹', '丝',
];

// 明确不应触发启发式的白名单（防止误报）
const HEURISTIC_WHITELIST = new Set([
  '七玄门',    // concepts/ 下有七玄门武学，entities/ 下有七玄门组织 — 两者都合理
  '天星城',    // concepts/ 下讨论城市体系，entities/ 下有同名组织 — 都合理
  '野狼帮',    // entities/ 下是帮派，concepts/ 下讨论帮派体系 — 需人工判断
]);

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    strict:      args.includes('--strict'),
    all:         args.includes('--all'),
    json:        args.includes('--json'),
    csv:         args.includes('--csv'),
    orphans:     args.includes('--orphans')     || args.includes('--all'),
    prefixCheck: args.includes('--prefix-check'),  // 启发式误报率高，不纳入 --all
    quiet:       args.includes('--quiet'),
    scope:       (args.find(a => a.startsWith('--scope=')) || '').split('=')[1]?.split(',') || null,
    file:        (args.find(a => a.startsWith('--file=')) || '').split('=')[1] || null,
  };
}

// ============================================================
// 终端颜色（TTY 才输出颜色）
// ============================================================

const useColor = process.stdout.isTTY;

const colors = {
  reset:   useColor ? '\x1b[0m'  : '',
  bold:    useColor ? '\x1b[1m'  : '',
  dim:     useColor ? '\x1b[2m'  : '',
  red:     useColor ? '\x1b[31m' : '',
  green:   useColor ? '\x1b[32m' : '',
  yellow:  useColor ? '\x1b[33m' : '',
  cyan:    useColor ? '\x1b[36m' : '',
  gray:    useColor ? '\x1b[90m' : '',
};

function style(code, text) { return colors[code] + text + colors.reset; }

// ============================================================
// 工具函数
// ============================================================

function relativeWikiPath(absPath) {
  return path.relative(WIKI_DIR, absPath).replace(/\\/g, '/');
}

// ============================================================
// 文件扫描
// ============================================================

function scanWikiFiles() {
  const results = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name.endsWith('.md') && !e.name.startsWith('.')) {
        results.push(full);
      }
    }
  }

  walk(WIKI_DIR);
  return results.sort();
}

// ============================================================
// 链接提取
// ============================================================

/**
 * 从 markdown 文本中提取所有 [[...]] wikilink。
 * 自动跳过代码块（``` 围起来的区域）和行内代码（`...`）内的链接。
 */
function extractLinks(content, filePath) {
  const links = [];
  const lines = content.split('\n');
  const linkRegex = /\[\[([^\]]+)\]\]/g;

  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 跟踪代码块边界
    if (/^```/.test(line.trimStart())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    let match;
    // 重置 regex 的 lastIndex（全局 regex 有状态）
    linkRegex.lastIndex = 0;

    while ((match = linkRegex.exec(line)) !== null) {
      // 跳过行内代码内的链接（检查 [[ 之前是否存在奇数个 `）
      const before = line.slice(0, match.index);
      const backtickCount = (before.match(/`/g) || []).length;
      if (backtickCount % 2 === 1) continue;
      const raw = match[0];
      let inner = match[1].trim();

      // 跳过空链接
      if (!inner) continue;

      // 跳过 URL
      if (/^https?:/i.test(inner)) continue;

      // 解析: target | alias
      let target = inner;
      let alias  = null;

      const pipeIdx = target.indexOf('|');
      if (pipeIdx !== -1) {
        alias  = target.slice(pipeIdx + 1).trim();
        target = target.slice(0, pipeIdx).trim();
      }

      // 解析: target#anchor
      let anchor = null;
      const hashIdx = target.indexOf('#');
      if (hashIdx !== -1) {
        anchor = target.slice(hashIdx + 1);
        target = target.slice(0, hashIdx).trim();
      }

      // 空 target 跳过
      if (!target) continue;

      links.push({
        raw,
        target,
        alias:  alias  || null,
        anchor: anchor || null,
        line:   i + 1,
        col:    match.index + 1,
        sourceFile: filePath,
      });
    }
  }

  return links;
}

// ============================================================
// 目标文件解析
// ============================================================

/**
 * 将 wikilink target 解析为实际文件系统路径。
 *
 * 解析顺序:
 *  1. ./xxx 相对链接 → 从源文件目录解析
 *  2. folder/xxx 前缀链接 → wiki/<folder>/<xxx>.md 或 wiki/<folder>/<xxx>/index.md
 *  3. 无前缀链接 → 先在源文件同目录查找，再全局搜索
 */
function resolveTarget(target, sourceFile) {
  const t = target.replace(/\\/g, '/');

  // ── 情况 1: 显式相对链接 ──
  if (t.startsWith('./') || t.startsWith('../')) {
    const sourceDir = path.dirname(sourceFile);
    const resolved = path.resolve(sourceDir, t);
    const candidates = [];

    const m = resolved + '.md';
    const i = path.join(resolved, 'index.md');
    if (fs.existsSync(m)) candidates.push(m);
    if (fs.existsSync(i)) candidates.push(i);

    return {
      resolved:   candidates[0] || null,
      candidates,
      ambiguous:  candidates.length > 1,
    };
  }

  // ── 情况 2: 有文件夹前缀（遗留问题，标记为错误） ──
  const hasPrefix = VALID_FOLDERS.some(f => t.startsWith(f + '/'));
  if (hasPrefix) {
    // 前缀链接不应存在，但仍尝试解析（容错）
    const candidates = [];
    const m = path.join(WIKI_DIR, t + '.md');
    const i = path.join(WIKI_DIR, t, 'index.md');
    if (fs.existsSync(m)) candidates.push(m);
    if (fs.existsSync(i)) candidates.push(i);

    return {
      resolved:   candidates[0] || null,
      candidates,
      ambiguous:  candidates.length > 1,
      hasPrefix:  true,
    };
  }

  // ── 情况 3: 裸文件名 — 全库搜索 ──
  const sourceDir = path.dirname(sourceFile);
  const candidates = [];

  // 3a: 同目录优先
  const sameM = path.join(sourceDir, t + '.md');
  const sameI = path.join(sourceDir, t, 'index.md');
  if (fs.existsSync(sameM)) candidates.push(sameM);
  if (fs.existsSync(sameI)) candidates.push(sameI);

  // 3b: 全局搜索（含子目录）
  function globalSearch(dir) {
    const full = path.join(WIKI_DIR, dir);
    if (!fs.existsSync(full)) return;
    for (const e of fs.readdirSync(full, { withFileTypes: true })) {
      if (e.isDirectory()) globalSearch(dir + '/' + e.name);
      else if (e.name === t + '.md') {
        const p = path.join(full, e.name);
        if (!candidates.includes(p)) candidates.push(p);
      }
    }
  }
  for (const folder of VALID_FOLDERS) globalSearch(folder);

  return {
    resolved:   candidates[0] || null,
    candidates,
    ambiguous:  candidates.length > 1,
  };
}

// ============================================================
// 前缀启发式检测
// ============================================================

function checkPrefixHeuristic(target, resolvedPath) {
  if (!resolvedPath) return null;

  const relPath = relativeWikiPath(resolvedPath);
  const folder = relPath.split('/')[0];
  const filename = path.basename(resolvedPath, '.md');

  // 白名单跳过
  if (HEURISTIC_WHITELIST.has(filename)) return null;

  // concepts/ 下的文件是否像实体？
  if (folder === 'concepts') {
    for (const kw of ENTITY_SUFFIX_KW) {
      if (filename.endsWith(kw)) {
        // 检查 entities/ 下是否已有同名文件（那样可能是合理共存）
        const entityPath = path.join(WIKI_DIR, 'entities', filename + '.md');
        const alreadyExists = fs.existsSync(entityPath);
        return {
          type: 'entity_in_concepts',
          filename,
          keyword: kw,
          suggestion: `entities/${filename}`,
          alreadyExists,
        };
      }
    }
  }

  // entities/ 下的文件是否像概念？
  if (folder === 'entities') {
    for (const kw of CONCEPT_SUFFIX_KW) {
      if (filename.endsWith(kw)) {
        const conceptPath = path.join(WIKI_DIR, 'concepts', filename + '.md');
        const alreadyExists = fs.existsSync(conceptPath);
        return {
          type: 'concept_in_entities',
          filename,
          keyword: kw,
          suggestion: `concepts/${filename}`,
          alreadyExists,
        };
      }
    }
  }

  return null;
}

// ============================================================
// 孤立页面检测
// ============================================================

function findOrphans(allFiles, allLinks) {
  const linkedFiles = new Set();
  for (const link of allLinks) {
    if (link.resolved && fs.existsSync(link.resolved)) {
      linkedFiles.add(path.resolve(link.resolved));
    }
    // 多个候选时都加入
    if (link.candidates) {
      for (const c of link.candidates) {
        linkedFiles.add(path.resolve(c));
      }
    }
  }

  const excludeNames = new Set(['index.md', 'README.md']);

  return allFiles.filter(f => {
    if (excludeNames.has(path.basename(f))) return false;
    return !linkedFiles.has(path.resolve(f));
  });
}

// ============================================================
// 主逻辑
// ============================================================

function validate() {
  const opts = parseArgs();

  if (!fs.existsSync(WIKI_DIR)) {
    console.error(style('red', `错误: wiki 目录不存在: ${WIKI_DIR}`));
    process.exit(1);
  }

  // ── 1. 扫描文件 ──
  let allFiles;
  if (opts.file) {
    // 单文件模式：只检查指定文件的出链
    const filePath = path.isAbsolute(opts.file)
      ? opts.file
      : path.resolve(process.cwd(), opts.file);
    if (!fs.existsSync(filePath)) {
      console.error(style('red', `错误: 文件不存在: ${filePath}`));
      process.exit(1);
    }
    // 非 wiki 文件静默跳过（便于 hook 使用）
    const rel = path.relative(WIKI_DIR, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      process.exit(0);
    }
    allFiles = [filePath];
  } else {
    allFiles = scanWikiFiles();
  }
  if (opts.scope && !opts.file) {
    allFiles = allFiles.filter(f => {
      const rel = relativeWikiPath(f);
      return opts.scope.some(s => rel === s || rel.startsWith(s + '/'));
    });
  }

  // ── 2. 提取所有链接 ──
  const allLinks = [];
  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const links = extractLinks(content, file);
    allLinks.push(...links);
  }

  // ── 3. 解析每个链接的目标 ──
  for (const link of allLinks) {
    const resolution = resolveTarget(link.target, link.sourceFile);
    link.resolved   = resolution.resolved;
    link.candidates = resolution.candidates;
    link.ambiguous  = resolution.ambiguous;
    link.broken     = !resolution.resolved;
  }

  // ── 4. 遗留前缀检测 ──
  const legacyPrefixLinks = allLinks.filter(l => l.hasPrefix);

  // ── 5. 分类 ──
  const brokenLinks     = allLinks.filter(l => l.broken);
  const ambiguousLinks  = allLinks.filter(l => l.ambiguous && !l.broken);

  // 断链按 target 去重
  const brokenByTarget = new Map();
  for (const l of brokenLinks) {
    if (!brokenByTarget.has(l.target)) brokenByTarget.set(l.target, []);
    brokenByTarget.get(l.target).push(l);
  }

  // ── 6. 孤立页面 ──
  let orphans = [];
  if (opts.orphans) {
    orphans = findOrphans(allFiles, allLinks);
  }

  // ── 7. 统计 ──
  const stats = {
    files:             allFiles.length,
    totalLinks:        allLinks.length,
    validLinks:        allLinks.length - brokenLinks.length,
    brokenLinks:       brokenLinks.length,
    brokenTargets:     brokenByTarget.size,
    legacyPrefixLinks: legacyPrefixLinks.length,
    ambiguousLinks:    ambiguousLinks.length,
    orphans:           orphans.length,
  };

  // ── 8. 输出 ──
  if (opts.json) {
    outputJSON(stats, brokenByTarget, ambiguousLinks, legacyPrefixLinks, orphans);
  } else if (opts.csv) {
    outputCSV(stats, brokenByTarget, ambiguousLinks, legacyPrefixLinks, orphans);
  } else {
    outputTerminal(stats, brokenByTarget, ambiguousLinks, legacyPrefixLinks, orphans);
  }

  // ── 9. 退出码 ──
  if (opts.strict && stats.brokenTargets > 0) process.exit(1);
  process.exit(0);
}

// ============================================================
// 输出: JSON
// ============================================================

function outputJSON(stats, brokenByTarget, ambiguousLinks, legacyPrefixLinks, orphans) {
  const result = {
    stats: { ...stats },
    broken: [...brokenByTarget.entries()].map(([target, refs]) => ({
      target,
      sources: refs.map(r => `${relativeWikiPath(r.sourceFile)}:${r.line}`),
    })),
    legacyPrefix: legacyPrefixLinks.map(l => ({
      target: l.target,
      source: `${relativeWikiPath(l.sourceFile)}:${l.line}`,
    })),
    ambiguous: ambiguousLinks.map(l => ({
      target: l.target,
      source: `${relativeWikiPath(l.sourceFile)}:${l.line}`,
      candidates: l.candidates.map(c => relativeWikiPath(c)),
    })),
  };

  if (orphans && orphans.length > 0) {
    result.orphans = orphans.map(f => relativeWikiPath(f));
  }

  console.log(JSON.stringify(result, null, 2));
}

// ============================================================
// 输出: CSV
// ============================================================

function outputCSV(_stats, brokenByTarget, ambiguousLinks, legacyPrefixLinks, orphans) {
  console.log('issue_type,target,source_file,source_line,detail');

  for (const [target, refs] of brokenByTarget) {
    for (const r of refs) {
      console.log(`broken,"${target}","${relativeWikiPath(r.sourceFile)}",${r.line},target file not found`);
    }
  }

  for (const l of legacyPrefixLinks) {
    console.log(`legacy_prefix,"${l.target}","${relativeWikiPath(l.sourceFile)}",${l.line},run strip-prefixes.js`);
  }

  for (const l of ambiguousLinks) {
    const cand = l.candidates.map(c => relativeWikiPath(c)).join('; ');
    console.log(`ambiguous,"${l.target}","${relativeWikiPath(l.sourceFile)}",${l.line},"candidates: ${cand}"`);
  }

  for (const f of orphans) {
    console.log(`orphan,"","${relativeWikiPath(f)}",,no inbound links`);
  }
}

// ============================================================
// 输出: 终端（人类可读）
// ============================================================

function outputTerminal(stats, brokenByTarget, ambiguousLinks, legacyPrefixLinks, orphans) {
  console.log('');
  console.log(style('bold', '════════════════════════════════════════'));
  console.log(style('bold', '  Wiki Link Validator — 链接校验报告'));
  console.log(style('bold', '════════════════════════════════════════'));
  console.log('');

  // ── 统计面板 ──
  console.log(style('dim', '──────────────────────────────────────'));
  console.log(style('bold', '📊 统计'));
  console.log(style('dim', '──────────────────────────────────────'));
  console.log(`  扫描文件:     ${pad(stats.files, 5)} 个`);
  console.log(`  总链接数:     ${pad(stats.totalLinks, 5)} 个`);
  console.log(`  有效链接:     ${style('green', pad(stats.validLinks, 5))}  (${pct(stats.validLinks, stats.totalLinks)}%)`);

  if (stats.brokenTargets > 0) {
    console.log(`  断链:         ${style('red', pad(stats.brokenLinks, 5))}  (${stats.brokenTargets} 个不同目标)`);
  }
  if (stats.legacyPrefixLinks > 0) {
    console.log(`  遗留前缀:     ${style('yellow', pad(stats.legacyPrefixLinks, 5))}`);
  }
  if (stats.ambiguousLinks > 0) {
    console.log(`  歧义链接:     ${style('yellow', pad(stats.ambiguousLinks, 5))}`);
  }
  if (orphans && orphans.length > 0) {
    console.log(`  孤立页面:     ${style('gray', pad(orphans.length, 5))}`);
  }
  console.log('');

  // ── 断链 ──
  if (brokenByTarget.size > 0) {
    console.log(style('red', style('bold', `❌ 断链 (${stats.brokenTargets} 个不同目标)`)));
    console.log(style('dim', '──────────────────────────────────────'));
    for (const [target, refs] of brokenByTarget) {
      console.log(style('red', `  [[${target}]]`));
      for (const r of refs) {
        console.log(style('gray', `    → ${relativeWikiPath(r.sourceFile)}:${r.line}`));
      }
    }
    console.log('');
  }

  // ── 遗留前缀 ──
  if (legacyPrefixLinks.length > 0) {
    console.log(style('yellow', style('bold', `⚠️  遗留前缀 (${legacyPrefixLinks.length} 处)`)));
    console.log(style('dim', '──────────────────────────────────────'));
    for (const l of legacyPrefixLinks) {
      console.log(style('yellow', `  [[${l.target}]]`));
      console.log(style('gray', `    → ${relativeWikiPath(l.sourceFile)}:${l.line}`));
    }
    console.log('');
    console.log(style('dim', '  运行 node scripts/strip-prefixes.js 自动修复'));
    console.log('');
  }

  // ── 歧义链接 ──
  if (ambiguousLinks.length > 0) {
    console.log(style('yellow', style('bold', `⚠️  歧义链接 (${ambiguousLinks.length} 处)`)));
    console.log(style('dim', '──────────────────────────────────────'));
    for (const l of ambiguousLinks) {
      console.log(style('yellow', `  [[${l.target}]]`));
      console.log(style('gray', `    来源: ${relativeWikiPath(l.sourceFile)}:${l.line}`));
      for (const c of l.candidates) {
        console.log(style('gray', `      → ${relativeWikiPath(c)}`));
      }
    }
    console.log('');
  }

  // ── 孤立页面 ──
  if (orphans && orphans.length > 0) {
    console.log(style('gray', style('bold', `📄 孤立页面 (${orphans.length} 个)`)));
    console.log(style('dim', '──────────────────────────────────────'));
    const show = orphans.slice(0, 20);
    for (const f of show) {
      console.log(style('dim', `  ${relativeWikiPath(f)}`));
    }
    if (orphans.length > 20) {
      console.log(style('dim', `  ... 还有 ${orphans.length - 20} 个`));
    }
    console.log('');
  }

  // ── 总结 ──
  console.log(style('dim', '════════════════════════════════════════'));
  if (stats.brokenTargets === 0 && stats.legacyPrefixLinks === 0 && stats.ambiguousLinks === 0) {
    console.log(style('green', style('bold', '  ✅ 全部通过，没有发现问题')));
  } else {
    const parts = [];
    if (stats.brokenTargets       > 0) parts.push(style('red',    `${stats.brokenTargets} 断链`));
    if (stats.legacyPrefixLinks   > 0) parts.push(style('yellow', `${stats.legacyPrefixLinks} 遗留前缀`));
    if (stats.ambiguousLinks      > 0) parts.push(style('yellow', `${stats.ambiguousLinks} 歧义`));
    console.log(style('bold', `  结果: ${parts.length > 0 ? parts.join(', ') : '全部通过'}`));
  }
  console.log(style('dim', '════════════════════════════════════════'));
  console.log('');
}

// ============================================================
// 辅助
// ============================================================

function pad(n, w) { return String(n).padStart(w); }

function pct(part, total) {
  if (total === 0) return '0.0';
  return (part / total * 100).toFixed(1);
}

// ============================================================
// 入口
// ============================================================

if (require.main === module) {
  validate();
}

module.exports = {
  extractLinks,
  resolveTarget,
  scanWikiFiles,
  findOrphans,
  checkPrefixHeuristic,
};
