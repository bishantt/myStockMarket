import { marketData } from '../data/mockData'

function ChangeChip({ val, pct }: { val: number; pct: number }) {
  const up = val >= 0
  return (
    <span className="font-mono text-xs px-2 py-0.5 rounded"
          style={{
            color: up ? '#2563eb' : '#ea580c',
            background: up ? 'rgba(37,99,235,0.08)' : 'rgba(234,88,12,0.08)',
            fontFeatureSettings: '"tnum" 1',
          }}>
      {up ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

export default function MarketPulse() {
  const { indices } = marketData

  return (
    <div className="glass rounded-2xl px-5 py-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs tracking-widest uppercase" style={{ color: '#7c7a8e' }}>
          Market Pulse — Pre-market
        </span>
        <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>
          7:42 AM ET
        </span>
      </div>

      <div className="grid gap-0" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {indices.map((idx, i) => (
          <div key={idx.ticker}
               className="py-3 px-1"
               style={{
                 borderLeft: i > 0 ? '1px solid rgba(99,88,143,0.1)' : 'none',
                 paddingLeft: i > 0 ? '1.25rem' : 0,
               }}>
            <div className="font-mono text-xs tracking-wide mb-1" style={{ color: '#7c7a8e' }}>
              {idx.ticker}
            </div>
            {idx.label ? (
              <div className="font-mono font-medium mb-1" style={{ fontSize: '1rem', color: '#0f0d1a', fontFeatureSettings: '"tnum" 1' }}>
                {idx.value}
              </div>
            ) : (
              <div className="font-mono font-semibold mb-1"
                   style={{ fontSize: '1.05rem', color: '#0f0d1a', fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.01em' }}>
                {typeof idx.value === 'number' ? idx.value.toLocaleString('en-US', { minimumFractionDigits: idx.unit ? 3 : 2, maximumFractionDigits: idx.unit ? 3 : 2 }) : idx.value}
                {idx.unit && <span className="text-xs ml-0.5">{idx.unit}</span>}
              </div>
            )}
            {typeof idx.changePct === 'number' && <ChangeChip val={idx.change} pct={idx.changePct} />}
            <div className="font-mono text-xs mt-1.5" style={{ color: '#7c7a8e' }}>{idx.name}</div>
          </div>
        ))}
      </div>

      {/* Breadth bar */}
      <div className="mt-4 pt-3 hairline">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>NYSE Breadth</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(234,88,12,0.15)' }}>
            <div className="h-full rounded-full transition-all"
                 style={{ width: '59.6%', background: 'rgba(37,99,235,0.6)' }} />
          </div>
          <span className="font-mono text-xs gain">2,041 adv</span>
          <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>/</span>
          <span className="font-mono text-xs loss">1,387 dec</span>
        </div>
      </div>
    </div>
  )
}
