// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
//
// Astro 5 default output is `static`. With an adapter installed, individual
// routes can opt into on-demand server rendering via `export const prerender = false`.
// All content pages stay statically generated; only `src/pages/api/*` runs as
// serverless functions on Vercel.
export default defineConfig({
  adapter: vercel(),
  integrations: [
    react(),
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
