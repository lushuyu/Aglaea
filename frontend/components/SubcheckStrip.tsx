/**
 * SubcheckStrip — compact representation of nested subchecks.
 * Uses flex-wrap: wrap (from .subcheck-strip in public-overview.css) so the
 * 6-key set (jin10, cls, wscn, moomoo, deepseek, discord) wraps to a second
 * row at narrow widths rather than overflowing. AC2.8.
 */
import type { SubcheckMap } from "@/lib/types";
import StatusGlyph from "./StatusGlyph";

const STATUS_LABELS: Record<string, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

interface Props {
  subchecks: SubcheckMap;
}

export default function SubcheckStrip({ subchecks }: Props) {
  const keys = Object.keys(subchecks);
  if (!keys.length) {
    return <span className="muted text-xs">— no subchecks</span>;
  }
  return (
    <div className="subcheck-strip">
      {keys.map((k) => {
        const s = subchecks[k];
        if (!s) return null;
        const label =
          STATUS_LABELS[s.status] ?? s.status;
        return (
          <div
            key={k}
            className="subcheck-pip"
            title={`${k}: ${label}${s.message ? " — " + s.message : ""}`}
          >
            <StatusGlyph status={s.status} size={9} />
            <span className="mono text-xs muted">{k}</span>
          </div>
        );
      })}
    </div>
  );
}
