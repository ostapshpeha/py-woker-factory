export type SkillId =
  | 'planner'
  | 'data-wizard'
  | 'diagram-builder'
  | 'web-researcher'
  | 'document-generator'

export const SKILLS: {
  id: SkillId
  icon: string
  label: string
  hint: string
}[] = [
  { id: 'planner',            icon: '◆', label: 'Planner',       hint: 'Strategic reasoning & multi-step planning' },
  { id: 'data-wizard',        icon: '∑', label: 'Data Wizard',   hint: 'Data extraction, parsing & analysis' },
  { id: 'diagram-builder',    icon: '⊞', label: 'Diagram Builder', hint: 'Charts, flowcharts & visualizations' },
  { id: 'web-researcher',     icon: '◎', label: 'Web Researcher', hint: 'Web scraping, browsing & research' },
  { id: 'document-generator', icon: '≡', label: 'Doc Generator', hint: 'Reports, docs & structured output' },
]

export const SKILL_BY_ID = Object.fromEntries(
  SKILLS.map(s => [s.id, s])
) as Record<SkillId, typeof SKILLS[number]>
