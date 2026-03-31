import { useState, useRef, useEffect } from 'react';

/**
 * Custom dropdown that opens downward and stays within the viewport.
 * Fixes native <select> opening upward and getting cut off at the top.
 */
export default function LanguageSelect({
  id,
  label,
  options,
  value,
  onChange,
  disabled,
  placeholder,
  required = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={id} className="mb-2 block text-small font-medium text-content-muted">
          {label}
          {required && <span className="text-red-400"> *</span>}
        </label>
      )}
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={`relative w-full rounded-xl border border-surface-border bg-surface-muted/50 px-4 py-3 pr-10 text-left text-content transition duration-200 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:bg-surface/80 disabled:opacity-60 sm:py-4 ${className}`}
      >
        <span className="block truncate">{selectedOption ? selectedOption.label : placeholder || 'Select…'}</span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-content-subtle" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <ul
          className="absolute left-0 right-0 z-50 mt-2 max-h-56 overflow-y-auto rounded-xl border border-surface-border bg-canvas-elevated py-2 shadow-glass animate-fade-in"
          role="listbox"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left text-small transition-all duration-200 ${
                    isSelected
                      ? 'bg-accent-muted font-medium text-accent'
                      : 'text-content-muted hover:bg-surface-muted/60 hover:text-content'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
