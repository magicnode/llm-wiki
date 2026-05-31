---
name: llm-wiki
description: 在当前目录初始化 LLM Wiki 知识库系统（基于 Karpathy 模式）。用 `/llm-wiki` 一键创建空白 wiki 项目结构，包含 CLAUDE.md 行为规范、目录骨架、索引和日志文件。
---

<!--
  ╔══════════════════════════════════════════════════════════════╗
  ║  开发说明                                                   ║
  ║                                                            ║
  ║  本文件是"引导程序"——仅在 /llm-wiki 被调用时执行一次。      ║
  ║  wiki 日常行为由 CLAUDE.md 控制，本文件内含其完整副本。     ║
  ║                                                            ║
  ║  源码位置（开发时从这里改）：                                ║
  ║    f:/Coding/AI/AICode/obsdian-skills/CLAUDE.md             ║
  ║    f:/Coding/AI/AICode/obsdian-skills/README.md             ║
  ║                                                            ║
  ║  修改流程：                                                 ║
  ║    改 wiki 行为 → 先改源码 CLAUDE.md → 测试 → 同步到本文件  ║
  ║    改初始化流程 → 直接改本文件 → /llm-wiki 测试              ║
  ║                                                            ║
  ║  详细指南：README.md 的「技能开发指南」章节                  ║
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
wiki/
wiki/entities/
wiki/concepts/
wiki/sources/
wiki/comparisons/
wiki/synthesis/
wiki/queries/
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

#### 3. `wiki/index.md`

```markdown
# Wiki 索引

> 📅 创建于: <当天日期 YYYY-MM-DD>
> 📊 总页面数: 0
> 🏗️ 状态: 空白项目，等待第一批来源摄入

---

## 实体 (entities/)

*暂无内容 — 将来源文件放入 `raw/` 后告诉 LLM 开始 ingest*

## 概念 (concepts/)

*暂无内容*

## 来源 (sources/)

*暂无内容*

## 对比 (comparisons/)

*暂无内容*

## 综合 (synthesis/)

*暂无内容*

## 查询归档 (queries/)

*暂无内容*
```

#### 4. `wiki/log.md`

```markdown
# Wiki 日志

## [<当天日期>] system | Wiki 项目初始化
- 创建: 目录结构和空白 wiki
- 状态: 系统就绪，等待第一批来源摄入
```

#### 5. `CLAUDE.md`

写入以下完整内容（这是核心文件，是 LLM 的 Wiki 维护行为规范）：

---

```markdown
# LLM Wiki — Schema & Conventions

> 这是 LLM 知识库的核心配置文件。它教会 LLM 如何成为一个有纪律的 wiki 维护者，而不是一个通用聊天机器人。
>
> 基于 Andrej Karpathy 的 LLM Wiki 模式：<https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>

---

## 架构概览

```
<项目根目录>/
├── CLAUDE.md          ← LLM 的行为规范（Schema）
├── README.md          ← 用户使用说明
├── raw/               ← 原始来源文档（只读，不可修改）
├── wiki/              ← LLM 生成的 markdown 知识库
│   ├── index.md       ← 内容目录（每次 ingest 后更新）
│   ├── log.md         ← 时间线记录（追加模式）
│   ├── entities/      ← 实体页面（人物、组织、产品、技术）
│   ├── concepts/      ← 概念页面（理论、方法、框架）
│   ├── sources/       ← 来源摘要页面
│   ├── comparisons/   ← 对比分析页面
│   ├── synthesis/     ← 综合论述页面
│   └── queries/       ← 查询结果归档
```

---

## 文件大小处理策略（多级分档）

LLM 的上下文窗口是一个硬约束。不同大小的文件需要完全不同的策略。

### 级别总览

| 级别 | 文件大小 | Token 估算 | 策略名称 | 核心思路 |
|------|----------|-----------|---------|---------|
| L0 | < 200KB | < 5 万 | **直接处理** | 一次读完，正常 ingest |
| L1 | 200KB - 1MB | 5-25 万 | **分段处理** | LLM 分片阅读 + 累积摘要 |
| L2 | 1MB - 10MB | 25-250 万 | **拆分摄入** | 先脚本拆分文件，再逐文件摄入 |
| L3 | 10MB - 100MB | 250-2500 万 | **索引优先** | 不读全文，先生成索引，按需深入 |
| L4 | > 100MB | > 2500 万 | **外脑模式** | LLM 不直接读文本，改用搜索/工具代理 |

### L0: 直接处理（< 200KB）

一次读完，按标准 ingest 流程处理。

### L1: 分段处理（200KB - 1MB）

1. 先读头尾了解全局结构
2. 按自然边界（章节标题）分段
3. 逐段读取提取实体/概念/数据点
4. 维护累积摘要（`raw/_temp_summary.md`），每读完一段追加
5. 全部处理完后执行完整 ingest

### L2: 拆分摄入（1MB - 10MB）

不再让 LLM 直接操作原始文件。先用脚本按章节/标题拆分，再逐文件摄入。最后在 `wiki/synthesis/` 创建综合页面。

### L3: 索引优先（10MB - 100MB）

1. 用 grep/脚本生成结构化索引（标题、高频词、专有名词）
2. LLM 只读索引，不读正文
3. 创建来源摘要（标注"索引级处理"）
4. 用户查询时按需深入阅读相关段落
5. wiki 随查询而生长

### L4: 外脑模式（> 100MB）

LLM 不直接读源文件。工作流：
1. 用户提问 → LLM 生成搜索关键词
2. 用 grep/ripgrep/qmd 搜索源文件
3. LLM 只读搜索结果片段
4. 理解后写入 wiki（wiki 作为缓存层）

---

## 核心原则

1. **永远不要修改 `raw/` 中的文件。** 它们是只读的原始来源。
2. **你拥有 `wiki/` 中的所有内容。** 用户阅读 wiki；你编写和维护它。
3. **每次操作都要更新 index.md 和 log.md。**
4. **主动建立交叉引用。** 用 `[[folder/filename]]` 格式链接。
5. **标注矛盾和不确定性。** 新信息与旧信息冲突时明确指出。
6. **使用 YAML frontmatter。** 每个 wiki 页面都应包含。
7. **统一使用简体中文输出。** 无论原文是繁体中文、英文还是其他语言，wiki 正文必须使用简体中文。原始引文可放在 `> 原文引用` 块中。

---

## Wiki 页面模板

### 实体页面 (wiki/entities/<name>.md)

```markdown
---
type: entity
category: person | organization | product | technology | event
tags: [tag1, tag2]
created: YYYY-MM-DD
updated: YYYY-MM-DD
source_count: N
aliases: [alias1, alias2]
---

# 实体名称

## 概述
一句话描述。

## 关键信息
- **属性1**: 值

## 详细说明
...

## 相关实体
- [[其他实体]]

## 来源
- [[sources/xxx]]
```

### 概念页面 (wiki/concepts/<name>.md)

```markdown
---
type: concept
domain: <领域>
tags: [tag1, tag2]
created: YYYY-MM-DD
updated: YYYY-MM-DD
source_count: N
status: draft | stable | needs_review
---

# 概念名称

## 一句话定义
...

## 详细解释
...

## 与其他概念的关系
- [[相关概念A]] — 关系说明

## 来源
- [[sources/xxx]]
```

### 来源摘要页面 (wiki/sources/<filename>.md)

```markdown
---
type: source
format: article | paper | video | book | podcast | repo
url: https://...
authors: [author1]
published: YYYY-MM-DD
ingested: YYYY-MM-DD
tags: [tag1, tag2]
---

# 来源标题

## 一句话摘要
...

## 关键要点
1. ...
2. ...

## 涉及的实体
- [[entities/xxx]]

## 涉及的的概念
- [[concepts/xxx]]

## 原始文件
`raw/filename`
```

---

## 工作流程

### 1. Ingest（摄入）

用户将文件放入 `raw/` 并说"处理"时：

1. **评估大小** — 判断文件属于 L0-L4 哪一级
2. **读取处理** — 按对应级别的策略处理
3. **创建来源摘要** — 在 `wiki/sources/` 创建
4. **更新实体页面** — 创建新实体或更新已有实体
5. **更新概念页面** — 创建新概念或丰富已有概念
6. **检查冲突** — 标注矛盾
7. **更新 index.md** — 添加新条目
8. **追加 log.md** — 记录操作

### 2. Query（查询）

1. 先读 index.md 找相关页面
2. 深入阅读相关页面
3. 综合回答，引用来源（`[[page]]` 格式）
4. 有价值时询问是否归档到 `wiki/queries/`

### 3. Lint（维护）

1. 检查矛盾声明
2. 检查过时内容
3. 检查孤立页面（无入站链接）
4. 检查缺失页面（被提及但无专属页面的概念/实体）
5. 建议补充方向
6. 追加 log.md

---

## index.md 格式

```markdown
# Wiki 索引

> 最后更新: YYYY-MM-DD
> 总页面数: N

## 实体 (entities/)
- [[entities/name]] — 一句话描述 (来源数: N)

## 概念 (concepts/)
- [[concepts/name]] — 一句话描述 (来源数: N)

## 来源 (sources/)
- [[sources/filename]] — 一句话摘要 (YYYY-MM-DD)
```

---

## log.md 格式

每条日志以一致前缀开始：

```markdown
## [YYYY-MM-DD] ingest | 来源标题
- 创建: [[sources/xxx]], [[entities/xxx]], [[concepts/xxx]]
- 更新: [[entities/yyy]]
- 冲突: [[concepts/zzz]] 中标注矛盾

## [YYYY-MM-DD] query | 问题摘要
- 归档: [[queries/xxx]]

## [YYYY-MM-DD] lint | 第 N 次维护
- 发现矛盾: N 处
```

---

## 命名约定

- 文件名: 小写英文用 `-` 分隔 / 中文直接用中文
- Wikilink: `[[folder/filename]]` — Obsidian 兼容格式
- 页面大小: 200-800 行，超过则拆分
- 始终用简体中文与用户交流
```

#### 6. `README.md`

写入用户使用说明（从原项目 README 提取核心内容，去掉与当前项目绑定的具体内容）。

### 第四步：初始化 Git

```bash
cd <当前目录> && git init && git add -A && git commit -m "chore: 初始化 LLM Wiki 项目"
```

### 第五步：输出成功信息

用中文告知用户：

```
✅ LLM Wiki 项目初始化完成！

📂 当前位置已创建完整 wiki 骨架。

🚀 接下来三步：
   1. 把来源文件放入 raw/ 文件夹
   2. 对我说 "请处理 raw/ 中的文件"
   3. 我会自动读取、分析、创建结构化 wiki

💡 也可以用 Obsidian 打开这个目录作为 Vault 浏览 wiki
```

---

## 注意事项

- 如果当前目录已经有文件，不要覆盖已有文件。在子目录 `wiki-project/` 中创建。
- 始终使用当天真实日期替换 `<当天日期>`。
- 所有输出和沟通使用简体中文。
- CLAUDE.md 是核心文件，必须完整写入，不可省略任何章节。
- 文件写完后，告知用户 `/llm-wiki` 技能已执行完成。
