function Logo({ variant = "full", tone = "default", size = 32, className = "" }) {
  const tile = tone === "invert" ? "#FAF7F2" : "#C2410C";
  const glyph = tone === "invert" ? "#C2410C" : "#FAF7F2";

  const mark = (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className="shrink-0"
      role="img"
      aria-label="Havn"
    >
      <rect width="64" height="64" rx="14" fill={tile} />
      <g fill={glyph}>
        <rect x="17" y="15" width="11" height="34" rx="4" />
        <rect x="36" y="15" width="11" height="34" rx="4" />
        <rect x="17" y="27" width="30" height="9" rx="4" />
      </g>
    </svg>
  );

  if (variant === "mark") {
    return <span className={className}>{mark}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {mark}
      <span
        className="font-display font-bold tracking-tight leading-none"
        style={{ fontSize: size * 0.72 }}
      >
        Havn
      </span>
    </span>
  );
}

export default Logo;
