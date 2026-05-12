interface Props {
  kind: string;
  size?: number;
}

export default function ServiceGlyph({ kind, size = 22 }: Props) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "graces":
      return (
        <svg {...props}>
          <path d="M12 3.5 L13 6 L15.5 6 L13.5 7.6 L14.3 10 L12 8.6 L9.7 10 L10.5 7.6 L8.5 6 L11 6 Z" />
          <path d="M5.5 14.5 L6.3 16.4 L8.3 16.4 L6.8 17.6 L7.3 19.5 L5.5 18.4 L3.7 19.5 L4.2 17.6 L2.7 16.4 L4.7 16.4 Z" />
          <path d="M18.5 14.5 L19.3 16.4 L21.3 16.4 L19.8 17.6 L20.3 19.5 L18.5 18.4 L16.7 19.5 L17.2 17.6 L15.7 16.4 L17.7 16.4 Z" />
        </svg>
      );
    case "hyacinth":
      return (
        <svg {...props}>
          <path d="M12 21 V11" />
          <path d="M12 11 C10.5 11 9 9.5 9 8 C9 6.5 10.5 5 12 5 C13.5 5 15 6.5 15 8 C15 9.5 13.5 11 12 11 Z" />
          <path d="M9 8 C8 9 7.5 10 8 11" />
          <path d="M15 8 C16 9 16.5 10 16 11" />
          <path d="M10 13 H14 M10.5 16 H13.5 M11 19 H13" />
        </svg>
      );
    case "hydra":
      return (
        <svg {...props}>
          <path d="M5 19 C5 14 7 12 9 12 C7 11 6 9 8 7" />
          <circle cx="7" cy="6" r="0.6" fill="currentColor" />
          <path d="M12 19 C12 13 12 11 12 9 C12 7 13 6 14 6" />
          <circle cx="14" cy="5.5" r="0.6" fill="currentColor" />
          <path d="M19 19 C19 14 17 12 15 12 C17 11 18 9 16 7" />
          <circle cx="17" cy="6" r="0.6" fill="currentColor" />
          <path d="M4 20 H20" />
        </svg>
      );
    case "key":
      return (
        <svg {...props}>
          <circle cx="8" cy="12" r="3.5" />
          <path d="M11.5 12 H20" />
          <path d="M16 12 V15" />
          <path d="M18.5 12 V14.5" />
        </svg>
      );
    case "winged":
      return (
        <svg {...props}>
          <path d="M12 4 V20" />
          <path d="M9 8 C10 6 11 5 12 5 C13 5 14 6 15 8" />
          <path d="M8 12 C9 10 10.5 9 12 9 C13.5 9 15 10 16 12" />
          <path d="M5 12 C7 10 10 12 12 10 C14 12 17 10 19 12" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="6" />
        </svg>
      );
  }
}
