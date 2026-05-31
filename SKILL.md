---
name: llm-wiki
description: 在当前目录初始化 LLM Wiki 知识库系统（基于 Karpathy 模式）。用 `/llm-wiki` 一键创建空白 wiki 项目结构，包含 CLAUDE.md 行为规范、目录骨架、子索引、链接校验脚本和日志文件。
---

<!--
  ╔══════════════════════════════════════════════════════════════╗
  ║  开发说明                                                   ║
  ║                                                            ║
  ║  本文件是"引导程序"——仅在 /llm-wiki 被调用时执行一次。      ║
  ║  wiki 日常行为由 CLAUDE.md 控制，本文件内含其完整副本。     ║
  ║                                                            ║
  ║  修改流程：                                                 ║
  ║    改 wiki 行为 → 改本文件的 CLAUDE.md 模板 → 测试          ║
  ║    改初始化流程 → 改本文件的引导部分 → /llm-wiki 测试        ║
  ║                                                            ║
  ║  优化历史：                                                 ║
  ║    2026-06-01  v3 — 去前缀化: 裸链接 + 唯一文件名 +       ║
  ║              strip-prefixes.js + validate-links 适配       ║
  ║    2026-05-31  v2 — 索引轻型化 + 前缀规则 +               ║
  ║              校验脚本 + 实体分页 + 概念审核 + 来源标准化    ║
  ╚══════════════════════════════════════════════════════════════╝
-->

# LLM Wiki 初始化技能

当用户输入 `/llm-wiki` 时，在当前工作目录执行以下操作。

## 执行流程

### 第一步：检查是否已初始化

检查当前目录是否存在 `CLAUDE.md` 或 `wiki/index.md`。如果已存在：
- 告知用户当前目录已经是 LLM Wiki 项目
- 列出已有操作：`ingest（摄入）`、`query（查询）`、`lint（维护）`
- 如果用户坚持，则在子目录或用户指定的新目录创建

### 第二步：创建目录结构

在当前目录下创建以下目录：

```
raw/
scripts/
wiki/
wiki/entities/
wiki/concepts/
wiki/sources/
wiki/comparisons/
wiki/synthesis/
wiki/queries/
wiki/log-archive/
```

### 第三步：写入文件

按顺序创建以下文件（使用 Write 工具）：

#### 1. `.gitignore`

```
# Obsidian workspace (personal, not portable)
.obsidian/workspace.json
.obsidian/workspace-mobile.json

# Temporary files
raw/_temp_summary.md
raw/_chapters_idx.txt
raw/_index_headings.txt

# OS files
.DS_Store
Thumbs.db
desktop.ini
```

#### 2. `raw/.gitkeep`

空文件，确保 raw/ 被 git 跟踪。

#### 3. `scripts/validate-links.js`

**关键步骤**：先用 Read 工具读取本技能目录下的 `validate-links.js`（路径：`<技能目录>/validate-links.js`），然后用 Write 工具将其写入目标项目的 `scripts/validate-links.js`。

该脚本提供以下能力：
- 断链检测、遗留前缀检测、歧义链接检测
- 子目录感知的全局文件名搜索（适配裸链接体系）
- 孤立页面检测（`--orphans`）
- JSON / CSV / 终端三种输出模式
- 单文件模式（`--file=`）供 Hook 使用

> **注意**：如果技能目录中的 `validate-links.js` 不可用，则创建一个精简版（≥200 行），至少包含断链检测和遗留前缀检测。

#### 4. `scripts/strip-prefixes.js`

**关键步骤**：先用 Read 工具读取本技能目录下的 `strip-prefixes.js`（路径：`<技能目录>/strip-prefixes.js`），然后用 Write 工具将其写入目标项目的 `scripts/strip-prefixes.js`。

该脚本用于将 `[[entities/xxx]]` / `[[concepts/xxx]]` / `[[sources/xxx]]` / `[[synthesis/xxx]]` 格式的前缀链接批量转换为纯 `[[文件名]]` 裸链接，支持 `--dry-run` 预览模式。

> **注意**：如果技能目录中的 `strip-prefixes.js` 不可用，则创建一个精简版（≥100 行），核心功能为前缀剥离 + 代码块保护。

#### 5. `.claude/settings.json`（Hook 预设）

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/validate-links.js --json --quiet",
            "async": true
          }
        ]
      }
    ]
  }
}
```

> **说明**：此 Hook 在每次 Write/Edit 操作后自动运行链接校验（异步，不阻塞）。如果项目已有 `.claude/settings.json`，则将 Hook 合并进去而非覆盖。

#### 5. `wiki/index.md`（轻型枢纽，目标 <80 行）

```markdown
# Wiki 索引

> 📅 创建于: <当天日期 YYYY-MM-DD> | 📊 总页面数: 0

| 分类 | 数量 | 子索引 |
|------|------|--------|
| 实体 | 0 | [[实体索引index]] |
| 概念 | 0 | [[概念页面index]] |
| 来源 | 0 | [[来源章节index]] |
| 综合 | 0 | [[综合页index]] |

## 最近更新

*暂无内容 — 将来源文件放入 `raw/` 后告诉 LLM 开始 ingest*

## 快速导航

- [[实体索引index|全部实体]]
- [[概念页面index|全部概念]]
- [[来源章节index|来源章节]]
- [[综合页index|综合页面]]

## 统计

| 维度 | 数值 |
|------|------|
| 页面总数 | 0 |
```

> **重要**：主索引仅含统计表 + 子索引链接 + 最近更新（5条）+ 快速导航。不列具体页面名。具体页面由子索引管理。

#### 6. `wiki/entities/实体索引index.md`

```markdown
# 实体索引

> 总计: 0 页

## 人物 (0)

*暂无内容*

## 组织 (0)

*暂无内容*

## 场所 (0)

*暂无内容*
```

> 子索引命名为 `{前缀}index.md`，使 Obsidian 图谱中可区分。

#### 7. `wiki/concepts/概念页面index.md`

```markdown
# 概念索引

> 总计: 0 页

## 修炼体系

*暂无内容*

## 功法与秘术

*暂无内容*

## 丹药与灵物

*暂无内容*

## 法宝与装备

*暂无内容*

## 其他

*暂无内容*
```

> 概念索引的分类（修炼体系/功法/丹药/法宝等）是示例性的，LLM 应根据实际项目领域动态调整分类名。

#### 8. `wiki/sources/来源章节index.md`

```markdown
# 来源索引

> 总计: 0 页

*暂无内容 — ingest 后自动填充*
```

#### 9. `wiki/synthesis/综合页index.md`

```markdown
# 综合页面索引

> 总计: 0 页

*暂无内容 — synthesis 后自动填充*
```

#### 10. `wiki/log.md`

```markdown
# Wiki 日志

> 保留最近 30 条。超出归档到 `log-archive/YYYY.md`。

## [<当天日期>] system | Wiki 项目初始化
- 创建: 目录结构和空白 wiki，含子索引和校验脚本
- 状态: 系统就绪，等待第一批来源摄入
```

#### 11. `CLAUDE.md`

写入以下完整内容（这是核心文件，是 LLM 的 Wiki 维护行为规范）：

---

```markdown
# LLM Wiki — Schema & Conventions

> 核心配置文件。LLM 作为 wiki 维护者的行为规范。
> 基于 Karpathy 模式：<https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>

---

## 目录结构

```
├── CLAUDE.md, README.md
├── raw/              ← 只读来源，绝不修改
├── scripts/
│   ├── validate-links.js  ← 链接校验 (node scripts/validate-links.js)
│   └── strip-prefixes.js  ← 前缀剥离 (node scripts/strip-prefixes.js)
└── wiki/             ← LLM 生成和维护
    ├── index.md           ← 主索引（统计表 + 子索引链接，<80行）
    ├── log.md             ← 操作日志（追加，保留30条）
    ├── log-archive/       ← 日志归档（按年）
    ├── entities/          ← 人物|组织|场所 实体页
    │   └── 实体索引index.md   ← 人物/组织/场所分组
    ├── concepts/          ← 功法|丹药|法宝|体系 概念页
    │   └── 概念页面index.md
    ├── sources/           ← 来源摘要（按批次）
    │   └── 来源章节index.md
    ├── synthesis/         ← 综合页（时间线等）
    │   └── 综合页index.md
    ├── comparisons/, queries/
```

> 索引全部命名为 `{前缀}index.md`，使 Obsidian 图谱中可区分。

---

## 核心原则

1. **不修改 `raw/`** | 2. **拥有 `wiki/` 全部内容** | 3. **每次操作更新 index.md + log.md**
4. **主动交叉引用** `[[文件名]]`（全库唯一文件名，无需前缀） | 5. **标注矛盾** | 6. **YAML frontmatter 必加**
7. **简体中文输出**（原文可放 `> 引用` 块）

---

## 索引体系（轻型枢纽设计）

**主 `index.md`（<80行）**：仅统计表 + 子索引链接 + 最近更新（5条）+ 快速导航。不列具体页面名。

**子索引**：`entities/实体索引index.md`、`concepts/概念页面index.md`、`sources/来源章节index.md`、`synthesis/综合页index.md`

每次 ingest/lint 时：更新主索引统计 + 对应子索引条目。

---

## 文件大小策略

| 级别 | 大小 | 策略 | 方法 |
|------|------|------|------|
| L0 | <200KB | 直接处理 | 一次读完 |
| L1 | 200KB-1MB | 分段处理 | 按章节标题分段阅读，维护累积摘要 |
| L2 | 1MB-10MB | 拆分摄入 | 脚本拆分文件后逐文件摄入 |
| L3 | 10MB-100MB | 索引优先 | 读索引不读正文，按需深入 |
| L4 | >100MB | 外脑模式 | grep 搜索，LLM 只读结果片段 |

---

## 工作流程

### Ingest

1. **评估大小** — 判断 L0-L4 级别
2. **按级别处理** — 直接读 / 分段读 / 脚本拆分 / 索引优先 / grep 搜索
3. **创建来源摘要** — `wiki/sources/第XXX-YYY章.md`（或按领域自定义命名）
4. **创建/更新实体页** — 新人物、组织、场所
5. **创建/丰富概念页** — 新功法、丹药、法宝、体系
6. **检查冲突** — 与已有信息矛盾则标注
7. **更新 index.md** — 更新统计数字和最近更新
8. **更新子索引** — 添加新条目到对应子索引
9. **追加 log.md** — 记录所有创建/更新操作
10. **剥离前缀** — 运行 `node scripts/strip-prefixes.js`，确保全库链接为纯 `[[文件名]]` 格式

### Query
读 index.md → 深入相关页 → 综合回答（引用 `[[page]]`）→ 有价值时归档 `queries/`

### Lint

1. 运行 `node scripts/strip-prefixes.js` — 确保新链接无残留前缀
2. 运行 `node scripts/validate-links.js --all` 做链接校验
3. 检查矛盾声明、过时内容
4. 检查孤立页面（无入站链接）
5. 检查缺失页面（被引用但无专属页面）
6. 审核概念页：`draft` + `source_count>=3` → 升 `stable`
7. 建议补充方向，追加 log.md

---

## 页面模板

### 实体页 `entities/名称.md`
```yaml
type: entity | category: person|organization|location
tags, created, updated, source_count, aliases
```
固定标题层级：`## 概述` → `## 关键信息` → `## 详细说明` → `## 相关实体` → `## 来源`
- 相关实体、来源均用 `[[文件名]]` 格式（全库唯一，无需前缀）

### 概念页 `concepts/名称.md`
```yaml
type: concept | domain, tags, created, updated, source_count
status: draft | stable | needs_review
```
固定标题层级：`## 一句话定义` → `## 详细解释` → `## 与其他概念的关系` → `## 来源`

### 来源页 `sources/名称.md`
```yaml
type: source | format, url, authors, published, ingested, tags
```
固定标题层级：`## 一句话摘要`（<80字）→ `## 关键要点`（10-15条）→ `## 涉及的实体` → `## 涉及的概念` → `## 原始文件`
- 大小目标：<5KB、50-60行
- 实体/概念列表：仅 `- [[文件名]]` wikilink，不加描述
- 仅列出出现 ≥2 次的实体/概念，龙套不列

---

## 命名与链接约定

- 文件名：中文直接用，英文用 `-` 分隔
- **全库文件名必须全局唯一**（无同名 .md 文件），冲突时通过改名或合并解决
- 页面：200-800行，超过拆分子页
- Wikilink：`[[文件名]]`（无前缀、无别名，纯文件名）
- 子页互链：`[[./子页名]]`（相对链接）
- Obsidian 设置：New link format → Shortest path

### 文件组织依然保留

目录前缀 (`entities/`, `concepts/`, `sources/`, `synthesis/`) 保留在**文件系统**层，但 **wikilink 中不使用**。Obsidian 根据唯一文件名自动解析。

### 常见错误
```
[[entities/筑基丹]]   → 去掉前缀，应为 [[筑基丹]]
[[筑基丹|筑基丹]]     → 去掉别名，应为 [[筑基丹]]
[[韩立]]             → 文件名不存在（实际是 [[韩立index]]），需确认
```

---

## 实体分页

触发：**>500行 或 >20KB**

流程：新摄入 → 检查行数 → `<400行`保留 / `400-500行`标记`#needs_split` / `>500行`立即拆分
- 人物按境界拆分，组织/场所按时间段拆分
- 结构：`entities/实体名/实体名index.md`（枢纽）+ `实体名-子页名.md`（子页，带实体名前缀避免与 concepts 同名冲突）
- 子页互链：`[[./韩立index]]`，枢纽页：`[[韩立index]]`

---

## 概念页审核

| status | 条件 |
|--------|------|
| `draft` | 默认 |
| `stable` | `source_count >= 3` + 关键属性齐全 + 无矛盾 |
| `needs_review` | 发现冲突 或 超500章未更新 |

每次 lint 时：draft + source_count>=3 → 审核 → 升级 stable

---

## 综合页分区

触发：>400行。按地理/篇章拆分（如 `时间线-天南篇.md`），每区150-250行。枢纽：`synthesis/综合页index.md`

---

## 校验脚本

```bash
node scripts/strip-prefixes.js               # 前缀剥离（全库）
node scripts/strip-prefixes.js --dry-run     # 仅预览
node scripts/validate-links.js               # 全量检查
node scripts/validate-links.js --all         # 含孤立页检测
node scripts/validate-links.js --json        # CI/JSON 输出
node scripts/validate-links.js --file=wiki/entities/xxx.md  # 单文件
```

`strip-prefixes.js`：移除 wikilink 中的 `entities/`/`concepts/`/`sources/`/`synthesis/` 前缀及别名，保留纯 `[[文件名]]`。

`validate-links.js` 检查：断链 | 遗留前缀 | 歧义链接 | 孤立页(`--orphans`)

Hook：`.claude/settings.json` PostToolUse `Write|Edit` → `async: true` → 自动校验

---

## index.md 与 log.md 格式

### index.md（轻型枢纽，<80行）

仅总览和统计，不列具体页面名。固定结构：表头（日期+总数）→ 分类统计表（含子索引链接）→ 最近更新（5条）→ 快速导航（4个入口链接）→ 统计表（按维度）。

### log.md（追加，保留30条）
```markdown
## [YYYY-MM-DD] ingest/lint/query | 摘要
- 创建: [[xxx]], [[yyy]]
- 更新: [[zzz]]
- 冲突: [[aaa]]
```

日志超出归档到 `log-archive/YYYY.md`（触发：`log.md > 100行`，归档最早条目，保留最近30条）
```

---

#### 12. `README.md`

写入用户使用说明：

```markdown
# LLM Wiki 项目

> 基于 Karpathy 模式的 LLM 维护知识库。

## 快速开始

1. 将来源文件放入 `raw/` 文件夹
2. 对 LLM 说 "请处理 raw/ 中的文件"（ingest）
3. LLM 会自动读取、分析、创建结构化 wiki

## 可用操作

- **ingest（摄入）**：处理 raw/ 中的新文件，提取实体/概念/来源
- **query（查询）**：基于 wiki 内容回答问题
- **lint（维护）**：链接校验、矛盾检测、概念审核

## 链接校验

```bash
node scripts/strip-prefixes.js               # 前缀剥离
node scripts/validate-links.js               # 基础检查
node scripts/validate-links.js --all         # 全面检查（含孤立页）
node scripts/validate-links.js --json        # CI/JSON 输出
```

## 目录结构

```
raw/          ← 原始来源（只读，不修改）
wiki/         ← LLM 生成的知识库
scripts/      ← 校验脚本
CLAUDE.md     ← LLM 行为规范
```

## 技术说明

本项目使用 `CLAUDE.md` 作为 LLM 的行为规范文件。LLM 在每次操作时都会遵循其中的约定。
```

### 第四步：初始化 Git

```bash
cd <当前目录> && git init && git add -A && git commit -m "chore: 初始化 LLM Wiki 项目（含子索引+校验脚本+Hook）"
```

### 第五步：输出成功信息

用中文告知用户：

```
✅ LLM Wiki 项目初始化完成！

📂 当前位置已创建完整 wiki 骨架（含子索引 + 链接校验 + 前缀剥离 + Hook 预设）。

🚀 接下来三步：
   1. 把来源文件放入 raw/ 文件夹
   2. 对我说 "请处理 raw/ 中的文件"
   3. 我会自动读取、分析、创建结构化 wiki

🛠️ 质量保障已就绪：
   - 每次编辑后自动运行链接校验（Hook）
   - 手动运行: node scripts/validate-links.js --all
   - 前缀清理: node scripts/strip-prefixes.js
   - 概念页会自动审核升级（draft → stable）

💡 也可以用 Obsidian 打开这个目录作为 Vault 浏览 wiki（设置: New link format → Shortest path）
```

---

## 注意事项

- 如果当前目录已经有文件，不要覆盖已有文件。在子目录 `wiki-project/` 中创建。
- 始终使用当天真实日期替换 `<当天日期>`。
- 所有输出和沟通使用简体中文。
- CLAUDE.md 是核心文件，必须完整写入，不可省略任何章节。
- `scripts/validate-links.js` 必须写入完整脚本（≥700 行）。如果无法获取完整脚本内容，写入一个包含断链检测和遗留前缀检测的精简版（≥200 行）。
- `scripts/strip-prefixes.js` 必须写入完整脚本（≥150 行）。如果技能目录中不可用，写入精简版。
- 文件写完后，告知用户 `/llm-wiki` 技能已执行完成。
- `.claude/settings.json` 如果已存在则合并 Hook 配置，不要覆盖。
