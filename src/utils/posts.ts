import { getCollection } from 'astro:content';

export async function getPublishedPosts() {
  return getCollection('posts', ({ data }) => !data.draft);
}

export async function getSortedPosts() {
  const posts = await getPublishedPosts();
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
