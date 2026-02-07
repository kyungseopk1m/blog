import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    description: z.string(),
    draft: z.boolean().default(false),
    category: z.string().default('Uncategorized'),
    centerContent: z.boolean().default(false),
  }),
});

export const collections = { posts };
