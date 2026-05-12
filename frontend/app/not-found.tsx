import Link from "next/link";
import Brandmark from "@/components/Brandmark";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        textAlign: "center",
      }}
    >
      <Brandmark size={48} />
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 64,
          fontWeight: 400,
          color: "var(--fg-0)",
          marginTop: 24,
          marginBottom: 8,
          letterSpacing: "-0.04em",
        }}
      >
        404
      </h1>
      <p
        style={{
          fontSize: 16,
          color: "var(--fg-2)",
          marginBottom: 32,
        }}
      >
        This page does not exist.
      </p>
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--accent)",
          textDecoration: "none",
          borderBottom: "1px solid var(--accent-line)",
          paddingBottom: 2,
        }}
      >
        ← Back to status
      </Link>
    </div>
  );
}
