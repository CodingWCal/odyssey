/**
 * Origin → destination for flight/transport events (ODY-096). Renders the two
 * endpoints as structured spans so long addresses can stack vertically on
 * narrow screens (the arrow turns downward via CSS) instead of overflowing a
 * single cramped line. Desktop keeps the inline "A → B" form. Text nodes only.
 */
export function RouteLine({ from, to }: { from: string; to: string }) {
  return (
    <span className="route-lines">
      <span className="route-pt">{from}</span>
      <span className="route-sep" aria-hidden="true">→</span>
      <span className="route-pt">{to}</span>
    </span>
  );
}
