// Mini app-preview swatch. Must render as a DIRECT child of its flex/grid
// container (.theme-opt / .set-theme) — the `.sw` box relies on width/height
// that an inline wrapper span would discard, so render it as real JSX rather
// than via dangerouslySetInnerHTML.
export function Swatch({ kind }: { kind: string }) {
  return (
    <span className={`sw ${kind}`}>
      <span className="sw-rail" />
      <span className="sw-line l1" />
      <span className="sw-line l2" />
      <span className="sw-dot" />
    </span>
  );
}
