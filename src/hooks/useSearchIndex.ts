import { useState, useEffect, useCallback } from 'react';
import FlexSearch from 'flexsearch';
import type { SearchDocument, SearchResult } from '@/types/search';

interface UseSearchIndexOptions {
  lazy?: boolean;
}

export function useSearchIndex(options: UseSearchIndexOptions = {}) {
  const { lazy = false } = options;

  const [index, setIndex] = useState<FlexSearch.Document<SearchDocument> | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(!lazy);

  const loadSearchIndex = useCallback(async () => {
    if (index) return; // Already loaded

    try {
      setIsLoading(true);
      const response = await fetch('/search-index.json');
      const data: SearchDocument[] = await response.json();

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
    } catch (error) {
      console.error('Failed to load search index:', error);
    } finally {
      setIsLoading(false);
    }
  }, [index]);

  // Auto-load if not lazy
  useEffect(() => {
    if (!lazy) {
      loadSearchIndex();
    }
  }, [lazy, loadSearchIndex]);

  const search = useCallback(
    (searchQuery: string, limit: number = 10) => {
      setQuery(searchQuery);

      if (!index || !searchQuery.trim()) {
        setResults([]);
        return;
      }

      const searchResults = index.search(searchQuery, {
        limit,
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

  return {
    index,
    results,
    query,
    isLoading,
    loadSearchIndex,
    search,
  };
}
