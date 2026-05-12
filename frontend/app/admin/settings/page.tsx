"use client";

import { fmtSGT } from "@/lib/fmt";

export default function AdminSettingsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-h2">Settings</h1>
      </div>

      <div className="admin-section">
        <h2 className="admin-h3" style={{ marginBottom: 16 }}>
          General
        </h2>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 14, color: "var(--fg-0)", marginBottom: 2 }}>
              Server time (SGT)
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-3)",
              }}
            >
              Admin timezone is always Asia/Singapore.
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--accent)",
            }}
          >
            {fmtSGT()}
          </span>
        </div>

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 14, color: "var(--fg-0)", marginBottom: 2 }}>
              Report revalidation
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-3)",
              }}
            >
              Public pages revalidate every 30 seconds via Next.js ISR.
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--fg-3)",
            }}
          >
            30s
          </span>
        </div>
      </div>

      <div className="admin-section" style={{ marginTop: 32 }}>
        <h2 className="admin-h3" style={{ marginBottom: 16 }}>
          Authentication
        </h2>
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 14, color: "var(--fg-0)", marginBottom: 2 }}>
              GitHub OAuth
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-3)",
              }}
            >
              Managed via GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET env vars on the
              backend.
            </div>
          </div>
          <a
            href="/api/auth/login/github"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--accent)",
              textDecoration: "none",
            }}
          >
            re-login →
          </a>
        </div>
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 14, color: "var(--fg-0)", marginBottom: 2 }}>
              Session cookie
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-3)",
              }}
            >
              HttpOnly, SameSite=Lax, Secure. Not readable from client JS.
            </div>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 14, color: "var(--fg-0)", marginBottom: 2 }}>
              Sign out
            </div>
          </div>
          <a
            href="/api/auth/logout"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--down)",
              textDecoration: "none",
            }}
          >
            sign out →
          </a>
        </div>
      </div>

      <div className="admin-section" style={{ marginTop: 32 }}>
        <h2 className="admin-h3" style={{ marginBottom: 16 }}>
          About
        </h2>
        <div className="settings-row">
          <span style={{ fontSize: 13, color: "var(--fg-2)" }}>Version</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--fg-3)",
            }}
          >
            0.1.0
          </span>
        </div>
        <div className="settings-row">
          <span style={{ fontSize: 13, color: "var(--fg-2)" }}>Frontend</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--fg-3)",
            }}
          >
            Next.js 15 · App Router · RSC
          </span>
        </div>
      </div>
    </div>
  );
}
