import Image from 'next/image'

export function GravissGMark({ size = 20, className }: { size?: number; color?: string; className?: string }) {
  return (
    <Image
      src="/icon.png"
      alt="GravHub"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: '20%' }}
    />
  )
}
