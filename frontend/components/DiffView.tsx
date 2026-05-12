interface Props {
  before: string;
  after: string;
}

type DiffKind = "+" | "-" | " ";
interface DiffRow {
  kind: DiffKind;
  text: string;
}

export default function DiffView({ before, after }: Props) {
  const a = before.split("\n");
  const b = after.split("\n");
  const maxLen = Math.max(a.length, b.length);
  const rows: DiffRow[] = [];

  for (let i = 0; i < maxLen; i++) {
    const av = a[i] ?? "";
    const bv = b[i] ?? "";
    if (av === bv) {
      rows.push({ kind: " ", text: bv });
    } else {
      if (av) rows.push({ kind: "-", text: av });
      if (bv) rows.push({ kind: "+", text: bv });
    }
  }

  return (
    <div className="diff">
      {rows.map((r, i) => (
        <div
          key={i}
          className={
            "diff-row diff-" +
            (r.kind === "+" ? "add" : r.kind === "-" ? "del" : "same")
          }
        >
          <span className="diff-marker mono">{r.kind}</span>
          <span className="diff-text">{r.text || " "}</span>
        </div>
      ))}
    </div>
  );
}
