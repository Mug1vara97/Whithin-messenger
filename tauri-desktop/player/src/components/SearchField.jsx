import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { useSearch } from '../store/search';

export function SearchField({ autoFocus = false }) {
  const query = useSearch((s) => s.query);
  const setQuery = useSearch((s) => s.setQuery);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!autoFocus) return;
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, [autoFocus]);

  return (
    <label className="search-input">
      <Icon name="search" size={22} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Что хотите послушать?"
        spellCheck={false}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
      />
      {query && (
        <button type="button" className="search-input__clear" onClick={() => setQuery('')} title="Очистить">
          <Icon name="close" size={20} />
        </button>
      )}
    </label>
  );
}
