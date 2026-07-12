import { X, CheckCircle, AlertCircle } from 'lucide-react'
import type { SetupCard } from './SetupCards'

interface Props {
  setup: SetupCard
  onClose: () => void
}

function DotArray({ hits, total }: { hits: number; total: number }) {
  const dots = Array.from({ length: total }, (_, i) => i < hits)
  return (
    <div className="flex flex-wrap gap-1 mt-3">
      {dots.map((hit, i) => (
        <div key={i}
             className="rounded-full"
             style={{
               width: 8, height: 8,
               background: hit ? 'rgba(37,99,235,0.7)' : 'rgba(234,88,12,0.35)',
               flexShrink: 0,
             }} />
      ))}
    </div>
  )
}

export default function SetupDetail({ setup, onClose }: Props) {
  const { baseRate, typicalRange, dotArray } = setup
  const tierColor = setup.tier === 'strong' ? '#059669' : setup.tier === 'moderate' ? '#d97706' : '#7c7a8e'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(15,13,26,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 overflow-y-auto"
           style={{
             width: 'min(540px, 100vw)',
             background: 'rgba(255,255,255,0.96)',
             backdropFilter: 'blur(24px)',
             borderLeft: '1px solid rgba(99,88,143,0.18)',
             boxShadow: '-8px 0 40px rgba(99,88,143,0.15)',
           }}>
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-semibold" style={{ color: '#0f0d1a' }}>{setup.ticker}</span>
                <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>·</span>
                <span className="font-mono text-xs" style={{ color: tierColor }}>
                  {setup.tier} tier
                </span>
              </div>
              <h2 className="font-serif font-semibold" style={{ fontSize: '1.35rem', color: '#0f0d1a', lineHeight: 1.25 }}>
                {setup.pattern}
              </h2>
              <p className="text-xs mt-1" style={{ color: '#7c7a8e', fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}>
                {setup.tierNote}
              </p>
            </div>
            <button onClick={onClose}
                    className="p-2 rounded-lg transition-fast hover:bg-gray-100"
                    style={{ color: '#7c7a8e', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          {/* What fired */}
          <section className="mb-6">
            <h3 className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: '#6366f1' }}>What fired</h3>
            <ul className="space-y-2">
              {setup.whatFired.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#6366f1' }} />
                  <span className="text-sm leading-relaxed" style={{ color: '#3d3a4f', fontFamily: 'Inter, sans-serif' }}>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Base rate */}
          <section className="mb-6 rounded-xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <h3 className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: '#6366f1' }}>Historical Base Rate</h3>

            <p className="text-sm leading-relaxed mb-4" style={{ color: '#3d3a4f', fontFamily: 'Inter, sans-serif' }}>
              Higher {baseRate.days} days later in{' '}
              <strong className="font-semibold" style={{ color: '#0f0d1a' }}>{baseRate.higher} of {baseRate.total}</strong>{' '}
              similar cases —{' '}
              <strong className="font-semibold" style={{ color: '#2563eb' }}>{baseRate.pct.toFixed(1)}%</strong>.
              <br />
              <span className="text-xs" style={{ color: '#7c7a8e' }}>
                95% confidence interval: {baseRate.ciLow}%–{baseRate.ciHigh}%. Sample: n={baseRate.total}.
              </span>
            </p>

            {/* Dot array — each dot = one case */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(37,99,235,0.7)' }} />
                  <span className="font-mono text-[10px]" style={{ color: '#7c7a8e' }}>Higher ({dotArray.hits})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(234,88,12,0.35)' }} />
                  <span className="font-mono text-[10px]" style={{ color: '#7c7a8e' }}>Lower ({dotArray.total - dotArray.hits})</span>
                </div>
              </div>
              <DotArray hits={dotArray.hits} total={dotArray.total} />
              <p className="font-mono text-[10px] mt-2" style={{ color: '#aaa9b8' }}>
                Each dot = one historical occurrence. Misses are intentionally visible.
              </p>
            </div>
          </section>

          {/* Typical range */}
          <section className="mb-6">
            <h3 className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: '#6366f1' }}>Typical Range (Not a Target)</h3>
            <div className="flex items-center gap-4 rounded-xl p-4" style={{ background: 'rgba(99,88,143,0.05)', border: '1px solid rgba(99,88,143,0.1)' }}>
              <div className="text-center">
                <div className="font-mono text-xs" style={{ color: '#7c7a8e' }}>25th pct</div>
                <div className="font-mono font-semibold text-lg" style={{ color: '#ea580c', fontFeatureSettings: '"tnum" 1' }}>
                  {typicalRange.low}{typicalRange.unit}
                </div>
              </div>
              <div className="flex-1 h-2 rounded-full overflow-hidden mx-2"
                   style={{ background: 'linear-gradient(90deg, rgba(234,88,12,0.3) 0%, rgba(99,102,241,0.15) 50%, rgba(37,99,235,0.3) 100%)' }} />
              <div className="text-center">
                <div className="font-mono text-xs" style={{ color: '#7c7a8e' }}>75th pct</div>
                <div className="font-mono font-semibold text-lg" style={{ color: '#2563eb', fontFeatureSettings: '"tnum" 1' }}>
                  +{typicalRange.high}{typicalRange.unit}
                </div>
              </div>
            </div>
            <p className="text-xs mt-2 italic" style={{ color: '#aaa9b8', fontFamily: 'Inter, sans-serif' }}>
              {typicalRange.note}. This is a historical distribution, not a price target.
            </p>
          </section>

          {/* What would weaken this */}
          <section>
            <h3 className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: '#ea580c' }}>What Would Weaken This</h3>
            <ul className="space-y-2">
              {setup.weakenedBy.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#ea580c' }} />
                  <span className="text-sm leading-relaxed" style={{ color: '#3d3a4f', fontFamily: 'Inter, sans-serif' }}>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-4 hairline">
              <p className="text-xs italic" style={{ color: '#aaa9b8', fontFamily: 'Inter, sans-serif' }}>
                This is not a buy or sell recommendation. Setup cards describe historical base rates in similar market conditions. Past patterns do not guarantee future results. You are responsible for your own decisions.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
