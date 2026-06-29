// Full-screen branded loader shown on app boot — i.e. on a tab refresh while
// the saved session token is being validated (App → Shell, `!ready`). Mirrors
// the inline loader in index.html so the hand-off from first paint to React is
// seamless. Uses the panel's accent + theme variables, so it adapts to
// light/dark automatically.
export function BootLoader() {
  return (
    <div className="boot" role="status" aria-live="polite" aria-label="Loading">
      <div className="boot-logo-wrap">
        <span className="boot-ring" />
        <img src="logo.png" alt="GoMel" className="boot-logo" />
      </div>
      <div className="boot-name">
        GoMel <span>Admin</span>
      </div>
      <div className="boot-bar">
        <span />
      </div>
    </div>
  );
}
