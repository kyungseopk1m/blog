import type { APIRoute } from 'astro';
import { getPublishedPosts } from '@/utils/posts';

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  const searchIndex = posts.map((post) => {
    return {
      slug: post.slug,
      title: post.data.title,
      description: post.data.description,
      content: post.body,
      category: post.data.category,
      pubDate: post.data.pubDate.toISOString(),
    };
  });

  return new Response(JSON.stringify(searchIndex), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
