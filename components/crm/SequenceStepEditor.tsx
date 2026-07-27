'use client'

import { useRef, useState } from 'react'
import { X, Mail, Edit2, Phone, CheckCircle, Linkedin, ChevronLeft, Wand2, Sparkles } from 'lucide-react'
import type { SequenceStep, SequenceStepType, SequenceHtmlTemplate, TaskPriority } from '@/lib/types'
import { aiSourceLabel } from '@/lib/utils'

// Merge-field tokens the executor (app/api/sequences/execute/route.ts,
// replaceMergeFields) actually substitutes. Keep these in sync — inserting
// anything else here would silently never get replaced.
const TOKENS: { label: string; token: string }[] = [
  { label: 'First Name',    token: '{{first_name}}' },
  { label: 'Last Name',     token: '{{last_name}}' },
  { label: 'Full Name',     token: '{{full_name}}' },
  { label: 'Email',         token: '{{email}}' },
  { label: 'Company',       token: '{{company}}' },
  { label: 'Sender Name',   token: '{{sender_name}}' },
  { label: 'Sender Email',  token: '{{sender_email}}' },
]

const STEP_TYPE_OPTIONS: { type: SequenceStepType; label: string; description: string; icon: React.ReactNode; color: string; disabled?: boolean }[] = [
  { type: 'email',        label: 'Automated email',   description: 'Send an email automatically.',              icon: <Mail size={18} />,        color: '#3b82f6' },
  { type: 'manual_email', label: 'Manual email task',  description: 'Get a task reminder to send an email.',     icon: <Edit2 size={18} />,       color: '#8b5cf6' },
  { type: 'call',         label: 'Call task',          description: 'Get a task reminder to call the contact.',  icon: <Phone size={18} />,       color: '#ef4444' },
  { type: 'task',         label: 'To-do',               description: 'Create a task for an action item.',        icon: <CheckCircle size={18} />, color: '#10b981' },
  { type: 'linkedin',     label: 'LinkedIn (coming soon)', description: 'Requires Sales Navigator — not connected yet.', icon: <Linkedin size={18} />, color: '#9ca3af', disabled: true },
]

function TokenInsertBar({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {TOKENS.map(t => (
        <button
          key={t.token}
          type="button"
          onClick={() => onInsert(t.token)}
          className="text-[11px] px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          + {t.label}
        </button>
      ))}
    </div>
  )
}

function useCursorInsert(ref: React.RefObject<HTMLTextAreaElement | null>, value: string, setValue: (v: string) => void) {
  return (token: string) => {
    const el = ref.current
    if (!el) { setValue(value + token); return }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    setValue(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + token.length
    })
  }
}

interface Props {
  step: SequenceStep | null // null = creating a new step
  previousStepDay: number | null // day offset of the step before this one; null if this is the first step
  onSave: (step: SequenceStep) => void
  onClose: () => void
  // AI-draft context (all optional — the AI Assist block only needs
  // enough to write a sensible prompt, not a full sequence object).
  sequenceName?: string
  targetSegment?: string
  stepPosition?: number
  totalSteps?: number
  previousSubjects?: string[]
}

export default function SequenceStepEditor({
  step, previousStepDay, onSave, onClose,
  sequenceName, targetSegment, stepPosition, totalSteps, previousSubjects,
}: Props) {
  const [pickedType, setPickedType] = useState<SequenceStepType | null>(step?.type ?? null)
  const [delayDays, setDelayDays] = useState<number>(
    previousStepDay === null ? 0 : Math.max(0, (step?.day ?? (previousStepDay + 1)) - previousStepDay)
  )
  const [subject, setSubject] = useState(step?.subject ?? '')
  const [body, setBody] = useState(step?.body ?? '')
  const [htmlTemplate, setHtmlTemplate] = useState<SequenceHtmlTemplate>(step?.htmlTemplate ?? 'branded')
  const [cc, setCc] = useState((step?.cc ?? []).join(', '))
  const [bcc, setBcc] = useState((step?.bcc ?? []).join(', '))
  const [taskTitle, setTaskTitle] = useState(step?.taskTitle ?? '')
  const [taskPriority, setTaskPriority] = useState<TaskPriority>(step?.taskPriority ?? 'Medium')
  const [pauseUntilComplete, setPauseUntilComplete] = useState(step?.pauseUntilComplete ?? true)
  const [callScript, setCallScript] = useState(step?.callScript ?? '')
  const [abEnabled, setAbEnabled] = useState(step?.abEnabled ?? false)
  const [abSplit, setAbSplit] = useState(step?.abSplit ?? 50)
  const [variantBSubject, setVariantBSubject] = useState(step?.variantB?.subject ?? '')
  const [variantBBody, setVariantBBody] = useState(step?.variantB?.body ?? '')

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const variantBBodyRef = useRef<HTMLTextAreaElement>(null)
  const insertToken = useCursorInsert(bodyRef, body, setBody)
  const insertVariantBToken = useCursorInsert(variantBBodyRef, variantBBody, setVariantBBody)

  const [aiInstruction, setAiInstruction] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiDraft, setAiDraft] = useState<{ subject: string; body: string; source: string } | null>(null)
  const [aiError, setAiError] = useState('')

  async function generateWithAi() {
    setAiGenerating(true)
    setAiError('')
    setAiDraft(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sequence_email',
          context: {
            sequenceName: sequenceName || '',
            targetSegment: targetSegment || '',
            stepPosition: String(stepPosition ?? 1),
            totalSteps: String(totalSteps ?? stepPosition ?? 1),
            dayOffset: String(isFirstStep ? delayDays : (previousStepDay ?? 0) + delayDays),
            previousSubjects: (previousSubjects ?? []).join(' / '),
            instruction: aiInstruction.trim(),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      // The system prompt asks for "Subject: ...\n\n[body]" — parse that
      // shape but fall back to the whole thing as the body if a provider
      // (or the template fallback) doesn't follow it exactly, so a
      // slightly-off response is still usable instead of silently empty.
      const match = /^Subject:\s*(.+?)\n+([\s\S]*)$/.exec(data.content ?? '')
      setAiDraft({
        subject: match ? match[1].trim() : '',
        body: match ? match[2].trim() : (data.content ?? ''),
        source: data.source ?? 'none',
      })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate draft')
    }
    setAiGenerating(false)
  }

  function useAiDraft() {
    if (!aiDraft) return
    if (aiDraft.subject) setSubject(aiDraft.subject)
    setBody(aiDraft.body)
    setAiDraft(null)
    setAiInstruction('')
  }

  const isFirstStep = previousStepDay === null
  const canSave =
    pickedType === 'email' ? !!(subject.trim() && body.trim() && (!abEnabled || (variantBSubject.trim() && variantBBody.trim())))
    : pickedType === 'manual_email' ? taskTitle.trim()
    : pickedType === 'call' ? taskTitle.trim()
    : pickedType === 'task' ? taskTitle.trim()
    : false

  function save() {
    if (!pickedType || !canSave) return
    const day = isFirstStep ? delayDays : (previousStepDay as number) + Math.max(1, delayDays)
    const base: SequenceStep = {
      id: step?.id ?? `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: pickedType,
      day,
    }
    if (pickedType === 'email') {
      onSave({
        ...base,
        subject: subject.trim(),
        body,
        htmlTemplate,
        cc: cc.split(',').map(s => s.trim()).filter(Boolean),
        bcc: bcc.split(',').map(s => s.trim()).filter(Boolean),
        abEnabled,
        abSplit,
        variantB: abEnabled ? { subject: variantBSubject.trim(), body: variantBBody } : undefined,
      })
    } else if (pickedType === 'manual_email') {
      onSave({ ...base, taskTitle: taskTitle.trim(), body, taskPriority, pauseUntilComplete })
    } else if (pickedType === 'call') {
      onSave({ ...base, taskTitle: taskTitle.trim(), callScript, taskPriority, pauseUntilComplete })
    } else if (pickedType === 'task') {
      onSave({ ...base, taskTitle: taskTitle.trim(), body, taskPriority, pauseUntilComplete })
    }
  }

  const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-400"
  const selectCls = `${inputCls} bg-white`
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            {pickedType && !step && (
              <button onClick={() => setPickedType(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={16} className="text-gray-400" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-900">{step ? 'Edit step' : pickedType ? 'Add step' : 'Choose step'}</h2>
              {pickedType && <p className="text-xs text-gray-400 mt-0.5">{STEP_TYPE_OPTIONS.find(o => o.type === pickedType)?.label}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {!pickedType ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-2">
            {STEP_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.type}
                disabled={opt.disabled}
                onClick={() => setPickedType(opt.type)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors ${
                  opt.disabled ? 'border-gray-100 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/40'
                }`}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white" style={{ background: opt.color }}>
                  {opt.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            <div>
              <label className={labelCls}>{isFirstStep ? 'Send' : 'Delay after previous step'}</label>
              {isFirstStep ? (
                <select value={delayDays === 0 ? 'now' : 'later'} onChange={e => setDelayDays(e.target.value === 'now' ? 0 : Math.max(1, delayDays))} className={selectCls}>
                  <option value="now">Send now (immediately on enrollment)</option>
                  <option value="later">Send after a delay</option>
                </select>
              ) : null}
              {(!isFirstStep || delayDays > 0) && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min={1}
                    value={delayDays || 1}
                    onChange={e => setDelayDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className={`${inputCls} w-24`}
                  />
                  <span className="text-sm text-gray-500">day{delayDays === 1 ? '' : 's'} after previous step</span>
                </div>
              )}
            </div>

            {pickedType === 'email' && (
              <>
                <div className="border border-purple-100 rounded-xl p-3 bg-purple-50/40">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wand2 size={13} className="text-purple-600" />
                    <span className="text-xs font-semibold text-purple-800">AI Assist</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={aiInstruction}
                      onChange={e => setAiInstruction(e.target.value)}
                      placeholder="What should this email say? e.g. Introduce our SEO audit offer"
                      className={`${inputCls} bg-white`}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); generateWithAi() } }}
                    />
                    <button
                      type="button"
                      onClick={generateWithAi}
                      disabled={aiGenerating}
                      className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0"
                      style={{ background: '#7c3aed' }}
                    >
                      {aiGenerating ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Wand2 size={13} />}
                      Generate
                    </button>
                  </div>
                  {aiError && <p className="text-xs text-red-500 mt-2">{aiError}</p>}
                  {aiDraft && (
                    <div className="mt-2.5 p-2.5 bg-white border border-purple-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={11} className="text-purple-600" />
                          <span className="text-[11px] font-semibold text-purple-700">
                            Draft {aiSourceLabel(aiDraft.source)}
                          </span>
                        </div>
                        <button type="button" onClick={() => setAiDraft(null)} className="text-purple-400 hover:text-purple-600">
                          <X size={12} />
                        </button>
                      </div>
                      {aiDraft.subject && <p className="text-xs font-semibold text-gray-800 mb-1">{aiDraft.subject}</p>}
                      <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{aiDraft.body}</p>
                      <div className="flex gap-3 mt-2">
                        <button type="button" onClick={useAiDraft} className="text-xs font-semibold text-purple-700 hover:text-purple-900">
                          Use this draft
                        </button>
                        <button type="button" onClick={generateWithAi} className="text-xs font-semibold text-gray-500 hover:text-gray-700">
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Subject</label>
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Quick thought for {{company}}" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Body</label>
                  <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} rows={7} placeholder="Hey {{first_name}}, ..." className={`${inputCls} resize-none`} />
                  <TokenInsertBar onInsert={insertToken} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Template</label>
                    <select value={htmlTemplate} onChange={e => setHtmlTemplate(e.target.value as SequenceHtmlTemplate)} className={selectCls}>
                      <option value="branded">Branded</option>
                      <option value="minimal">Minimal</option>
                      <option value="plain">Plain text</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>CC (optional)</label>
                    <input value={cc} onChange={e => setCc(e.target.value)} placeholder="comma-separated" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>BCC (optional)</label>
                    <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="comma-separated" className={inputCls} />
                  </div>
                </div>

                <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={abEnabled} onChange={e => setAbEnabled(e.target.checked)} className="accent-emerald-600 w-4 h-4" />
                    <span className="text-sm font-medium text-gray-700">Add A/B test</span>
                  </label>
                  {abEnabled && (
                    <div className="mt-3 flex flex-col gap-3">
                      <div>
                        <label className={labelCls}>Split: {abSplit}% A / {100 - abSplit}% B</label>
                        <input type="range" min={10} max={90} step={5} value={abSplit} onChange={e => setAbSplit(parseInt(e.target.value))} className="w-full accent-emerald-600" />
                      </div>
                      <div>
                        <label className={labelCls}>Variant B — Subject</label>
                        <input value={variantBSubject} onChange={e => setVariantBSubject(e.target.value)} placeholder="Alternate subject line" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Variant B — Body</label>
                        <textarea ref={variantBBodyRef} value={variantBBody} onChange={e => setVariantBBody(e.target.value)} rows={5} className={`${inputCls} resize-none`} />
                        <TokenInsertBar onInsert={insertVariantBToken} />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {(pickedType === 'manual_email' || pickedType === 'call' || pickedType === 'task') && (
              <>
                <div>
                  <label className={labelCls}>Task Title</label>
                  <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Call contact and leave voicemail" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{pickedType === 'call' ? 'Call Script' : 'Notes'}</label>
                  <textarea
                    ref={pickedType === 'call' ? undefined : bodyRef}
                    value={pickedType === 'call' ? callScript : body}
                    onChange={e => pickedType === 'call' ? setCallScript(e.target.value) : setBody(e.target.value)}
                    rows={5}
                    className={`${inputCls} resize-none`}
                  />
                  {pickedType !== 'call' && <TokenInsertBar onInsert={insertToken} />}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Priority</label>
                    <select value={taskPriority} onChange={e => setTaskPriority(e.target.value as TaskPriority)} className={selectCls}>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={pauseUntilComplete} onChange={e => setPauseUntilComplete(e.target.checked)} className="accent-emerald-600 w-4 h-4" />
                      <span className="text-xs text-gray-600">Pause sequence until task is completed</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {pickedType && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
              style={{ background: '#015035' }}
            >
              {step ? 'Save Step' : 'Add Step'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
