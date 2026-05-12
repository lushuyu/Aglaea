interface Props {
  w?: number | string;
  h?: number;
}

export default function Skeleton({ w, h = 14 }: Props) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h }}
    />
  );
}
