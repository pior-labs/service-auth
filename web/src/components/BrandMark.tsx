interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 34, className = "" }: BrandMarkProps) {
  return (
    <span
      className={`bloom-flower inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="petal p1" />
      <span className="petal p2" />
      <span className="petal p3" />
      <span className="brand-core" />
    </span>
  );
}
