"use client";

import { useState } from "react";
import { firstAddressSegment } from "@/lib/utils";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

/**
 * One endpoint of a route line, condensed on mobile (ODY-129/143): a full
 * geocoded address dominates a route line on a phone same as it would a
 * single-point location, so mobile shows just the venue/street segment
 * (text before the first comma) with a tap to reveal the rest — the same
 * treatment EventBlock's single-point EventLocation already has. RouteLine
 * endpoints were missed by ODY-129's original pass, which assumed ODY-096's
 * wrap/overflow fix already covered this — it only stopped addresses from
 * overflowing the card, not from being long.
 */
export function RoutePoint({ text }: { text: string }) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const short = firstAddressSegment(text);
  const canShorten = isMobile && short !== text;

  if (!canShorten) {
    return <span className="route-pt">{text}</span>;
  }

  return (
    <button
      type="button"
      className="route-pt route-pt-toggle"
      onClick={() => setExpanded((e) => !e)}
      aria-expanded={expanded}
    >
      {expanded ? text : short}
    </button>
  );
}

/**
 * Origin → destination for flight/transport events (ODY-096). Renders the two
 * endpoints as structured spans so long addresses can stack vertically on
 * narrow screens (the arrow turns downward via CSS) instead of overflowing a
 * single cramped line. Desktop keeps the inline "A → B" form. Each endpoint
 * condenses to its first address segment on mobile with a tap to expand
 * (ODY-129/143). Text nodes only.
 */
export function RouteLine({ from, to }: { from: string; to: string }) {
  return (
    <span className="route-lines">
      <RoutePoint text={from} />
      <span className="route-sep" aria-hidden="true">→</span>
      <RoutePoint text={to} />
    </span>
  );
}
