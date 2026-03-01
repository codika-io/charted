import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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
    status: z.enum(['stub', 'draft', 'review', 'complete']).default('stub'),
    author: z.enum(['agent', 'human']).optional(),
    lastEditedBy: z.string().optional(),
    lastUpdated: z.string().optional(),
    agentReviewCount: z.number().default(0),
  }),
});

export const collections = { topics };
