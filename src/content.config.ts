import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const sourceSchema = z.object({
  type: z.enum(['paper', 'textbook', 'lecture', 'article']),
  title: z.string(),
  authors: z.array(z.string()).default([]),
  year: z.number().optional(),
  arxiv: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  role: z.enum(['primary', 'supporting', 'historical']).default('supporting'),
});

const topics = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/topics' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    parent: z.string().optional(),
    order: z.number().default(0),
    color: z.string().default('#ef4444'),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    prerequisites: z.array(z.string()).default([]),
    status: z.enum(['stub', 'draft', 'review', 'complete', 'archived']).default('stub'),
    author: z.enum(['agent', 'human']).optional(),
    lastEditedBy: z.string().optional(),
    lastUpdated: z.string().optional(),
    agentReviewCount: z.number().default(0),
    contributors: z.array(z.string()).default([]),
    reviewTier: z.enum(['foundation', 'field', 'frontier']).default('foundation'),
    sources: z.array(sourceSchema).default([]),
    reviewIssue: z.number().optional(),
  }),
});

export const collections = { topics };
