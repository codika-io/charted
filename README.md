<div align="center">

<img width="80" height="80" alt="Charted" src="public/logo.svg" />

**An interactive, open-source atlas of the sciences.**

Charted visualizes knowledge as a graph: each topic is a node, each connection is an edge. Instead of learning from a linear textbook, you can see how fields connect, explore branches, and trace the path from foundations to frontiers.

[Explore the atlas](https://charted.science) · [Contributing](#contributing) · [Tech stack](#tech-stack)

</div>

<p align="center">
  <img src="assets/demo.avif" alt="Charted demo" width="800" />
</p>

---

## What's mapped

| Domain | Branches | Topics |
|--------|----------|--------|
| Mathematics | 10 | 61 |
| Computer Science | 7 | 28 |
| Physics | 7 | 25 |

**114 topics** across three domains. Each page covers key ideas, theorems, historical context, and connections to related fields — with LaTeX-rendered formulas throughout.

Content was initially scaffolded with AI and is being reviewed and improved by contributors. Check the [status page](https://charted.science/status) to see what needs attention.

## Quick start

```bash
git clone https://github.com/codika-io/charted.git
cd charted
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Contributing

We welcome contributions of all kinds — improving topic content, fixing explanations, adding LaTeX formulas, design improvements, and new features. Domain experts are especially welcome: pick a topic you know, review the draft, and submit a PR.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

## Tech stack

[Astro 5](https://astro.build) · [React 19](https://react.dev) · [Tailwind CSS 4](https://tailwindcss.com) · [KaTeX](https://katex.org) · [Departure Mono](https://departuremono.com) · [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif)

## License

Code: [MIT](LICENSE). Content (`src/content/`): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
