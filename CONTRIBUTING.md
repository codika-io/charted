# Contributing to Charted

Charted is the first collaborative encyclopedia where agents and humans split the work along their strengths: agents draft, humans review. This guide covers everything you need to contribute.

## Development setup

```bash
git clone https://github.com/codika-io/charted.git
cd charted
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321). The dev server hot-reloads on file changes.

## Scope: the MVP closure

Charted's current scope is the **prerequisite closure to read modern machine-learning papers** — the math, theoretical CS, and AI/ML topics needed to understand papers like *Attention Is All You Need*. Topics outside that closure live in the repo with `status: archived` and are filtered out of every list view.

When you contribute, work on a non-archived topic. To re-introduce an archived area, open a PR rationale-first: explain which frontier paper or topic chain pulls it back into scope.

## Content overview

All content lives in `src/content/topics/` as MDX files organized by branch.

```
src/content/topics/
├── mathematics/
│   ├── index.mdx                ← root
│   ├── algebra/
│   │   ├── index.mdx            ← branch overview
│   │   ├── linear-algebra.mdx   ← sub-topic
│   │   └── ...
│   └── ...
└── computer-science/
    └── ...
```

## The unified topic model

Charted has **one node type: `topic`**. Frontier papers are not separate "paper nodes" — they are sources of focused topics. A topic about self-attention has the *Attention Is All You Need* paper in its `sources:` array; the page is about the idea, not the artifact.

This means:

- New papers extend topics by appending sources, not by creating leaves.
- Two papers introducing the same idea collapse into one topic with two sources.
- Topic granularity should match how expertise actually clusters in the wild — not "Algebra" (too broad), not "Self-attention scaling laws ≤12B" (too narrow).

## Frontmatter schema

```yaml
---
title: Self-Attention                                  # required
description: A one-sentence description.               # required
parent: computer-science/ai-and-machine-learning       # parent topic ID
order: 3                                               # sort within parent
color: "#3b82f6"                                       # display color
difficulty: intermediate                               # beginner | intermediate | advanced
prerequisites:                                         # learning DAG
  - mathematics/algebra/linear-algebra
  - mathematics/probability/probability-theory
status: draft                                          # stub | draft | review | complete | archived
reviewTier: frontier                                   # foundation | field | frontier
sources:                                               # primary references
  - type: paper
    title: "Attention Is All You Need"
    authors: [vaswani-2017, shazeer-2017, ...]         # keys from authors.yml
    year: 2017
    arxiv: "1706.03762"
    role: primary                                      # primary | supporting | historical
author: agent                                          # agent | human
lastEditedBy: your-handle
lastUpdated: "2026-05-05"
reviewIssue: 42                                        # GitHub issue tracking this topic
---
```

## Status workflow

| Status     | Meaning |
|------------|---------|
| `stub`     | Placeholder. Needs content. |
| `draft`    | Has content (often agent-written). Needs human review. |
| `review`   | A human is actively reviewing or editing. |
| `complete` | Finalized and approved. |
| `archived` | Outside the active MVP scope. Not shown in list views. |

The workflow is: **stub → draft → review → complete**.

## Reviewer tiers

Charted gates reviewers by *kind of topic*, not just by identity. Three tiers:

| Tier | Topics | Bar to review |
|------|--------|----------------|
| **foundation** | stable, textbook subjects (linear algebra, probability, calculus, …) | STEM degree + has reviewed N upstream topics first |
| **field** | mid-level research areas (convex optimization, information theory, …) | ≥3 indexed papers (OpenAlex / Semantic Scholar) tagged in the concept |
| **frontier** | specific cutting-edge topics tied to a primary paper | author of the primary source, or substantively cited by it |

This is **soft-enforced**. The CI bot posts an advisory check on every PR (✅ matched / ⚠️ no expertise match), but final approval is always a maintainer call. As the reviewer pool grows, we'll tighten gating.

## How to register as a reviewer

1. Edit [`reviewers.yml`](reviewers.yml) and add yourself:

   ```yaml
   - github: your-handle
     orcid: 0000-0000-0000-0000   # required for field/frontier tier
     name: Your Name
     expertise:
       - computer-science/ai-and-machine-learning/natural-language-processing
     tier: field
     verifiedBy: ~                # filled in by the maintainer reviewing your PR
     verifiedAt: ~
   ```

2. Open a PR with a brief justification — link your Google Scholar, ORCID record, or institutional page. A maintainer reviews and merges.
3. Once merged, you can self-attest reviews on PRs touching topics within your declared `expertise` scope. Your profile appears at `/contributors/your-handle`.

`expertise` may name a topic ID **or** a branch ID — branch-level expertise credits you to every descendant.

## How to write or improve a topic

### 1. Pick a topic

- Run `npm run dev` and open `/status` to see what needs work.
- Or find a topic with `status: stub` or `status: draft` and pick one in your area.
- Open the GitHub issue listed under `reviewIssue` (or open one if missing) and comment to claim — this prevents duplicate work.

### 2. Write the content

Each topic page should have:

- **Intro paragraph** (2-3 sentences) — what this topic is and why it matters.
- **Build intuition before formalism** — clear prose first, formal definitions after.
- **Historical context** — who discovered it, when, why it mattered.
- **Key results** — state important theorems precisely, with LaTeX.
- **Connections** — how this topic relates to others in the graph.

### 3. Use LaTeX for math

KaTeX is wired up. Inline: `$e^{i\pi} + 1 = 0$`. Block:

```
$$
\int_0^\infty e^{-x^2} \, dx = \frac{\sqrt{\pi}}{2}
$$
```

### 4. Update frontmatter

```yaml
status: draft        # or review/complete depending on stage
lastEditedBy: your-handle
lastUpdated: "2026-05-05"
```

### 5. Build check

```bash
npm run build
```

`prebuild` re-generates `src/generated/graph.json`. Make sure it passes with no errors before submitting.

## Pull request flow

Every PR uses the [`PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) which requires three trailers in the body:

```
- Reviewer-GitHub: @your-handle
- Reviewer-ORCID: 0000-0000-0000-0000
- Reviewer-Tier: foundation
```

CI parses these on every push and posts an advisory comment. The check is informational — it never blocks merge. Reference the topic's tracking issue with `Closes #N`.

## Adding a paper / extending a frontier topic

To add a new paper as a source for a topic, or to evaluate whether a paper should anchor a new topic:

```bash
npm run ingest:paper -- <arxivId> --anchor <topicId>
```

The script fetches arXiv metadata, computes the prerequisite-closure overlap with the current MVP, and emits draft `sources:` and `authors.yml` entries you can paste in.

For the new paper to anchor a new topic (rather than extending an existing one), the topic should be at `frontier` tier, and one of the paper's authors should ideally be in the registered reviewer pool.

## Content guidelines

- **Be accurate.** Always cite primary sources in the `sources:` array.
- **Be concise.** This is a map, not an encyclopedia.
- **Show connections.** Explain how topics relate.
- **No JSX components** in content — pure MDX prose and math.
- **No images** — there's no image pipeline yet.

## Editing an existing topic

Click the "Edit on GitHub" button on any topic page, or find the MDX file directly in `src/content/topics/`.
