import { useState, useEffect } from "react";
import { Instagram, Globe, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeInstagramHandle, normalizeWebsiteUrl } from "@/lib/social-links";

interface SocialLinkInputProps {
  type: 'instagram' | 'website';
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function SocialLinkInput({
  type,
  value,
  onChange,
  disabled = false,
  className,
}: SocialLinkInputProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [error, setError] = useState<string | null>(null);

  // Sync internal state with external value
  useEffect(() => {
    setInputValue(value || '');
    setError(null);
  }, [value]);

  const handleBlur = () => {
    if (!inputValue.trim()) {
      onChange(null);
      setError(null);
      return;
    }

    if (type === 'instagram') {
      const normalized = normalizeInstagramHandle(inputValue);
      if (normalized) {
        onChange(normalized);
        setInputValue(normalized);
        setError(null);
      } else {
        setError('Enter a valid Instagram handle');
      }
    } else {
      const normalized = normalizeWebsiteUrl(inputValue);
      if (normalized) {
        onChange(normalized);
        setInputValue(normalized);
        setError(null);
      } else {
        setError('Enter a valid website URL');
      }
    }
  };

  const handleClear = () => {
    setInputValue('');
    onChange(null);
    setError(null);
  };

  const Icon = type === 'instagram' ? Instagram : Globe;
  const placeholder = type === 'instagram' 
    ? '@username or instagram.com/username' 
    : 'https://example.com';

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Icon className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError(null);
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "input-neesh w-full pl-10 pr-10",
            error && "ring-2 ring-destructive ring-offset-1",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          aria-invalid={!!error}
        />
        {inputValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear input"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-caption text-destructive">{error}</p>
      )}
    </div>
  );
}
