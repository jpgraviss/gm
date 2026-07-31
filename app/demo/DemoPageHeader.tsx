import { Search, Bell } from 'lucide-react'

export default function DemoPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between px-6 sm:px-10 h-16 border-b border-black/5 bg-white">
      <div>
        <h1 className="text-base font-bold text-[#012A1C]">{title}</h1>
        {subtitle && <p className="text-[11px] text-[#1B211D]/50">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4 text-[#1B211D]/30">
        <Search size={15} />
        <Bell size={15} />
        <div className="w-7 h-7 rounded-full bg-[#e6f0ec] flex items-center justify-center text-[10px] font-bold text-[#015035]">
          JG
        </div>
      </div>
    </div>
  )
}
