"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  display: string;
  lat: number;
  lng: number;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  /** Fired when a suggestion is picked — supplies resolved coordinates. */
  onPick: (s: Suggestion) => void;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
}

/**
 * Address field with live Nominatim suggestions. Debounced + aborts in-flight
 * requests per keystroke. Picking a result fills the text and resolves
 * coordinates so the map pin matches the chosen place. (#2)
 */
export function LocationAutocomplete({
  value,
  onChange,
  onPick,
  placeholder,
  id,
  autoFocus,
}: LocationAutocompleteProps) {
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const justPicked = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced search whenever the typed value changes.
  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5`,
          { headers: { "Accept-Language": "en" }, signal: controller.signal }
        );
        const data = await res.json();
        const next: Suggestion[] = (Array.isArray(data) ? data : [])
          .map((d: { display_name: string; lat: string; lon: string }) => ({
            display: d.display_name,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
          }))
          .filter((s: Suggestion) => !Number.isNaN(s.lat) && !Number.isNaN(s.lng));
        setResults(next);
        setOpen(true);
        setActive(-1);
      } catch {
        /* aborted or network error — ignore */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(s: Suggestion) {
    justPicked.current = true;
    onChange(s.display);
    onPick(s);
    setOpen(false);
    setResults([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="ac-wrap" ref={wrapRef}>
      <input
        id={id}
        className="input"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && (results.length > 0 || loading) && (
        <div className="ac-menu" role="listbox">
          {loading && results.length === 0 && <div className="ac-hint">Searching…</div>}
          {results.map((s, i) => (
            <button
              key={`${s.lat},${s.lng},${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`ac-item ${i === active ? "active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(s)}
            >
              {s.display}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
