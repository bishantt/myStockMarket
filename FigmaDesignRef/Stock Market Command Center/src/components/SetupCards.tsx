import { useState } from 'react'
import { setupCards } from '../data/mockData'
import SetupDetail from './SetupDetail'

export type SetupCard = (typeof setupCards)[number]

const tierStyle = {
  strong: { color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  moderate: { color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  weak: { color: '#7c7a8e', bg: 'rgba(124,122,142,0.08)' },
}

function MiniDotArray({ hits, total }: { hits: number; total: number }) {
  const show = Math.min(total, 40)
  const scale = hits / total
  const showHits = Math.round(scale * show)
  const dots = Array.from({ length: show }, (_, i) => i < showHits)
  return (
    <div className="flex flex-wrap gap-0.5">
      {dots.map((hit, i) => (
        <div key={i} className="rounded-full"
             style={{ width: 6, height: 6, background: hit ? 'rgba(37,99,235,0.6)' : 'rgba(234,88,12,0.3)', flexShrink: 0 }} />
      ))}
      {total > show && <span className="font-mono text-[9px] self-end" style={{ color: '#aaa9b8' }}>+{total - show}</span>}
    </div>
  )
}

export default function SetupCards() {
  const [selected, setSelected] = useState<SetupCard | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif font-semibold" style={{ fontSize: '1.2rem', color: '#0f0d1a' }}>
          Setup Cards
        </h2>
        <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>
          {setupCards.length} active · not recommendations
        </span>
      </div>

      <div className="space-y-3">
        {setupCards.map(setup => {
          const ts = tierStyle[setup.tier as keyof typeof tierStyle]
          const br = setup.baseRate
          return (
            <button
              key={setup.id}
              onClick={() => setSelected(setup)}
              className="w-full text-left glass rounded-2xl p-5 transition-fast block"
              style={{
                border: 'none',
                cursor: 'pointer',
                transition: 'box-shadow 0.18s, transform 0.18s',
              }}
              onMouseEnter={e => {
                const t = e.currentTarget as HTMLButtonElement
                t.style.boxShadow = '0 6px 24px rgba(99,88,143,0.12)'
                t.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                const t = e.currentTarget as HTMLButtonElement
                t.style.boxShadow = ''
                t.style.transform = ''
              }}
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-bold text-base" style={{ color: '#0f0d1a' }}>{setup.ticker}</span>
                    <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>{setup.name}</span>
                  </div>
                  <div className="font-serif italic" style={{ fontSize: '0.95rem', color: '#3d3a4f' }}>
                    {setup.pattern}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md"
                        style={{ color: ts.color, background: ts.bg }}>
                    {setup.tier}
                  </span>
                </div>
              </div>

              {/* Hairline */}
              <div className="hairline mb-3" />

              {/* Base rate */}
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] tracking-widest uppercase mb-1.5" style={{ color: '#7c7a8e' }}>
                    Base rate · {br.days}d forward
                  </div>
                  <p className="text-xs leading-snug" style={{ color: '#3d3a4f', fontFamily: 'Inter, sans-serif' }}>
                    Higher in <strong>{br.higher} of {br.total}</strong> cases —{' '}
                    <strong style={{ color: '#2563eb' }}>{br.pct.toFixed(1)}%</strong>
                    <span style={{ color: '#aaa9b8' }}> ({br.ciLow}–{br.ciHigh}% CI)</span>
                  </p>
                  <div className="mt-2">
                    <MiniDotArray hits={br.higher} total={br.total} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-[10px] tracking-widest uppercase mb-1" style={{ color: '#7c7a8e' }}>
                    Typical range
                  </div>
                  <div className="font-mono text-xs" style={{ color: '#2563eb', fontFeatureSettings: '"tnum" 1' }}>
                    {setup.typicalRange.low}% to +{setup.typicalRange.high}%
                  </div>
                  <div className="mt-2 text-xs" style={{ color: '#6366f1', fontFamily: 'Inter, sans-serif' }}>
                    Full analysis →
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <SetupDetail setup={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
