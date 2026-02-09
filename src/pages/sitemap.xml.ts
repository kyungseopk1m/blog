import type { APIContext } from 'astro';
import { getSortedPosts } from '@/utils/posts';

export async function GET(context: APIContext) {
  const posts = await getSortedPosts();
  const siteUrl = context.site ?? 'https://kyungseopk1m.github.io';

  // 정적 페이지 정의
  const staticPages = [
    { url: '', priority: 1.0, changefreq: 'daily' },
    { url: 'about/', priority: 0.5, changefreq: 'monthly' },
    { url: 'archive/', priority: 0.6, changefreq: 'weekly' },
    { url: 'search/', priority: 0.3, changefreq: 'monthly' },
  ];

  // XML 생성
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map(
    (page) => `  <url>
    <loc>${siteUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
${posts
  .map(
    (post) => `  <url>
    <loc>${siteUrl}posts/${post.slug}/</loc>
    <lastmod>${post.data.pubDate.toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
