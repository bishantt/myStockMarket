import { movers } from '../data/mockData'

export default function Movers() {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif font-semibold" style={{ fontSize: '1.2rem', color: '#0f0d1a' }}>
          Movers with Reason
        </h2>
        <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>Yesterday's session</span>
      </div>

      {/* Table header */}
      <div className="grid items-center gap-2 py-1.5 mb-0"
           style={{ gridTemplateColumns: '90px 1fr 70px 60px', borderBottom: '1px solid rgba(99,88,143,0.15)' }}>
        {['Ticker', 'Catalyst', 'Move', 'RelVol'].map(h => (
          <span key={h} className="font-mono text-[10px] tracking-widest uppercase text-right last:text-right first:text-left"
                style={{ color: '#7c7a8e' }}>
            {h}
          </span>
        ))}
      </div>

      {movers.map((m, i) => {
        const up = m.changePct >= 0
        return (
          <div key={m.ticker}
               className="grid items-center gap-2 py-3"
               style={{
                 gridTemplateColumns: '90px 1fr 70px 60px',
                 borderBottom: i < movers.length - 1 ? '1px solid rgba(99,88,143,0.07)' : 'none',
               }}>
            {/* Ticker + name */}
            <div>
              <div className="font-mono text-sm font-semibold" style={{ color: '#0f0d1a' }}>{m.ticker}</div>
              <div className="font-mono text-xs" style={{ color: '#7c7a8e' }}>{m.price.toFixed(2)}</div>
            </div>

            {/* Catalyst */}
            <div className="pr-2">
              <span className="text-xs leading-snug" style={{ color: m.noisy ? '#7c7a8e' : '#3d3a4f', fontFamily: 'Inter, sans-serif', fontStyle: m.noisy ? 'italic' : 'normal' }}>
                {m.catalyst}
              </span>
            </div>

            {/* Change pct */}
            <div className="text-right">
              <span className="font-mono text-sm font-semibold"
                    style={{ color: up ? '#2563eb' : '#ea580c', fontFeatureSettings: '"tnum" 1' }}>
                {up ? '+' : ''}{m.changePct.toFixed(1)}%
              </span>
            </div>

            {/* RelVol */}
            <div className="text-right">
              <span className="font-mono text-xs font-medium" style={{ color: m.relVol >= 2 ? '#4f46e5' : '#7c7a8e', fontFeatureSettings: '"tnum" 1' }}>
                {m.relVol.toFixed(1)}×
              </span>
            </div>
          </div>
        )
      })}

      <div className="mt-3 pt-3 hairline">
        <p className="text-xs" style={{ color: '#aaa9b8', fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}>
          RelVol = today's volume ÷ 20-day average. "No clear reason" means the move lacks an identifiable catalyst — it may be noise, or information that isn't yet public.
        </p>
      </div>
    </div>
  )
}
