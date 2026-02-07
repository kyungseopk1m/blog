import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_TITLE, SITE_DESCRIPTION } from '@/consts';
import { getSortedPosts } from '@/utils/posts';

export async function GET(context: APIContext) {
  const sortedPosts = await getSortedPosts();

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site ?? 'https://kyungseopk1m.github.io',
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/posts/${post.slug}`,
    })),
  });
}
