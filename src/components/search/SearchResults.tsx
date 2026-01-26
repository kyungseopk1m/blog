import { useState, useEffect, useCallback } from 'react';
import FlexSearch from 'flexsearch';
import { formatDate } from '@/utils/date';

interface SearchDocument {
  slug: string;
  title: string;
  description: string;
  content: string;
  category: string;
  pubDate: string;
}

interface SearchResult {
  slug: string;
  title: string;
  description: string;
  category: string;
  pubDate: string;
}

export default function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [index, setIndex] = useState<FlexSearch.Document<SearchDocument> | null>(null);
  const [documents, setDocuments] = useState<SearchDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSearchIndex = async () => {
      try {
        const response = await fetch('/search-index.json');
        const data: SearchDocument[] = await response.json();
        setDocuments(data);

        const searchIndex = new FlexSearch.Document<SearchDocument>({
          document: {
            id: 'slug',
            index: ['title', 'description', 'content'],
            store: ['slug', 'title', 'description', 'category', 'pubDate'],
          },
          tokenize: 'forward',
          cache: true,
        });

        data.forEach((doc) => {
          searchIndex.add(doc);
        });

        setIndex(searchIndex);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load search index:', error);
        setIsLoading(false);
      }
    };

    loadSearchIndex();
  }, []);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);

      if (!index || !searchQuery.trim()) {
        setResults([]);
        return;
      }

      const searchResults = index.search(searchQuery, {
        limit: 10,
        enrich: true,
      });

      // Flatten and deduplicate results
      const uniqueResults = new Map<string, SearchResult>();

      searchResults.forEach((fieldResult) => {
        fieldResult.result.forEach((item) => {
          if (typeof item !== 'number' && item.doc) {
            const doc = item.doc;
            if (!uniqueResults.has(doc.slug)) {
              uniqueResults.set(doc.slug, {
                slug: doc.slug,
                title: doc.title,
                description: doc.description,
                category: doc.category,
                pubDate: doc.pubDate,
              });
            }
          }
        });
      });

      setResults(Array.from(uniqueResults.values()));
    },
    [index]
  );

  return (
    <div className="w-full">
      <div className="mb-8">
        <input
          type="text"
          placeholder="검색어를 입력하세요..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
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
                    <time>{formatDate(result.pubDate)}</time>
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
