interface Props {
  size?: number;
}

export default function Brandmark({ size = 24 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: "block" }}
      aria-label="Aglaea"
    >
      <defs>
        <linearGradient id="aglGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--gold-200)" />
          <stop offset="100%" stopColor="var(--gold-500)" />
        </linearGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="11"
        fill="none"
        stroke="var(--accent-line)"
        strokeWidth="0.6"
      />
      <g fill="url(#aglGrad)">
        <circle cx="12" cy="6" r="1.3" />
        <circle cx="6.5" cy="15.5" r="1.1" />
        <circle cx="17.5" cy="15.5" r="1.1" />
      </g>
      <g stroke="var(--accent-line)" strokeWidth="0.5">
        <line x1="12" y1="6" x2="6.5" y2="15.5" />
        <line x1="12" y1="6" x2="17.5" y2="15.5" />
        <line x1="6.5" y1="15.5" x2="17.5" y2="15.5" />
      </g>
    </svg>
  );
}
