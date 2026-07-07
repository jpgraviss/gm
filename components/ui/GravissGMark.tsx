export function GravissGMark({ size = 20, color = 'currentColor', className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M68 30 L50 10 L16 32 L16 68 L50 90 L84 68 L84 50 L52 50 L30 64 L30 38 L50 22 L64 32"
        stroke={color}
        strokeWidth="7.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
