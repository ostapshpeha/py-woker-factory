import { Link, useParams } from 'react-router-dom'
import { PageLayout } from '../components/layout/PageLayout'
import { mockWorkers, mockScreenshots, mockTasks } from '../data/mockData'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// Deterministic placeholder gradient per screenshot index
const GRADIENTS = [
  'linear-gradient(135deg, #0F1923 0%, #1A2C3D 50%, #0C1520 100%)',
  'linear-gradient(150deg, #0D1520 0%, #0F2030 55%, #111827 100%)',
  'linear-gradient(120deg, #111827 0%, #0A1A2A 60%, #0D1925 100%)',
  'linear-gradient(160deg, #0C1520 0%, #162233 50%, #080E18 100%)',
  'linear-gradient(140deg, #0E1B2A 0%, #1C2D3E 55%, #0A1522 100%)',
  'linear-gradient(130deg, #111827 0%, #0F2030 45%, #0D1825 100%)',
]

export function ScreenshotGalleryPage() {
  const { workerId } = useParams<{ workerId: string }>()
  const worker      = mockWorkers.find(w => w.id === workerId)
  const screenshots = mockScreenshots.filter(s => s.workerId === workerId)

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
        <span className="label-ops">Screenshots</span>
        {worker && (
          <>
            <span className="text-slate-700 font-mono text-[10px]">/</span>
            <span className="font-mono text-[11px] text-slate-300">{worker.name}</span>
          </>
        )}
        {screenshots.length > 0 && (
          <span className="ml-auto font-mono text-[10px] text-slate-700">
            {screenshots.length} capture{screenshots.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-y-auto">
        {!worker ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-[11px] text-slate-700 uppercase tracking-widest">Worker not found</p>
          </div>
        ) : screenshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-12 h-12 border border-border-bright flex items-center justify-center">
              <span className="font-mono text-lg text-slate-700">⊙</span>
            </div>
            <p className="font-mono text-[11px] text-slate-700 uppercase tracking-widest">
              no screenshots captured
            </p>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {screenshots.map((shot, i) => {
              const linkedTask = mockTasks.find(t => t.id === shot.taskId)
              const gradient   = GRADIENTS[i % GRADIENTS.length]

              return (
                <div
                  key={shot.id}
                  className="border border-border hover:border-border-bright transition-colors duration-150 group"
                >
                  {/* Thumbnail area — 16:9 placeholder */}
                  <div
                    className="relative w-full scanlines overflow-hidden"
                    style={{ aspectRatio: '16/9', background: gradient }}
                  >
                    {/* Corner markers */}
                    {[
                      'top-0 left-0',
                      'top-0 right-0 rotate-90',
                      'bottom-0 right-0 rotate-180',
                      'bottom-0 left-0 -rotate-90',
                    ].map((pos, ci) => (
                      <div key={ci} className={`absolute ${pos} w-3 h-3 pointer-events-none`}>
                        <div className="absolute top-0 left-0 w-full h-px bg-border-bright opacity-60" />
                        <div className="absolute top-0 left-0 w-px h-full bg-border-bright opacity-60" />
                      </div>
                    ))}

                    {/* Index badge */}
                    <div className="absolute top-2 left-2 font-mono text-[9px] text-slate-700 bg-void/70 px-1.5 py-px">
                      #{shot.index.toString().padStart(3, '0')}
                    </div>

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-void/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
                        no presigned URL
                      </span>
                    </div>
                  </div>

                  {/* Metadata strip */}
                  <div className="px-3 py-2 bg-void/40 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-slate-400 truncate">
                        {formatDate(shot.capturedAt)}
                      </span>
                      <span className="font-mono text-[9px] text-slate-700 shrink-0">{shot.id}</span>
                    </div>
                    {linkedTask && (
                      <p className="font-mono text-[10px] text-slate-600 truncate">
                        ▸ {linkedTask.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
