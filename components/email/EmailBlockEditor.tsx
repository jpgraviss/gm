'use client'

import { useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  GripVertical, Trash2, ChevronDown, ChevronUp, Type, Image, MousePointer,
  Minus, Link2, ArrowUpDown, Heading, Copy,
} from 'lucide-react'
import {
  type EmailBlock, type EmailBlockType, BLOCK_TYPES, newBlock, renderBlock,
} from '@/lib/email-builder'

interface Props {
  blocks: EmailBlock[]
  onChange: (blocks: EmailBlock[]) => void
}

const ICON_MAP: Record<EmailBlockType, React.ReactNode> = {
  header:  <Heading size={14} />,
  text:    <Type size={14} />,
  image:   <Image size={14} />,
  button:  <MousePointer size={14} />,
  divider: <Minus size={14} />,
  spacer:  <ArrowUpDown size={14} />,
  social:  <Link2 size={14} />,
  columns: <Copy size={14} />,
}

export default function EmailBlockEditor({ blocks, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const addBlock = useCallback((type: EmailBlockType) => {
    onChange([...blocks, newBlock(type)])
  }, [blocks, onChange])

  const removeBlock = useCallback((id: string) => {
    onChange(blocks.filter(b => b.id !== id))
    if (editingId === id) setEditingId(null)
  }, [blocks, onChange, editingId])

  const updateBlock = useCallback((id: string, content: Record<string, unknown>) => {
    onChange(blocks.map(b => b.id === id ? { ...b, content } : b))
  }, [blocks, onChange])

  const duplicateBlock = useCallback((id: string) => {
    const idx = blocks.findIndex(b => b.id === id)
    if (idx === -1) return
    const copy = { ...blocks[idx], id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, content: { ...blocks[idx].content } }
    const next = [...blocks]
    next.splice(idx + 1, 0, copy)
    onChange(next)
  }, [blocks, onChange])

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return
    const from = result.source.index
    const to = result.destination.index
    if (from === to) return
    const next = [...blocks]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }, [blocks, onChange])

  return (
    <div className="flex flex-col gap-4">
      {/* Block palette */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Add block</p>
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPES.map(bt => (
            <button
              key={bt.type}
              onClick={() => addBlock(bt.type)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
              title={bt.description}
            >
              {ICON_MAP[bt.type]} {bt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Block list */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="email-blocks">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-2 min-h-[100px]">
              {blocks.length === 0 && (
                <div className="py-12 text-center text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  Click a block above to start building your email
                </div>
              )}
              {blocks.map((block, index) => (
                <Draggable key={block.id} draggableId={block.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`rounded-xl border overflow-hidden ${
                        snapshot.isDragging ? 'border-emerald-300 shadow-lg' : 'border-gray-200'
                      } ${editingId === block.id ? 'ring-2 ring-emerald-500' : ''}`}
                    >
                      {/* Block header */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <div {...dragProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-gray-200 touch-none">
                          <GripVertical size={14} className="text-gray-400" />
                        </div>
                        <span className="text-gray-500">{ICON_MAP[block.type]}</span>
                        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide flex-1">
                          {BLOCK_TYPES.find(bt => bt.type === block.type)?.label ?? block.type}
                        </span>
                        <button
                          onClick={() => setEditingId(editingId === block.id ? null : block.id)}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400"
                          title={editingId === block.id ? 'Collapse' : 'Edit'}
                        >
                          {editingId === block.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        <button onClick={() => duplicateBlock(block.id)} className="p-1 rounded hover:bg-gray-200 text-gray-400" title="Duplicate">
                          <Copy size={12} />
                        </button>
                        <button onClick={() => removeBlock(block.id)} className="p-1 rounded hover:bg-red-50 text-red-400" title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Block preview */}
                      <div
                        className="cursor-pointer"
                        onClick={() => setEditingId(editingId === block.id ? null : block.id)}
                        dangerouslySetInnerHTML={{ __html: renderBlock(block) }}
                      />

                      {/* Block editor (expanded) */}
                      {editingId === block.id && (
                        <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-3">
                          <BlockSettings block={block} onUpdate={(content) => updateBlock(block.id, content)} />
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}

// ─── Per-block settings panel ──────────────────────────────────────────────

function BlockSettings({ block, onUpdate }: { block: EmailBlock; onUpdate: (content: Record<string, unknown>) => void }) {
  const c = block.content

  function set(key: string, value: unknown) {
    onUpdate({ ...c, [key]: value })
  }

  switch (block.type) {
    case 'text':
    case 'header':
      return (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Content (HTML)</label>
          <textarea
            value={String(c.html ?? '')}
            onChange={e => set('html', e.target.value)}
            rows={4}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
          />
          {block.type === 'header' && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Background</label>
                <input type="color" value={String(c.bgColor ?? '#015035')} onChange={e => set('bgColor', e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Text color</label>
                <input type="color" value={String(c.textColor ?? '#ffffff')} onChange={e => set('textColor', e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Padding</label>
                <input value={String(c.padding ?? '32px 24px')} onChange={e => set('padding', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
              </div>
            </div>
          )}
        </div>
      )

    case 'image':
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Image URL</label>
            <input value={String(c.src ?? '')} onChange={e => set('src', e.target.value)} placeholder="https://..." className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Alt text</label>
            <input value={String(c.alt ?? '')} onChange={e => set('alt', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Link URL</label>
            <input value={String(c.link ?? '')} onChange={e => set('link', e.target.value)} placeholder="https://..." className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Width</label>
            <input value={String(c.width ?? '100%')} onChange={e => set('width', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Align</label>
            <select value={String(c.align ?? 'center')} onChange={e => set('align', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      )

    case 'button':
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Button text</label>
            <input value={String(c.text ?? '')} onChange={e => set('text', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Link URL</label>
            <input value={String(c.url ?? '')} onChange={e => set('url', e.target.value)} placeholder="https://..." className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Background</label>
            <input type="color" value={String(c.bgColor ?? '#015035')} onChange={e => set('bgColor', e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Text color</label>
            <input type="color" value={String(c.textColor ?? '#ffffff')} onChange={e => set('textColor', e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Align</label>
            <select value={String(c.align ?? 'center')} onChange={e => set('align', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Border radius</label>
            <input value={String(c.borderRadius ?? '8px')} onChange={e => set('borderRadius', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
          </div>
        </div>
      )

    case 'divider':
      return (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Color</label>
            <input type="color" value={String(c.color ?? '#e5e7eb')} onChange={e => set('color', e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Thickness</label>
            <input value={String(c.thickness ?? '1px')} onChange={e => set('thickness', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Width</label>
            <input value={String(c.width ?? '100%')} onChange={e => set('width', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
          </div>
        </div>
      )

    case 'spacer':
      return (
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Height</label>
          <input value={String(c.height ?? '20px')} onChange={e => set('height', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
        </div>
      )

    case 'social':
      return (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Social links</label>
          {((c.links ?? []) as Array<{ platform: string; url: string }>).map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 capitalize">{link.platform}</span>
              <input
                value={link.url}
                onChange={e => {
                  const links = [...((c.links ?? []) as Array<{ platform: string; url: string }>)]
                  links[i] = { ...links[i], url: e.target.value }
                  set('links', links)
                }}
                placeholder={`https://${link.platform}.com/...`}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5"
              />
            </div>
          ))}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Align</label>
            <select value={String(c.align ?? 'center')} onChange={e => set('align', e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      )

    default:
      return <p className="text-xs text-gray-400">No settings for this block type</p>
  }
}
