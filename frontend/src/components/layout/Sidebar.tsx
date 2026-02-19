import type { Worker } from '../../types'
import { WorkerCard } from '../workers/WorkerCard'

interface SidebarProps {
  workers: Worker[]
  selectedWorker: Worker | null
  isOpen: boolean
  onSelectWorker: (worker: Worker) => void
}

export function Sidebar({ workers, selectedWorker, isOpen, onSelectWorker }: SidebarProps) {
  const activeCount = workers.filter(w => w.status !== 'OFFLINE').length

  return (
    <aside
      className={`
        absolute inset-y-0 left-0 z-30
        flex flex-col w-60 bg-void border-r border-border
        transition-transform duration-200 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:static lg:translate-x-0 lg:transition-none
      `}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="label-ops">Workers</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-slate-600">{activeCount} active</span>
          <span className="font-mono text-[10px] text-slate-700">·</span>
          <span className="font-mono text-[10px] text-slate-700">{workers.length}/3</span>
        </div>
      </div>

      {/* ── Worker list ── */}
      <div className="flex-1 overflow-y-auto">
        {workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 border border-border-bright flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            </div>
            <p className="font-mono text-[10px] text-slate-700 uppercase tracking-widest">
              no workers
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {workers.map(worker => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                isSelected={selectedWorker?.id === worker.id}
                onClick={() => onSelectWorker(worker)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer: spawn button ── */}
      <div className="p-3 border-t border-border shrink-0">
        <button className="
          w-full py-2 px-4
          font-mono text-[11px] tracking-widest uppercase
          text-agent border border-agent-dark
          hover:border-agent hover:bg-agent/5
          active:bg-agent/10
          transition-colors duration-150
        ">
          + Spawn Worker
        </button>

        {/* Slot count indicator */}
        {workers.length >= 3 && (
          <p className="font-mono text-[9px] text-slate-700 text-center mt-2 tracking-widest uppercase">
            max workers reached
          </p>
        )}
      </div>
    </aside>
  )
}
