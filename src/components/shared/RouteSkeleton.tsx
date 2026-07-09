/**
 * Calm branded loading skeleton for trip-tab routes (ODY-014). Server
 * component — no client JS. Shimmer + shapes styled via `.skel-*` classes in
 * globals.css (paper/rule tokens, reduced-motion aware).
 */
export function RouteSkeleton({ blocks = 3 }: { blocks?: number }) {
  return (
    <div className="canvas" aria-busy="true" aria-label="Loading">
      <div className="skel skel-hero" />
      <div className="skel skel-bar" />
      {Array.from({ length: blocks }).map((_, i) => (
        <div key={i} className="skel skel-block" />
      ))}
    </div>
  );
}
