# Charted

An interactive mathematical knowledge map built with Astro, React, D3, and MDX. The goal is to provide a complete, interconnected guide to the major branches of mathematics — from undergraduate foundations to graduate research topics — with clear prose, LaTeX formulas, and historical context.

## Tech Stack

- **Astro 5** — static site generator with content collections
- **React 19** — interactive visualizations (D3-based knowledge graph)
- **Tailwind CSS 4** — styling
- **MDX** — content format (Markdown + JSX)
- **KaTeX** — LaTeX math rendering (via remark-math + rehype-katex)

## Content Schema

All content lives in `src/content/topics/` as `.mdx` files. The schema is defined in `src/content.config.ts`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | `string` | required | Display title |
| `description` | `string` | required | Short description (1-2 sentences) |
| `parent` | `string?` | — | Parent topic ID (e.g. `mathematics/logic`) |
| `order` | `number` | `0` | Sort order within parent |
| `color` | `string` | `#ef4444` | Display color |
| `difficulty` | `beginner \| intermediate \| advanced` | `beginner` | Difficulty level |
| `prerequisites` | `string[]` | `[]` | IDs of prerequisite topics |
| `status` | `stub \| draft \| review \| complete` | `stub` | Content status |
| `author` | `agent \| human` | — | Who wrote the initial content |
| `lastEditedBy` | `string` | — | Who last edited (e.g. `agent`, a person's name) |
| `lastUpdated` | `string` | — | ISO date of last edit (e.g. `2026-02-28`) |

## Status Workflow

```
stub → draft → review → complete
```

- **stub** — Placeholder with title and description only. Needs content.
- **draft** — Has full content (typically agent-written). Needs human review.
- **review** — Being reviewed/edited by a human.
- **complete** — Finalized, reviewed, and ready for publication.

## Authorship Conventions

- Set `author: agent` when an AI agent writes the initial content
- Set `author: human` when a person writes the initial content
- Always update `lastEditedBy` and `lastUpdated` when editing a file
- `lastEditedBy` can be `agent` or a person's name/handle

## Content Structure

The content is organized as a 3-level hierarchy:

```
mathematics/                    ← root (1 page)
├── logic/                      ← branch (10 branches)
│   ├── index.mdx              ← branch overview
│   ├── propositional-logic.mdx ← sub-topic
│   ├── first-order-logic.mdx
│   └── ...
├── set-theory/
│   ├── index.mdx
│   ├── naive-set-theory.mdx
│   └── ...
└── ...
```

### The 10 Branches

| # | Branch | Sub-topics | Description |
|---|--------|-----------|-------------|
| 1 | `logic/` | 9 | Logic & Foundations — formal reasoning, proof theory, computability |
| 2 | `set-theory/` | 9 | Set Theory — ZFC, ordinals, cardinals, forcing |
| 3 | `number-theory/` | 8 | Number Theory — primes, reciprocity, Langlands |
| 4 | `algebra/` | 6 | Algebra — groups, rings, categories, Lie theory |
| 5 | `geometry/` | 3 | Geometry — Euclidean, differential, algebraic |
| 6 | `topology/` | 2 | Topology — general and algebraic |
| 7 | `analysis/` | 8 | Analysis — real, complex, functional, PDEs |
| 8 | `combinatorics/` | 8 | Combinatorics — enumeration, graphs, designs |
| 9 | `probability/` | 2 | Probability & Statistics — measure-theoretic, Bayesian |
| 10 | `applied-mathematics/` | 6 | Applied — numerical, optimization, crypto, physics |

**Total: 61 sub-topic pages + 10 branch indexes + 1 root = 72 content pages**

### How parent/order/prerequisites work

- `parent` links a sub-topic to its branch (e.g. `mathematics/algebra`)
- `order` controls display order within a branch (1, 2, 3, ...)
- `prerequisites` lists topic IDs that should be read first (e.g. `["mathematics/logic/first-order-logic"]`)

## Writing Content

Every sub-topic already has its H2 section headings as a skeleton. To fill one in:

1. **Intro paragraph** (2-3 sentences) — what this topic is and why it matters
2. **Fill each H2 section** — the headings are already in place; write the content under each
3. **Clear prose** — explain ideas before formalizing them
4. **LaTeX formulas** — use `$inline$` and `$$block$$` math notation
5. **Historical context** — who discovered it, when, why it matters
6. **Key theorems** — state important results precisely
7. **Connections** — mention how the topic relates to other branches

### Math notation

Inline math: `$p \land q$` renders as $p \land q$

Block math:
```
$$\neg(p \land q) \;\equiv\; \neg p \lor \neg q$$
```

### What NOT to do

- Don't use JSX components in content (pure MDX prose + math)
- Don't add images (no image pipeline set up yet)
- Don't change frontmatter fields beyond what the schema defines
- Don't create new branches without updating the root and this document

## Research Reference

The `.research/` directory (gitignored) contains the source material from a deep-research agent:

```
.research/
├── INDEX.md           ← master index of all 32 disciplines
└── topics/
    ├── 01-mathematical-logic.md
    ├── 02-set-theory.md
    └── ... (32 files)
```

Each research file contains a detailed chapter-by-chapter outline for that discipline. **Always read the relevant research file before writing content** — it contains the structure, key theorems, and section breakdowns that should inform the article.

### Research-to-branch mapping

Some branches map to one research topic; others combine several:

- `logic/` ← 01
- `set-theory/` ← 02
- `number-theory/` ← 03
- `algebra/` ← 05, 06, 07, 08, 09, 32
- `geometry/` ← 15, 16, 17
- `topology/` ← 18, 19
- `analysis/` ← 10, 11, 12, 13, 14, 20, 21, 22
- `combinatorics/` ← 04, 27
- `probability/` ← 25, 26
- `applied-mathematics/` ← 23, 24, 28, 29, 30, 31

## Progress Tracking

Check content progress:

```bash
node scripts/progress.mjs
```

This outputs a table showing stub/draft/review/complete counts per branch and overall completion percentage.

## Agent Workflow

Step-by-step for a content-writing agent:

1. **Find work** — Run `node scripts/progress.mjs` to see which sub-topics are stubs
2. **Read the stub** — Open the `.mdx` file, read its frontmatter to understand the topic
3. **Read the research** — Open the corresponding `.research/topics/NN-*.md` file for the chapter outline
4. **Study the style** — Read 1-2 existing logic sub-topics (e.g. `propositional-logic.mdx`, `model-theory.mdx`) for tone, depth, and formatting reference
5. **Write the content** — 2-3 sentence intro + 4-6 H2 sections with prose, LaTeX, historical context, and key theorems
6. **Update frontmatter** — Set `status: draft`, `author: agent`, `lastEditedBy: agent`, `lastUpdated: <today's date>`
7. **Verify** — Run `npm run build` to confirm no errors

## Development

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
```
