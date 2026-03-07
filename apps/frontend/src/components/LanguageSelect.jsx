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
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
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
        className={`relative w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 pr-10 text-left text-slate-800 transition duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white disabled:opacity-60 ${className}`}
      >
        <span className="block truncate">{selectedOption ? selectedOption.label : placeholder || 'Select…'}</span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <ul
          className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-fade-in"
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
                  className={`w-full px-4 py-2.5 text-left text-sm transition-all duration-200 ${
                    isSelected
                      ? 'bg-emerald-100 font-medium text-emerald-800'
                      : 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
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
