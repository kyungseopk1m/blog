import { useState, useEffect, useRef } from 'react';
import { formatDate } from '@/utils/date';
import { useSearchIndex } from '@/hooks/useSearchIndex';

export default function SearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const { results, query, loadSearchIndex, search } = useSearchIndex({ lazy: true });

  // Load search index when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSearchIndex();
    }
  }, [isOpen, loadSearchIndex]);

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for open-search-modal event
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-search-modal', handler);
    return () => window.removeEventListener('open-search-modal', handler);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      search('', 8); // Reset search
      setSelectedIndex(0);
    }
  }, [isOpen, search]);

  // Handle search input
  const handleSearchInput = (searchQuery: string) => {
    search(searchQuery, 8);
    setSelectedIndex(0);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      window.location.href = `/posts/${results[selectedIndex].slug}`;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="검색"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl mx-4 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.15s ease-out' }}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-slate-200 dark:border-zinc-700">
          <svg
            className="w-5 h-5 text-slate-400 dark:text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" strokeWidth="2" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="검색어를 입력하세요..."
            value={query}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-4 text-base outline-none bg-transparent dark:text-white dark:placeholder-zinc-500"
          />
          <kbd className="hidden sm:inline-flex px-2 py-1 text-xs text-slate-400 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {query && (
          <div ref={resultsRef} className="max-h-80 overflow-auto">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 dark:text-zinc-400">
                "{query}"에 대한 검색 결과가 없습니다.
              </div>
            ) : (
              results.map((result, idx) => (
                <a
                  key={result.slug}
                  href={`/posts/${result.slug}`}
                  className={`block px-4 py-3 transition-colors ${
                    idx === selectedIndex
                      ? 'bg-slate-100 dark:bg-zinc-800'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-1">
                    <span>{formatDate(result.pubDate)}</span>
                    <span>•</span>
                    <span style={{ color: 'var(--color-accent)' }}>{result.category}</span>
                  </div>
                  <div className="font-medium text-slate-900 dark:text-white">{result.title}</div>
                  <div className="text-sm text-slate-500 dark:text-zinc-400 truncate">
                    {result.description}
                  </div>
                </a>
              ))
            )}
          </div>
        )}

        {/* Footer hint */}
        {!query && (
          <div className="px-4 py-3 text-sm text-slate-400 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800">
            <span className="mr-4">
              <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-zinc-800 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-zinc-800 rounded ml-1">↓</kbd>
              <span className="ml-2">탐색</span>
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-zinc-800 rounded">↵</kbd>
              <span className="ml-2">이동</span>
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
