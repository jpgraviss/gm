interface StatusBadgeProps {
  label: string
  colorClass: string
}

export default function StatusBadge({ label, colorClass }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${colorClass}`}>
      {label}
    </span>
  )
}
