import {
  PhoneCall, Mail, Video, StickyNote, CheckSquare,
  TrendingUp, ScrollText, DollarSign, FileText, Clock,
} from 'lucide-react'
import type { ActivityType, CRMActivity } from '@/lib/types'

export function InfoRow({
  icon, label, value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        {label && <p className="text-[11px] text-gray-400">{label}</p>}
        <div className="text-sm text-gray-800">{value}</div>
      </div>
    </div>
  )
}

export const activityConfig: Record<ActivityType, { icon: React.ReactNode; color: string }> = {
  call:     { icon: <PhoneCall size={14} />,   color: '#3b82f6' },
  email:    { icon: <Mail size={14} />,         color: '#f59e0b' },
  meeting:  { icon: <Video size={14} />,        color: '#8b5cf6' },
  note:     { icon: <StickyNote size={14} />,   color: '#6b7280' },
  task:     { icon: <CheckSquare size={14} />,  color: '#10b981' },
  deal:     { icon: <TrendingUp size={14} />,   color: '#015035' },
  contract: { icon: <ScrollText size={14} />,   color: '#f97316' },
  invoice:  { icon: <DollarSign size={14} />,   color: '#ef4444' },
  proposal: { icon: <FileText size={14} />,     color: '#6366f1' },
}

export function ActivityTimeline({ activities }: { activities: CRMActivity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No activities logged.</p>
  }
  return (
    <div className="flex flex-col">
      {activities.map((act, idx) => {
        const cfg = activityConfig[act.type]
        return (
          <div key={act.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                style={{ background: `${cfg.color}15`, color: cfg.color }}
              >
                {cfg.icon}
              </div>
              {idx < activities.length - 1 && (
                <div className="w-px flex-1 bg-gray-100 my-1" />
              )}
            </div>
            <div className="flex-1 pb-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{act.title}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {act.duration && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock size={10} />{act.duration}m
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400">
                    {new Date(act.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              {act.body && (
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{act.body}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {act.outcome && (
                  <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                    Outcome: {act.outcome}
                  </span>
                )}
                {act.nextStep && (
                  <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    Next: {act.nextStep}
                  </span>
                )}
                <span className="text-[11px] text-gray-400">by {act.user}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
