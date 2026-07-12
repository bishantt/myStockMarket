import { watchlist } from '../data/mockData'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

function Sparkline({ data, up }: { data: { v: number }[]; up: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={up ? '#2563eb' : '#ea580c'}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function Watchlist() {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif font-semibold" style={{ fontSize: '1.2rem', color: '#0f0d1a' }}>
          Focus Watchlist
        </h2>
        <span className="font-mono text-xs px-2 py-0.5 rounded"
              style={{ color: '#7c7a8e', background: 'rgba(99,88,143,0.08)' }}>
          3 names · 14-day
        </span>
      </div>

      <div className="space-y-0">
        {watchlist.map((w, i) => {
          const up = w.changePct >= 0
          return (
            <div key={w.ticker}
                 className="py-3"
                 style={{ borderBottom: i < watchlist.length - 1 ? '1px solid rgba(99,88,143,0.08)' : 'none' }}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="font-mono font-semibold text-sm" style={{ color: '#0f0d1a' }}>{w.ticker}</span>
                  <span className="font-mono text-xs ml-2" style={{ color: '#7c7a8e' }}>{w.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-sm" style={{ color: '#0f0d1a', fontFeatureSettings: '"tnum" 1' }}>
                    ${w.price.toFixed(2)}
                  </div>
                  <div className="font-mono text-xs" style={{ color: up ? '#2563eb' : '#ea580c', fontFeatureSettings: '"tnum" 1' }}>
                    {up ? '+' : ''}{w.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
              <Sparkline data={w.spark} up={up} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
