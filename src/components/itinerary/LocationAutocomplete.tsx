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
 * Address field with live place suggestions. Debounced + aborts in-flight
 * requests per keystroke. Queries go through our authenticated /api/geocode
 * proxy (cached + rate-limited server-side, ODY-010) — never straight to
 * Nominatim from the browser. Picking a result fills the text and resolves
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

  // Clear suggestions the moment the query drops below the minimum ("adjust
  // state during render" — keeps setState out of the effect body).
  const q = value.trim();
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    if (q.length < 3) {
      if (results.length > 0) setResults([]);
      if (open) setOpen(false);
    }
  }

  // Debounced search whenever the typed value changes.
  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`geocode ${res.status}`);
        const data = await res.json();
        // The proxy returns suggestions already normalized to {display, lat, lng}.
        const next: Suggestion[] = (Array.isArray(data) ? data : []).filter(
          (s: Suggestion) => s.display && !Number.isNaN(s.lat) && !Number.isNaN(s.lng)
        );
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
