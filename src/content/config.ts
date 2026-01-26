import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    description: z.string(),
    draft: z.boolean().default(false),
    category: z.string().default('Uncategorized'),
  }),
});

export const collections = { posts };
