import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);

  const searchIndex = await Promise.all(
    posts.map(async (post) => {
      const { remarkPluginFrontmatter } = await post.render();

      return {
        slug: post.slug,
        title: post.data.title,
        description: post.data.description,
        content: post.body,
        category: post.data.category,
        pubDate: post.data.pubDate.toISOString(),
      };
    })
  );

  return new Response(JSON.stringify(searchIndex), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
