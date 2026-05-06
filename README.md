<div align="center">

<img width="80" height="80" alt="Charted" src="public/logo.svg" />

**The first collaborative encyclopedia mapping the path from foundations to the frontier of science.**

Built with agents, reviewed by experts. Each topic is a node, each prerequisite is an edge. Pick a frontier paper and see every concept you need to read it; pick a topic you already know and see where it leads.

[Open the atlas](https://charted.science) · [Contributing](#contributing) · [Tech stack](#tech-stack)

</div>

<p align="center">
  <img src="assets/demo.avif" alt="Charted demo" width="800" />
</p>

---

## How it works

- **Agents draft.** Vast research and topic exploration is what they're good at.
- **Humans review.** Domain experts approve content within their declared expertise — tracked publicly in [`reviewers.yml`](reviewers.yml).
- **GitHub is the source of truth.** Topics, reviewer registry, and review-state all live in this repo. Each topic has a tracking issue; PRs reference it.

## Scope (MVP)

Charted's current focus is the **prerequisite closure to read modern machine-learning papers** — the foundations to climb to the frontier of ML/NLP. Topics outside that closure are archived (still in the repo, hidden from list views) until a frontier paper pulls them back in.

To extend scope, run the paper-ingestion script and add a frontier-tier topic:

```bash
npm run ingest:paper -- <arxivId> --anchor <topicId>
```

It fetches arXiv metadata, computes prerequisite-closure overlap with the current MVP, and emits draft frontmatter plus `authors.yml` entries.

## Quick start

```bash
git clone https://github.com/codika-io/charted.git
cd charted
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321). The dev server hot-reloads on file changes; `predev` regenerates the topic graph.

## Contributing

PRs touching content require **reviewer attestation** — `Reviewer-GitHub`, `Reviewer-ORCID`, and `Reviewer-Tier` trailers in the PR body. CI posts an advisory comment; final approval is a maintainer call.

To register as a reviewer, add yourself to [`reviewers.yml`](reviewers.yml) and open a PR with a brief justification.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full flow, including the unified topic/source model, reviewer tiers, and writing guidelines.

## Architecture

| File / dir | What it is |
|---|---|
| `src/content/topics/**.mdx` | Every topic. Frontmatter + MDX body. |
| `reviewers.yml` | Canonical reviewer registry. CI parses this. |
| `authors.yml` | Paper-author registry referenced by `sources[].authors`. |
| `scripts/build-graph.mjs` | Pre-build step. Emits `src/generated/graph.json` with bidirectional closures. |
| `scripts/ingest-paper.mjs` | arXiv → closure overlap + frontmatter draft. |
| `scripts/seed-issues.mjs` | One-time: creates a tracking issue per topic. |
| `scripts/archive-non-mvp.mjs` | One-time: marks non-MVP topics `status: archived`. |
| `src/components/islands/AtlasGraph.tsx` | Layered DAG visualization (ELK + React Flow). |
| `src/pages/atlas.astro` | Full atlas with three view modes. |
| `src/pages/contributors/[handle].astro` | Per-reviewer profile page. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Required reviewer-attestation trailers. |
| `.github/workflows/review-check.yml` | Soft-enforced CI attestation check. |

## Tech stack

[Astro 5](https://astro.build) · [React 19](https://react.dev) · [Tailwind CSS 4](https://tailwindcss.com) · [KaTeX](https://katex.org) · [React Flow](https://reactflow.dev) · [ELK](https://eclipse.dev/elk/) · [Departure Mono](https://departuremono.com) · [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif)

## License

Code: [MIT](LICENSE). Content (`src/content/`): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
