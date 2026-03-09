'use client'

import { useState } from 'react'
import { PhoneCall, Mail, Video, StickyNote, CheckSquare, X } from 'lucide-react'
import type { ActivityType } from '@/lib/types'

export interface LoggedActivity {
  id: string
  type: ActivityType
  title: string
  body: string
  outcome: string
  nextStep: string
  user: string
  timestamp: string
  duration?: number
}

const typeOptions: { type: ActivityType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'call',    label: 'Call',    icon: <PhoneCall size={13} />,  color: '#3b82f6' },
  { type: 'email',   label: 'Email',   icon: <Mail size={13} />,       color: '#f59e0b' },
  { type: 'meeting', label: 'Meeting', icon: <Video size={13} />,      color: '#8b5cf6' },
  { type: 'note',    label: 'Note',    icon: <StickyNote size={13} />, color: '#6b7280' },
  { type: 'task',    label: 'Task',    icon: <CheckSquare size={13} />,color: '#10b981' },
]

interface Props {
  onSave: (activity: LoggedActivity) => void
  onCancel: () => void
  authorName?: string
}

export default function LogActivityForm({ onSave, onCancel, authorName = 'You' }: Props) {
  const [actType, setActType] = useState<ActivityType>('call')
  const [body, setBody] = useState('')
  const [outcome, setOutcome] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [duration, setDuration] = useState('')

  const selected = typeOptions.find(t => t.type === actType)!

  function handleSave() {
    if (!body.trim()) return
    const now = new Date()
    onSave({
      id: `act-${Date.now()}`,
      type: actType,
      title: `${selected.label} logged`,
      body: body.trim(),
      outcome: outcome.trim(),
      nextStep: nextStep.trim(),
      user: authorName,
      timestamp: now.toISOString(),
      ...(actType === 'call' || actType === 'meeting' ? { duration: duration ? parseInt(duration) : undefined } : {}),
    })
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 p-4 flex-shrink-0">
      {/* Type selector */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {typeOptions.map(t => (
          <button
            key={t.type}
            onClick={() => setActType(t.type)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all"
            style={
              actType === t.type
                ? { background: t.color, color: '#fff' }
                : { background: '#f3f4f6', color: '#6b7280' }
            }
          >
            {t.icon} {t.label}
          </button>
        ))}
        {(actType === 'call' || actType === 'meeting') && (
          <input
            value={duration}
            onChange={e => setDuration(e.target.value)}
            placeholder="min"
            className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white outline-none"
            type="number"
            min="1"
          />
        )}
        <button onClick={onCancel} className="ml-auto p-1.5 rounded-lg hover:bg-gray-200 text-gray-400">
          <X size={14} />
        </button>
      </div>

      {/* Notes */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={`${selected.label} notes...`}
        className="w-full text-sm border border-gray-200 rounded-lg p-2.5 text-gray-700 bg-white outline-none resize-none leading-relaxed"
        rows={3}
      />

      {/* Outcome + Next step */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <input
          value={outcome}
          onChange={e => setOutcome(e.target.value)}
          placeholder="Outcome (optional)"
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white outline-none"
        />
        <input
          value={nextStep}
          onChange={e => setNextStep(e.target.value)}
          placeholder="Next step (optional)"
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white outline-none"
        />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!body.trim()}
        className="mt-3 w-full py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
        style={{ background: '#015035' }}
      >
        Save Activity
      </button>
    </div>
  )
}
