/** Dashboard loading state (ODY-014) — card-grid skeleton. */
export default function Loading() {
  return (
    <div className="canvas" aria-busy="true" aria-label="Loading">
      <div className="skel skel-hero" />
      <div className="skel-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skel skel-card" />
        ))}
      </div>
    </div>
  );
}
