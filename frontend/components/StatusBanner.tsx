import type { ServiceStatus } from "@/lib/types";
import StatusGlyph from "./StatusGlyph";

interface Props {
  status: ServiceStatus;
  title: string;
  sub?: string;
}

export default function StatusBanner({ status, title, sub }: Props) {
  return (
    <div className={"status-banner st-" + status}>
      <div className="banner-glyph">
        <StatusGlyph status={status} size={18} />
      </div>
      <div className="grow">
        <div className="serif" style={{ fontSize: 22, color: "var(--fg-0)" }}>
          {title}
        </div>
        {sub && (
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
