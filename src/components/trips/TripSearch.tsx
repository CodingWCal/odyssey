"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/shared/Modal";
import { Icons } from "@/components/shared/Icons";
import { MIN_QUERY_LENGTH } from "@/lib/tripSearch";
import { searchTrip, type TripSearchResult } from "@/app/trips/[tripId]/search/actions";

const KIND_LABEL: Record<TripSearchResult["kind"], string> = {
  event: "Event",
  place: "Place",
  note: "Note",
};

/** In-trip search overlay (ODY-083). Self-contained: renders its own trigger
 * (styled per `variant`) plus a Modal command box. Two instances are mounted —
 * one in the desktop sidebar, one in the mobile header — but only one is
 * visible at a time by viewport, so they never collide. */
export function TripSearch({ tripId, variant = "sidebar" }: { tripId: string; variant?: "sidebar" | "header" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TripSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    if (debounce.current) clearTimeout(debounce.current);
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function onQuery(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounce.current = setTimeout(() => {
      startTransition(async () => {
        try {
          setResults(await searchTrip(tripId, value));
        } catch {
          setResults([]);
        } finally {
          setSearched(true);
        }
      });
    }, 200);
  }

  function go(r: TripSearchResult) {
    router.push(`/trips/${tripId}/${r.tab}`);
    close();
  }

  const short = query.trim().length < MIN_QUERY_LENGTH;

  return (
    <>
      {variant === "header" ? (
        <button type="button" className="icon-btn trip-search-trigger-icon" aria-label="Search this trip" onClick={() => setOpen(true)}>
          <Icons.search size={18} />
        </button>
      ) : (
        <button type="button" className="trip-search-trigger" onClick={() => setOpen(true)}>
          <Icons.search size={15} />
          <span>Search this trip</span>
        </button>
      )}

      <Modal open={open} onClose={close} ariaLabel="Search this trip">
        <div className="trip-search">
          <div className="trip-search-input">
            <Icons.search size={16} />
            <input
              value={query}
              autoFocus
              placeholder="Search events, places, notes…"
              aria-label="Search this trip"
              onChange={(e) => onQuery(e.target.value)}
            />
          </div>

          <div className="trip-search-results">
            {short ? (
              <p className="trip-search-hint">Type at least {MIN_QUERY_LENGTH} characters.</p>
            ) : isPending && results.length === 0 ? (
              <p className="trip-search-hint">Searching…</p>
            ) : searched && results.length === 0 ? (
              <p className="trip-search-hint">No matches in this trip.</p>
            ) : (
              <ul>
                {results.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <button type="button" onClick={() => go(r)}>
                      <span className={`trip-search-kind k-${r.kind}`}>{KIND_LABEL[r.kind]}</span>
                      <span className="trip-search-body">
                        <span className="trip-search-title">{r.title}</span>
                        {r.subtitle && <span className="trip-search-sub">{r.subtitle}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
