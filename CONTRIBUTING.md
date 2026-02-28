# Contributing to Charted

Thanks for your interest in mapping the sciences! This guide covers everything you need to contribute content or code.

## Development setup

```bash
git clone https://github.com/codika-io/charted.git
cd charted
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321). The dev server hot-reloads on file changes.

## Content overview

All content lives in `src/content/topics/` as MDX files organized by branch:

```
src/content/topics/
├── mathematics.mdx              ← root
├── logic/
│   ├── index.mdx                ← branch overview
│   ├── propositional-logic.mdx  ← sub-topic
│   └── ...
├── algebra/
│   └── ...
└── ...
```

### Status workflow

Every topic has a `status` field in its frontmatter:

| Status | Meaning |
|--------|---------|
| `stub` | Placeholder with title and H2 section skeletons. Needs content. |
| `draft` | Has full content. Needs human review. |
| `review` | Being reviewed or edited by a human. |
| `complete` | Finalized, reviewed, ready for publication. |

The workflow is: **stub → draft → review → complete**.

### Frontmatter schema

```yaml
---
title: Topic Name                          # required
description: A one-sentence description.   # required
parent: mathematics/algebra                # parent topic ID
order: 3                                   # sort order within parent
color: "#ef4444"                           # display color (default: #ef4444)
difficulty: intermediate                   # beginner | intermediate | advanced
prerequisites:                             # topic IDs that should be read first
  - mathematics/logic/first-order-logic
status: draft                              # stub | draft | review | complete
author: human                              # agent | human
lastEditedBy: your-name                    # who last edited
lastUpdated: "2026-02-28"                  # ISO date of last edit
---
```

## How to write content

### 1. Pick a stub

Look for topics with `status: stub` — these have H2 section headings already in place but no content. Run `node scripts/progress.mjs` to see the full status table.

### 2. Write the content

Fill in each H2 section. Follow this approach:

- **Intro paragraph** (2-3 sentences) — what this topic is and why it matters
- **Explain before formalizing** — build intuition with clear prose before stating formal definitions
- **Historical context** — who discovered it, when, and why it mattered
- **Key theorems** — state important results precisely with LaTeX
- **Connections** — mention how the topic relates to other branches of mathematics

### 3. Use LaTeX for math

Charted uses KaTeX for rendering. Two syntaxes:

**Inline math** — wrap with single dollar signs:

```
The equation $e^{i\pi} + 1 = 0$ connects five fundamental constants.
```

**Block math** — wrap with double dollar signs:

```
$$
\int_0^\infty e^{-x^2} \, dx = \frac{\sqrt{\pi}}{2}
$$
```

### 4. Update frontmatter

When you're done writing:

```yaml
status: draft          # was "stub"
author: human          # or "agent" if AI-written
lastEditedBy: your-name
lastUpdated: "2026-02-28"
```

### 5. Build check

```bash
npm run build
```

Make sure it passes with no errors before submitting.

## How to review drafts

Topics with `status: draft` need human review. To review one:

1. Read the content for accuracy, clarity, and completeness
2. Check that LaTeX renders correctly (`npm run dev`)
3. Verify prerequisite links point to existing topics
4. Edit as needed, then update the frontmatter:

```yaml
status: review         # you're actively reviewing
lastEditedBy: your-name
lastUpdated: "2026-02-28"
```

When satisfied, set `status: complete`.

## Content guidelines

- **Be accurate.** Cite sources where possible.
- **Be concise.** This is a map, not an encyclopedia.
- **Show connections.** Explain how topics relate to each other.
- **Use clear language.** Aim for accessibility without sacrificing precision.
- **No JSX components** in content — pure MDX prose and math only.
- **No images** — there's no image pipeline yet.

## Pull request guidelines

- **One topic per PR** — makes review easier.
- **Run `npm run build`** before submitting — the build must pass.
- **Describe what you wrote** in the PR description.
- **Don't modify the content schema** without opening an issue first.

## Editing an existing topic

Click the "Edit on GitHub" button on any topic page, or find the MDX file directly in `src/content/topics/`.
