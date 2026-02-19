import { Link } from 'react-router-dom'
import { PageLayout } from '../components/layout/PageLayout'
import { mockWorkers, mockTasks, mockScreenshots } from '../data/mockData'

function maskToken(token: string): string {
  return token.slice(0, 6) + '••••••••••••••••' + token.slice(-4)
}

const MOCK_USER = {
  id:          'usr_op7f3a',
  username:    'operator',
  email:       'operator@worker-factory.ai',
  role:        'Operator',
  joinedAt:    '2026-02-01',
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3Jfb3A3ZjNhIn0.abcdef',
  accessExp:   '1h 47m',
  refreshExp:  '6d 22h',
}

export function ProfilePage() {
  const totalTasks       = mockTasks.length
  const totalScreenshots = mockScreenshots.length
  const activeWorkers    = mockWorkers.filter(w => w.status !== 'OFFLINE').length

  return (
    <PageLayout>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-surface/30 shrink-0">
        <Link
          to="/"
          className="font-mono text-[10px] text-slate-600 hover:text-slate-300 transition-colors uppercase tracking-widest"
        >
          ← Dashboard
        </Link>
        <span className="text-slate-700 font-mono text-[10px]">/</span>
        <span className="label-ops">Profile</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 max-w-xl space-y-px">

          {/* Identity block */}
          <div className="border border-border bg-surface/30 p-5 flex items-start gap-4">
            {/* Avatar placeholder */}
            <div className="w-12 h-12 border border-border-bright bg-void flex items-center justify-center shrink-0">
              <span className="font-mono text-lg text-slate-600">◆</span>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-slate-100">{MOCK_USER.username}</p>
              <p className="font-mono text-[11px] text-slate-500">{MOCK_USER.email}</p>
              <p className="font-mono text-[10px] text-slate-700 mt-0.5">{MOCK_USER.id}</p>
            </div>
          </div>

          {/* Account details */}
          <Section title="Account">
            <Row label="Role"   value={MOCK_USER.role} />
            <Row label="Joined" value={MOCK_USER.joinedAt} />
            <Row label="Email"  value={MOCK_USER.email} />
          </Section>

          {/* Session / tokens */}
          <Section title="Session">
            <Row
              label="Access token"
              value={maskToken(MOCK_USER.accessToken)}
              mono dim
            />
            <Row label="Access expires"  value={`in ${MOCK_USER.accessExp}`} />
            <Row label="Refresh expires" value={`in ${MOCK_USER.refreshExp}`} />
          </Section>

          {/* Activity stats */}
          <Section title="Activity">
            <Row label="Active workers"  value={`${activeWorkers} / 3`} />
            <Row label="Total tasks"     value={String(totalTasks)} />
            <Row label="Screenshots"     value={String(totalScreenshots)} />
          </Section>

          {/* Danger zone */}
          <Section title="Danger Zone">
            <div className="flex items-center justify-between py-1">
              <span className="font-mono text-[11px] text-slate-400">Sign out of this session</span>
              <button className="font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 border border-danger/40 text-danger hover:bg-danger/8 hover:border-danger transition-colors duration-150">
                Sign Out
              </button>
            </div>
          </Section>

        </div>
      </div>
    </PageLayout>
  )
}

// ── Section + Row helpers ─────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-surface/20">
      <div className="px-4 py-2 border-b border-border bg-void/30">
        <span className="label-ops">{title}</span>
      </div>
      <div className="px-4 py-1 divide-y divide-border/50">
        {children}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  dim = false,
}: {
  label: string
  value: string
  mono?: boolean
  dim?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="font-mono text-[10px] text-slate-600 uppercase tracking-wider shrink-0">
        {label}
      </span>
      <span className={`font-mono text-[11px] text-right break-all ${dim ? 'text-slate-700' : 'text-slate-300'}`}>
        {value}
      </span>
    </div>
  )
}
