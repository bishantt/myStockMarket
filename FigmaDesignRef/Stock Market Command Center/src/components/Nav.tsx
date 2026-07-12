import type { Page } from '../App'

interface Props {
  page: Page
  onNav: (p: Page) => void
}

const navItems: { id: Page; label: string }[] = [
  { id: 'desk', label: 'The Desk' },
  { id: 'track-record', label: 'Track Record' },
  { id: 'academy', label: 'Academy' },
]

export default function Nav({ page, onNav }: Props) {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 py-3"
         style={{
           background: 'rgba(249,248,255,0.85)',
           backdropFilter: 'blur(20px)',
           WebkitBackdropFilter: 'blur(20px)',
           borderBottom: '1px solid rgba(99,88,143,0.1)',
         }}>
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-md flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
          <span className="font-mono text-white text-xs font-bold">M</span>
        </div>
        <div>
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: '#4f46e5' }}>Market Desk</span>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex items-center gap-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            className="px-4 py-1.5 text-sm transition-fast rounded-lg"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: page === item.id ? 600 : 400,
              color: page === item.id ? '#4f46e5' : '#3d3a4f',
              background: page === item.id ? 'rgba(99,102,241,0.08)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Date + status */}
      <div className="hidden md:flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.6)' }} />
        <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>Fri Jul 11, 2026</span>
      </div>
    </nav>
  )
}
