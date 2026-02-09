import { formatDate } from '@/utils/date';
import { useSearchIndex } from '@/hooks/useSearchIndex';

export default function SearchResults() {
  const { results, query, isLoading, search } = useSearchIndex({ lazy: false });

  return (
    <div className="w-full">
      <div className="mb-8">
        <input
          type="text"
          placeholder="검색어를 입력하세요..."
          value={query}
          onChange={(e) => search(e.target.value, 10)}
          className="w-full px-4 py-3 text-lg border border-slate-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': 'var(--color-accent)' } as React.CSSProperties}
          autoFocus
        />
      </div>

      {isLoading ? (
        <p className="text-center text-slate-500 dark:text-zinc-400">검색 인덱스 로딩 중...</p>
      ) : query && results.length === 0 ? (
        <p className="text-center text-slate-500 dark:text-zinc-400">
          "{query}"에 대한 검색 결과가 없습니다.
        </p>
      ) : (
        <div className="space-y-6">
          {results.map((result) => (
            <article key={result.slug} className="group">
              <a href={`/posts/${result.slug}`} className="block">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                    <time datetime={result.pubDate}>{formatDate(result.pubDate)}</time>
                    <span>•</span>
                    <span style={{ color: 'var(--color-accent)' }}>{result.category}</span>
                  </div>
                  <h2 className="text-xl font-semibold group-hover:opacity-70 transition-opacity dark:text-white">
                    {result.title}
                  </h2>
                  <p className="text-slate-600 dark:text-zinc-300 line-clamp-2">{result.description}</p>
                </div>
              </a>
            </article>
          ))}
        </div>
      )}

      {!query && !isLoading && (
        <p className="text-center text-slate-500 dark:text-zinc-400">검색어를 입력해주세요.</p>
      )}
    </div>
  );
}
