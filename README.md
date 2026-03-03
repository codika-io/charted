# Charted

An interactive, open-source atlas of the sciences — mathematics, computer science, and physics.

Charted visualizes knowledge as a graph: each topic is a node, each connection is an edge. Instead of learning from a linear textbook, you can see how fields connect, explore branches, and trace the path from foundations to frontiers.

## What's mapped

| Domain | Branches | Topics | Rings |
|--------|----------|--------|-------|
| Mathematics | 10 | 62 | 6 |
| Computer Science | 7 | 29 | 4 |
| Physics | 7 | 26 | 4 |

**114 topics** are drafted across all three domains. Each page covers key ideas, theorems, historical context, and connections to related fields — with LaTeX-rendered formulas throughout.

Content was initially scaffolded with AI and is being reviewed and improved by contributors. Check the [status page](https://charted.codika.io/status) to see what needs attention.

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

- [Astro 5](https://astro.build) — static site generator
- [React 19](https://react.dev) — interactive isometric map components
- [Tailwind CSS 4](https://tailwindcss.com) — styling
- [KaTeX](https://katex.org) — LaTeX math rendering
- [Departure Mono](https://departuremono.com) — heading font
- [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) — body font

## License

Code: [MIT](LICENSE). Content (`src/content/`): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
