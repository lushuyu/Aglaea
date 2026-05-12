/* Aglaea — Auth screens */
/* eslint-disable */

function GitHubMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23.96-.27 1.99-.4 3.01-.41 1.02.01 2.05.14 3.01.41 2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.83.58C20.57 21.79 24 17.29 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

function Login({ go, attemptedDenied, setDenied }) {
  const [loading, setLoading] = useState(false);
  const [showDenied, setShowDenied] = useState(attemptedDenied);

  function start() {
    setLoading(true);
    setTimeout(() => {
      // Simulate the OAuth dance; for prototype, go to admin
      setLoading(false);
      go("/admin");
    }, 1100);
  }

  function startDenied() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setShowDenied(true);
      setDenied(true);
    }, 900);
  }

  return (
    <div className="login-shell">
      <StarField />
      <div className="login-card card-elevated">
        <div className="row gap-3" style={{ marginBottom: 8 }}>
          <Brandmark size={22} />
          <span className="serif" style={{ fontSize: 20 }}>Aglaea</span>
        </div>
        <h1 className="serif" style={{ fontSize: 32, lineHeight: 1.1, marginTop: 16 }}>
          Sign in to admin.
        </h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
          Aglaea is a single-tenant system. Only one GitHub account is allowlisted —
          if that's not yours, sign-in will be refused. There is no signup.
        </p>

        {showDenied && (
          <div className="login-error" style={{ marginTop: 20 }}>
            <div className="row gap-2" style={{ marginBottom: 6 }}>
              <StatusGlyph status="down" size={12} />
              <strong style={{ color: "var(--down)", fontSize: 13 }}>Access denied</strong>
            </div>
            <div className="text-sm muted" style={{ lineHeight: 1.55 }}>
              That GitHub account isn't in this site's allowlist. This is a private system —
              retrying with a different account on the same browser will not help.
              If you believe this is a mistake, contact the owner directly.
            </div>
          </div>
        )}

        <div className="col gap-2" style={{ marginTop: 24 }}>
          <button className="btn btn-lg" onClick={start} disabled={loading}>
            <GitHubMark /> {loading ? "Redirecting…" : "Sign in with GitHub"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={startDenied} disabled={loading} style={{ marginTop: 4, opacity: .6 }}>
            (demo) sign in as a not-allowlisted account
          </button>
        </div>

        <div className="login-foot text-xs mono muted-2" style={{ marginTop: 32 }}>
          <a href="#/" onClick={e=>{e.preventDefault();go("/");}}>← Back to public status</a>
        </div>
      </div>
    </div>
  );
}

function AuthCallback({ go }) {
  // simulate callback handler; in real life this reads ?code=…
  useEffect(() => {
    const t = setTimeout(() => go("/admin"), 800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="login-shell">
      <StarField />
      <div className="login-card card-elevated" style={{ textAlign: "center" }}>
        <Brandmark size={32} />
        <div className="serif" style={{ fontSize: 22, marginTop: 20 }}>Verifying with GitHub…</div>
        <div className="muted text-xs mono" style={{ marginTop: 12 }}>
          <div className="skeleton" style={{ width: 180, height: 4, margin: "0 auto" }} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Login, AuthCallback });
