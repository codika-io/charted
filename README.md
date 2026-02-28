# Charted

An interactive, open-source map of the sciences — starting with mathematics.

Charted visualizes knowledge as a graph: each topic is a node, each prerequisite is an edge. Instead of learning from a linear textbook, you can see how fields connect, explore branches, and trace the path from foundations to frontiers.

## Current state

Mathematics is the first science being mapped. It has **10 branches** and **61 sub-topics** covering logic, set theory, number theory, algebra, geometry, topology, analysis, combinatorics, probability, and applied mathematics. 9 topics have full draft content; the rest are stubs waiting for contributors.

## Quick start

```bash
git clone https://github.com/codika-io/charted.git
cd charted
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Contributing

We welcome contributions of all kinds — new topic content, improved explanations, bug fixes, and design improvements. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, including how to pick a stub, write content, use LaTeX, and submit a PR.

## Tech stack

- [Astro 5](https://astro.build) — static site generator
- [React 19](https://react.dev) — interactive islands
- [Tailwind CSS 4](https://tailwindcss.com) — styling
- [D3.js](https://d3js.org) — data visualization
- [KaTeX](https://katex.org) — LaTeX math rendering
- [Departure Mono](https://departuremono.com) — heading font
- [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) — body font

## License

Code: [MIT](LICENSE). Content (`src/content/`): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
