import type { APIRoute } from 'astro';
import { getPublishedPosts } from '@/utils/posts';

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '') // 헤딩 제거
    .replace(/\*\*(.+?)\*\*/gs, '$1') // 볼드 제거 (s 플래그로 멀티라인 지원)
    .replace(/\*([^*]+?)\*/g, '$1') // 이탤릭 제거 (더 정확한 패턴)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 링크 제거 (더 안전)
    .replace(/```[\s\S]*?```/g, '') // 코드 블록 완전 제거
    .replace(/`([^`]+)`/g, '$1') // 인라인 코드
    .replace(/<[^>]+>/g, '') // HTML 태그 제거
    .replace(/^\s*[-*+]\s+/gm, '') // 리스트 제거
    .replace(/^\s*\d+\.\s+/gm, '') // 숫자 리스트 제거
    .replace(/^\s*>\s+/gm, '') // 인용 제거
    .replace(/\n{3,}/g, '\n\n') // 연속 줄바꿈 정리
    .trim();
}

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  const searchIndex = posts.map((post) => {
    return {
      slug: post.slug,
      title: post.data.title,
      description: post.data.description,
      content: stripMarkdown(post.body),
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
