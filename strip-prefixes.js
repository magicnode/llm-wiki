#!/usr/bin/env node
/**
 * strip-prefixes.js — 移除全库 wikilink 的文件夹前缀
 *
 * 用法:
 *   node scripts/strip-prefixes.js              # 执行
 *   node scripts/strip-prefixes.js --dry-run    # 仅预览
 *
 * 规则:
 *   [[entities/青牛镇]]              → [[青牛镇]]
 *   [[entities/韩立/韩立index]]      → [[韩立index]]
 *   [[concepts/青元剑诀]]            → [[青元剑诀]]
 *   [[sources/第001-020章]]          → [[第001-020章]]
 *   [[synthesis/时间线-天南篇]]      → [[时间线-天南篇]]
 *   [[entities/韩立/筑基期|alias]]   → [[韩立-筑基期]]       (别名也去掉)
 *   [[./练气期]]                     → [[./练气期]]          (相对链接不动)
 *
 * 前提: 全库 .md 文件名已全局唯一（无同名冲突）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const WIKI_DIR = path.resolve(__dirname, '..', 'wiki');

const PREFIXES = ['entities', 'concepts', 'sources', 'synthesis'];

// 重命名/合并映射: 旧路径 → 新文件名
const RENAME_MAP = {
  'entities/韩立/筑基期': '韩立-筑基期',
  'entities/韩立/练气期': '韩立-练气期',
  'entities/韩立/结丹期': '韩立-结丹期',
  'entities/韩立/元婴期': '韩立-元婴期',
  'concepts/七玄门': '七玄门',
  'concepts/天星城': '天星城',
  'concepts/野狼帮': '野狼帮',
};

// ============================================================
// CLI
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun:  args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    quiet:   args.includes('--quiet'),
  };
}

// ============================================================
// 颜色
// ============================================================

const useColor = process.stdout.isTTY;
const C = {
  reset:  useColor ? '\x1b[0m'  : '',
  bold:   useColor ? '\x1b[1m'  : '',
  dim:    useColor ? '\x1b[2m'  : '',
  red:    useColor ? '\x1b[31m' : '',
  green:  useColor ? '\x1b[32m' : '',
  yellow: useColor ? '\x1b[33m' : '',
};
function style(code, text) { return C[code] + text + C.reset; }

// ============================================================
// 文件扫描
// ============================================================

function scanWikiFiles() {
  const results = [];
  function walk(dir) {
    const full = path.join(WIKI_DIR, dir);
    if (!fs.existsSync(full)) return;
    for (const e of fs.readdirSync(full, { withFileTypes: true })) {
      if (e.isDirectory()) walk(dir + '/' + e.name);
      else if (e.name.endsWith('.md') && !e.name.startsWith('.')) results.push(path.join(full, e.name));
    }
  }
  walk('');
  return results.sort();
}

function relativeWikiPath(absPath) {
  return path.relative(WIKI_DIR, absPath).replace(/\\/g, '/');
}

// ============================================================
// 构建文件名索引: "prefix/rest" → bare filename
// ============================================================

function buildNameIndex() {
  const index = new Map();

  function walk(dir) {
    const full = path.join(WIKI_DIR, dir);
    if (!fs.existsSync(full)) return;
    for (const e of fs.readdirSync(full, { withFileTypes: true })) {
      if (e.isDirectory()) {
        walk(dir + '/' + e.name);
      } else if (e.name.endsWith('.md')) {
        const bareName = e.name.replace(/\.md$/, '');
        index.set(dir + '/' + bareName, bareName);
      }
    }
  }

  for (const prefix of PREFIXES) walk(prefix);

  // 注入重命名映射
  for (const [oldKey, newBareName] of Object.entries(RENAME_MAP)) {
    index.set(oldKey, newBareName);
  }

  return index;
}

// ============================================================
// 核心: 前缀剥离
// ============================================================

function stripPrefixesInFile(filePath, nameIndex, opts) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const out = [];
  let inCodeBlock = false;
  let changes = 0;
  const details = [];

  const prefixPattern = PREFIXES.join('|');
  const linkRegex = new RegExp(`\\[\\[(${prefixPattern})/([^\\]]+?)\\]\\]`, 'g');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (/^```/.test(line.trimStart())) { inCodeBlock = !inCodeBlock; out.push(line); continue; }
    if (inCodeBlock) { out.push(line); continue; }

    let newLine = line;
    linkRegex.lastIndex = 0;

    const replacements = [];
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      const before = line.slice(0, match.index);
      if ((before.match(/`/g) || []).length % 2 === 1) continue;

      const fullMatch = match[0];
      const prefix = match[1];
      let rest = match[2];

      // 解析 target | alias
      let targetPath;
      const pipeIdx = rest.indexOf('|');
      if (pipeIdx !== -1) targetPath = rest.slice(0, pipeIdx).trim();
      else targetPath = rest.trim();

      const key = prefix + '/' + targetPath;
      const bareName = nameIndex.get(key);

      if (!bareName) {
        if (opts.verbose) details.push(`  L${lineNum}: ⚠ 无法解析 ${fullMatch}`);
        continue;
      }

      const replacement = `[[${bareName}]]`;
      if (replacement !== fullMatch) {
        replacements.push({ index: match.index, fullMatch, replacement });
      }
    }

    if (replacements.length > 0) {
      for (let r = replacements.length - 1; r >= 0; r--) {
        const { index, fullMatch, replacement } = replacements[r];
        newLine = newLine.slice(0, index) + replacement + newLine.slice(index + fullMatch.length);
        changes++;
        if (opts.verbose) details.push(`  L${lineNum}: ${fullMatch} → ${replacement}`);
      }
    }

    out.push(newLine);
  }

  if (changes > 0 && !opts.dryRun) {
    fs.writeFileSync(filePath, out.join('\n'), 'utf-8');
  }

  return { changes, details };
}

// ============================================================
// 主逻辑
// ============================================================

function main() {
  const opts = parseArgs();

  if (!fs.existsSync(WIKI_DIR)) {
    console.error(style('red', '错误: wiki 目录不存在: ' + WIKI_DIR));
    process.exit(1);
  }

  const nameIndex = buildNameIndex();

  const allFiles = scanWikiFiles();
  let totalFiles = 0;
  let totalChanges = 0;

  console.log('');
  console.log(style('bold', '════════════════════════════════════════'));
  console.log(style('bold', `  前缀剥离${opts.dryRun ? ' (DRY RUN)' : ''}`));
  console.log(style('bold', '════════════════════════════════════════'));
  console.log('');

  for (const file of allFiles) {
    const relPath = relativeWikiPath(file);
    const { changes, details } = stripPrefixesInFile(file, nameIndex, opts);

    if (changes > 0) {
      totalFiles++;
      totalChanges += changes;
      if (!opts.quiet) {
        console.log(style('green', '✓ ' + relPath) + style('dim', ' (' + changes + ' 处)'));
      }
    }
  }

  console.log('');
  console.log(style('dim', '──────────────────────────────────────'));
  console.log(style('bold', '📊 汇总'));
  console.log(style('dim', '──────────────────────────────────────'));
  console.log('  扫描文件:     ' + allFiles.length + ' 个');
  console.log('  修改文件:     ' + style('green', String(totalFiles)) + ' 个');
  console.log('  剥离前缀:     ' + style('green', String(totalChanges)) + ' 处');

  if (opts.dryRun) {
    console.log('');
    console.log(style('yellow', '  ⚠ DRY RUN — 未写入。去掉 --dry-run 执行实际修改'));
  }

  console.log('');
}

if (require.main === module) main();

module.exports = { stripPrefixesInFile, buildNameIndex };
