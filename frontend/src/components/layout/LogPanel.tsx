import { useRef, useEffect, useCallback, useState } from 'react'
import type { LogLine } from '../../types'

// Literal strings so Tailwind v4 scanner picks them up
const LOG_COLOR: Record<LogLine['type'], string> = {
  info:    'text-slate-500',
  success: 'text-agent-dim',
  error:   'text-danger',
  warn:    'text-warning',
  system:  'text-info',
}

const LOG_PREFIX: Record<LogLine['type'], string> = {
  info:    '·',
  success: '✓',
  error:   '✗',
  warn:    '!',
  system:  '▸',
}

interface LogPanelProps {
  lines: LogLine[]
  workerName?: string
}

export function LogPanel({ lines, workerName }: LogPanelProps) {
  const scrollRef       = useRef<HTMLDivElement>(null)
  const isAtBottomRef   = useRef(true)
  const [showJumpBtn, setShowJumpBtn] = useState(false)

  // Track whether user is near the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distFromBottom < 64
    isAtBottomRef.current = atBottom
    setShowJumpBtn(!atBottom)
  }, [])

  // Auto-scroll when new lines arrive — only if already at bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isAtBottomRef.current) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [lines])

  // On worker change (new log stream), reset to bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    isAtBottomRef.current = true
    setShowJumpBtn(false)
  }, [workerName])

  const jumpToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [])

  // Derived counts for header badges
  const errorCount = lines.filter(l => l.type === 'error').length
  const warnCount  = lines.filter(l => l.type === 'warn').length

  return (
    <aside className="w-80 bg-void border-l border-border flex flex-col shrink-0">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="label-ops">Task Output</span>
          {lines.length > 0 && (
            <span className="font-mono text-[10px] text-slate-700">
              {lines.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {errorCount > 0 && (
            <span className="font-mono text-[9px] font-semibold text-danger">
              {errorCount} err
            </span>
          )}
          {warnCount > 0 && (
            <span className="font-mono text-[9px] font-semibold text-warning">
              {warnCount} warn
            </span>
          )}
          {workerName && (
            <>
              <div className="w-px h-3 bg-border-bright" />
              <span className="font-mono text-[10px] text-slate-700">{workerName}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Scrollable log stream ── */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto p-3"
        >
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
              <div className="w-8 h-8 border border-border-bright flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-slate-700" />
              </div>
              <p className="font-mono text-[10px] text-slate-700 uppercase tracking-widest">
                awaiting task…
              </p>
            </div>
          ) : (
            <div className="space-y-[1px]">
              {lines.map(line => (
                <div
                  key={line.id}
                  className="flex gap-2 font-mono text-[10.5px] leading-[1.65] group hover:bg-surface/30 px-1 -mx-1 transition-colors"
                >
                  {/* Timestamp */}
                  <span className="shrink-0 text-slate-700 tabular-nums w-[62px]">
                    {line.timestamp}
                  </span>

                  {/* Type prefix */}
                  <span className={`shrink-0 w-3 text-center select-none ${LOG_COLOR[line.type]}`}>
                    {LOG_PREFIX[line.type]}
                  </span>

                  {/* Message — allow wrapping on long lines */}
                  <span className="text-slate-400 break-words min-w-0 group-hover:text-slate-300 transition-colors">
                    {line.message}
                  </span>
                </div>
              ))}

              {/* Terminal cursor — signals the stream is live */}
              <div className="flex gap-2 font-mono text-[10.5px] pt-1 px-1">
                <span className="shrink-0 w-[62px] opacity-0 select-none">00:00:00</span>
                <span className="text-agent opacity-75 animate-pulse select-none">█</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Jump-to-bottom button — appears when user scrolls up ── */}
        {showJumpBtn && (
          <button
            onClick={jumpToBottom}
            className="
              absolute bottom-3 right-3 z-10
              flex items-center gap-1.5
              font-mono text-[9px] tracking-widest uppercase
              px-2.5 py-1.5 border
              text-agent border-agent/40 bg-void
              hover:bg-agent/8 hover:border-agent
              transition-all duration-150
              shadow-[0_4px_12px_rgba(0,0,0,0.4)]
            "
          >
            ↓ latest
          </button>
        )}
      </div>

      {/* ── Footer — line count + clear ── */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0">
        <span className="font-mono text-[9px] text-slate-700">
          {lines.length > 0 ? `${lines.length} lines` : 'no output'}
        </span>
        {lines.length > 0 && (
          <button className="font-mono text-[9px] text-slate-700 hover:text-slate-500 uppercase tracking-widest transition-colors">
            clear
          </button>
        )}
      </div>
    </aside>
  )
}
