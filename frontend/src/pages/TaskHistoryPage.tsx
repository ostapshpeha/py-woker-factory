import { Link, useParams } from 'react-router-dom'
import { PageLayout } from '../components/layout/PageLayout'
import { mockWorkers, mockTasks } from '../data/mockData'
import { SKILL_BY_ID } from '../lib/skills'
import type { TaskStatus } from '../types'

// ── Helpers ───────────────────────────────────────────────────────
function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// Literal strings for Tailwind scanner
const STATUS_BADGE: Record<TaskStatus, string> = {
  QUEUED:     'text-slate-500  border-slate-700',
  PROCESSING: 'text-info       border-info/40',
  COMPLETED:  'text-agent      border-agent/40',
  FAILED:     'text-danger     border-danger/40',
}

const STATUS_ROW_ACCENT: Record<TaskStatus, string> = {
  QUEUED:     '',
  PROCESSING: 'border-l-info',
  COMPLETED:  '',
  FAILED:     'border-l-danger',
}

// ── Page ──────────────────────────────────────────────────────────
export function TaskHistoryPage() {
  const { workerId } = useParams<{ workerId: string }>()
  const worker = mockWorkers.find(w => w.id === workerId)
  const tasks  = mockTasks.filter(t => t.workerId === workerId)

  return (
    <PageLayout activeWorkerId={workerId}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-surface/30 shrink-0">
        <Link
          to="/"
          className="font-mono text-[10px] text-slate-600 hover:text-slate-300 transition-colors uppercase tracking-widest"
        >
          ← Dashboard
        </Link>
        <span className="text-slate-700 font-mono text-[10px]">/</span>
        <span className="label-ops">Task History</span>
        {worker && (
          <>
            <span className="text-slate-700 font-mono text-[10px]">/</span>
            <span className="font-mono text-[11px] text-slate-300">{worker.name}</span>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!worker ? (
          <NotFound label="Worker not found" />
        ) : (
          <div className="p-5 max-w-3xl space-y-1">

            {/* Worker summary */}
            <div className="flex items-center gap-4 mb-5 pb-4 border-b border-border">
              <span className="font-mono text-sm font-semibold text-slate-100">{worker.name}</span>
              <span className="font-mono text-[10px] text-slate-600">{worker.id}</span>
              <span className="font-mono text-[10px] text-slate-700">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''} total
              </span>
            </div>

            {tasks.length === 0 ? (
              <p className="font-mono text-[11px] text-slate-700 py-8 text-center">
                no tasks recorded
              </p>
            ) : (
              tasks.map(task => {
                const skill = SKILL_BY_ID[task.skill]
                return (
                  <div
                    key={task.id}
                    className={`
                      flex items-start gap-4 px-4 py-3
                      border-l-2 border-border bg-surface/20
                      hover:bg-surface/50 transition-colors duration-150
                      ${STATUS_ROW_ACCENT[task.status]}
                    `}
                  >
                    {/* Status badge */}
                    <span className={`
                      shrink-0 font-mono text-[9px] font-semibold tracking-wider
                      uppercase px-1.5 py-px border mt-0.5
                      ${STATUS_BADGE[task.status]}
                    `}>
                      {task.status}
                    </span>

                    {/* Skill icon */}
                    <span className="shrink-0 font-mono text-sm text-slate-600 mt-px" title={skill.label}>
                      {skill.icon}
                    </span>

                    {/* Description + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-slate-200 leading-snug">
                        {task.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="font-mono text-[10px] text-slate-600">{task.id}</span>
                        <span className="font-mono text-[10px] text-slate-700">
                          {formatDate(task.createdAt)}
                        </span>
                        {task.durationSec !== undefined && (
                          <span className="font-mono text-[10px] text-slate-600">
                            {formatDuration(task.durationSec)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

function NotFound({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center flex-1 h-full">
      <p className="font-mono text-[11px] text-slate-700 uppercase tracking-widest">{label}</p>
    </div>
  )
}
