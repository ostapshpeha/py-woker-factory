import { useState, useCallback } from 'react'
import type { Worker } from '../../types'
import { mockWorkers, mockLogLines } from '../../data/mockData'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { LogPanel } from './LogPanel'
import { LiveViewBezel, LiveViewEmpty } from '../workers/LiveViewBezel'
import { TaskInputPanel } from './TaskInputPanel'

export function DashboardLayout() {
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [logPanelOpen, setLogPanelOpen] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(mockWorkers[0])

  const toggleSidebar  = useCallback(() => setSidebarOpen(prev => !prev), [])
  const closeSidebar   = useCallback(() => setSidebarOpen(false), [])
  const toggleLogPanel = useCallback(() => setLogPanelOpen(prev => !prev), [])

  const handleSelectWorker = useCallback((worker: Worker) => {
    setSelectedWorker(worker)
    closeSidebar()
  }, [closeSidebar])

  const visibleLogs = selectedWorker
    ? mockLogLines.filter(l => selectedWorker.status === 'BUSY' || l.type === 'system')
    : []

  return (
    <div className="flex flex-col h-screen bg-abyss overflow-hidden">
      <TopBar
        workers={mockWorkers}
        sidebarOpen={sidebarOpen}
        logPanelOpen={logPanelOpen}
        onMenuToggle={toggleSidebar}
        onLogPanelToggle={toggleLogPanel}
      />

      <div className="flex flex-1 overflow-hidden relative">

        {/* Mobile backdrop */}
        <div
          aria-hidden="true"
          onClick={closeSidebar}
          className={`
            fixed inset-0 z-20 bg-void/75 backdrop-blur-[1px] lg:hidden
            transition-opacity duration-200
            ${sidebarOpen
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
            }
          `}
        />

        <Sidebar
          workers={mockWorkers}
          selectedWorker={selectedWorker}
          isOpen={sidebarOpen}
          onSelectWorker={handleSelectWorker}
        />

        {/* ── Main content column ── */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Panel toolbar */}
          <div className="flex items-center justify-between px-5 py-2.5 bg-surface/30 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="label-ops">Live View</span>
              {selectedWorker && (
                <>
                  <span className="text-slate-700 font-mono text-[10px]">/</span>
                  <span className="font-mono text-[11px] text-slate-300 font-medium">
                    {selectedWorker.name}
                  </span>
                </>
              )}
            </div>

            {selectedWorker && (
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-slate-700 hidden sm:block">
                  vnc :{selectedWorker.port}
                </span>
              </div>
            )}
          </div>

          {/* ── Scrollable canvas ── */}
          {selectedWorker ? (
            <div className="flex-1 overflow-y-auto">
              {/* Grid background only behind the content, not the full panel */}
              <div className="grid-bg min-h-full">
                <div className="p-5 flex flex-col gap-4">
                  <LiveViewBezel worker={selectedWorker} />
                  <TaskInputPanel worker={selectedWorker} />
                </div>
              </div>
            </div>
          ) : (
            /* Empty state fills the remaining height and centers */
            <div className="flex-1 grid-bg scanlines relative flex items-center justify-center">
              <LiveViewEmpty />
            </div>
          )}
        </main>

        {/* ── Log panel ──
            hidden < xl, always visible on xl+.
            On sm–xl: toggled by logPanelOpen via the "logs" button in TopBar.
        ── */}
        <div className={`shrink-0 hidden ${logPanelOpen ? 'sm:flex' : ''} xl:flex`}>
          <LogPanel
            lines={visibleLogs}
            workerName={selectedWorker?.name}
          />
        </div>

      </div>
    </div>
  )
}
