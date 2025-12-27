import { useState, useRef, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { filterAddresses } from '../data/sc_addresses';

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export default function AddressAutocompleteInput({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = "Enter a Charleston address...",
  className = "",
  inputClassName = "",
  required = false,
  autoFocus = false,
  id = "address-input",
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    const filtered = filterAddresses(newValue);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedIndex(-1);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else {
          setShowSuggestions(false);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;

      case 'Tab':
        if (suggestions.length > 0) {
          e.preventDefault();
          handleSelectSuggestion(suggestions[0]);
        }
        break;
    }
  };

  const handleInputFocus = () => {
    const filtered = filterAddresses(value);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    onFocus?.();
  };

  const handleInputBlur = () => {
    onBlur?.();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const numberMatch = query.match(/^\d+\s*/);
    const textQuery = numberMatch ? query.substring(numberMatch[0].length).trim() : query;

    if (!textQuery) return text;

    const index = text.toLowerCase().indexOf(textQuery.toLowerCase());
    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <span className="font-semibold text-white">
          {text.substring(index, index + textQuery.length)}
        </span>
        {text.substring(index + textQuery.length)}
      </>
    );
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={`${id}-suggestions`}
          aria-activedescendant={
            selectedIndex >= 0 ? `${id}-option-${selectedIndex}` : undefined
          }
          className={inputClassName}
        />
      </div>

      {showSuggestions && (
        <div
          ref={suggestionsRef}
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-gray-800/95 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto animate-fadeIn"
        >
          {suggestions.length > 0 ? (
            <>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  ref={index === selectedIndex ? selectedItemRef : null}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors touch-manipulation min-h-[44px] ${
                    index === selectedIndex
                      ? 'bg-blue-600/20 text-white'
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-sm">
                    {highlightMatch(suggestion, value)}
                  </span>
                </button>
              ))}
              <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-700/50 bg-gray-900/50">
                {suggestions.length} location{suggestions.length !== 1 ? 's' : ''}{' '}
                found
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
