# Charted

An interactive, open-source map of the sciences — starting with mathematics.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Tech stack

- [Astro 5](https://astro.build) — static site generator
- [React 19](https://react.dev) — interactive islands
- [Tailwind CSS 4](https://tailwindcss.com) — styling
- [D3.js](https://d3js.org) — data visualization
- [Departure Mono](https://departuremono.com) — heading font
- [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) — body font

## Adding content

Topics live in `src/content/topics/` as MDX files. Each file has frontmatter defining its title, description, parent, prerequisites, and status.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

Code: MIT. Content: CC BY-SA 4.0.
