import type { ReactNode } from "react";
import Link from "next/link";
import Brandmark from "@/components/Brandmark";
import StarField from "@/components/StarField";
import LocalClock from "@/components/LocalClock";
import ThemeToggle from "@/components/ThemeToggle";
import PublicMotionShell from "@/components/PublicMotionShell";
import "@/styles/screens/common.css";
import "@/styles/screens/public-overview.css";
import "@/styles/screens/public-service.css";
import "@/styles/screens/public-incident.css";
import "@/styles/screens/public-claude-code.css";
import "@/styles/screens/public-about.css";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PublicMotionShell>
      <StarField />
      <header className="pub-header">
        <Link href="/" className="brand-link" style={{ textDecoration: "none" }}>
          <Brandmark size={28} />
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 23,
              letterSpacing: "-0.02em",
            }}
          >
            Aglaea
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <LocalClock />
          <Link href="/about" className="pub-nav-link" style={{ textDecoration: "none" }}>
            About
          </Link>
          <a
            href="https://lushuyu.site"
            target="_blank"
            rel="noopener noreferrer"
            className="pub-nav-link"
            style={{ textDecoration: "none" }}
          >
            lushuyu.site
          </a>
          <Link href="/admin" className="pub-nav-cta" style={{ textDecoration: "none" }}>
            Admin
          </Link>
        </div>
      </header>

      <main className="pub-main">{children}</main>

      <ThemeToggle />
    </PublicMotionShell>
  );
}
