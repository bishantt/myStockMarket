import { useState } from 'react'
import { trackRecord } from '../data/mockData'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine
} from 'recharts'

type Filter = 'all' | 'hit' | 'miss' | 'strong' | 'moderate' | 'weak'

export default function TrackRecord() {
  const [filter, setFilter] = useState<Filter>('all')

  const { stats, byTier, calls } = trackRecord

  const filtered = calls.filter(c => {
    if (filter === 'hit') return c.outcome === 'hit'
    if (filter === 'miss') return c.outcome === 'miss'
    if (filter === 'strong' || filter === 'moderate' || filter === 'weak') return c.tier === filter
    return true
  })

  const scatterData = calls.map(c => ({
    x: c.baseRatePct,
    y: c.fwdReturn,
    outcome: c.outcome,
    ticker: c.ticker,
  }))

  return (
    <div className="pt-6">
      <div className="mb-6">
        <p className="font-mono text-xs tracking-widest uppercase mb-1" style={{ color: '#6366f1' }}>
          Self-Graded · Append-Only
        </p>
        <h1 className="font-serif font-bold" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: '#0f0d1a' }}>
          Track Record
        </h1>
        <p className="text-sm mt-1" style={{ color: '#7c7a8e', fontFamily: 'Inter, sans-serif' }}>
          Every call logged, including the misses. No cherry-picking.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {[
          { label: 'Total calls', value: stats.totalCalls, mono: true },
          { label: 'Hit rate (all tiers)', value: `${stats.hitRate}%`, mono: true },
          { label: 'Avg days to resolve', value: `${stats.avgDays}d`, mono: true },
          { label: 'Hits / Misses', value: `${stats.hits} / ${stats.resolved - stats.hits}`, mono: true },
        ].map(s => (
          <div key={s.label} className="glass-raised rounded-xl p-4 text-center">
            <div className="font-mono font-bold mb-1" style={{ fontSize: '1.5rem', color: '#0f0d1a', fontFeatureSettings: '"tnum" 1' }}>
              {s.value}
            </div>
            <div className="font-mono text-[10px] tracking-widest uppercase" style={{ color: '#7c7a8e' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* By tier */}
      <div className="glass rounded-2xl p-5 mb-6">
        <h2 className="font-serif font-semibold mb-4" style={{ fontSize: '1.1rem', color: '#0f0d1a' }}>Calibration by Tier</h2>
        <div className="space-y-3">
          {byTier.map(t => {
            const color = t.tier === 'strong' ? '#059669' : t.tier === 'moderate' ? '#d97706' : '#7c7a8e'
            return (
              <div key={t.tier} className="flex items-center gap-4">
                <div className="w-20 font-mono text-xs" style={{ color }}>{t.tier}</div>
                <div className="flex-1 h-5 rounded overflow-hidden relative" style={{ background: 'rgba(99,88,143,0.08)' }}>
                  <div className="h-full rounded transition-all"
                       style={{ width: `${t.hitRate}%`, background: `${color}40`, position: 'relative' }}>
                    <div className="h-full rounded" style={{ width: `${t.hitRate}%`, background: color, opacity: 0.5 }} />
                  </div>
                </div>
                <div className="font-mono text-xs w-16 text-right" style={{ color: '#0f0d1a', fontFeatureSettings: '"tnum" 1' }}>
                  {t.hitRate.toFixed(1)}%
                </div>
                <div className="font-mono text-xs w-14 text-right" style={{ color: '#7c7a8e', fontFeatureSettings: '"tnum" 1' }}>
                  n={t.calls}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Calibration scatter */}
      <div className="glass rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-serif font-semibold" style={{ fontSize: '1.1rem', color: '#0f0d1a' }}>
            Base Rate vs. Actual Return
          </h2>
        </div>
        <p className="text-xs mb-4" style={{ color: '#7c7a8e', fontFamily: 'Inter, sans-serif' }}>
          If base rates were perfectly calibrated, hits would cluster top-right and misses bottom-left. Reality is messier.
        </p>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: -10 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(99,88,143,0.1)" />
              <XAxis dataKey="x" name="Base rate %" type="number" domain={[40, 80]}
                     tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#7c7a8e' }}
                     label={{ value: 'Stated base rate (%)', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#7c7a8e', fontFamily: 'Inter' }} />
              <YAxis dataKey="y" name="Actual return %" type="number"
                     tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#7c7a8e' }}
                     label={{ value: 'Actual fwd return (%)', angle: -90, position: 'insideLeft', offset: 8, fontSize: 10, fill: '#7c7a8e', fontFamily: 'Inter' }} />
              <ReferenceLine y={0} stroke="rgba(99,88,143,0.3)" strokeDasharray="3 3" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div style={{ background: 'white', border: '1px solid rgba(99,88,143,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                      <div style={{ color: '#0f0d1a', fontWeight: 600 }}>{d.ticker}</div>
                      <div style={{ color: '#7c7a8e' }}>Base: {d.x}% · Return: {d.y > 0 ? '+' : ''}{d.y}%</div>
                    </div>
                  )
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((d, i) => (
                  <Cell key={i} fill={d.outcome === 'hit' ? 'rgba(37,99,235,0.7)' : 'rgba(234,88,12,0.7)'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2">
          {[{ color: 'rgba(37,99,235,0.7)', label: 'Hits' }, { color: 'rgba(234,88,12,0.7)', label: 'Misses' }].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
              <span className="font-mono text-[10px]" style={{ color: '#7c7a8e' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Call log */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-serif font-semibold" style={{ fontSize: '1.1rem', color: '#0f0d1a' }}>Call Log</h2>
          <div className="flex flex-wrap gap-1">
            {(['all', 'hit', 'miss', 'strong', 'moderate', 'weak'] as Filter[]).map(f => (
              <button key={f}
                      onClick={() => setFilter(f)}
                      className="px-2.5 py-0.5 rounded text-xs transition-fast"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: filter === f ? 600 : 400,
                        color: filter === f ? '#4f46e5' : '#7c7a8e',
                        background: filter === f ? 'rgba(99,102,241,0.1)' : 'transparent',
                        border: filter === f ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                        cursor: 'pointer',
                      }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div className="grid py-1.5"
             style={{ gridTemplateColumns: '60px 50px 1fr 80px 70px 60px', borderBottom: '1px solid rgba(99,88,143,0.15)', gap: '0.5rem' }}>
          {['Date', 'Ticker', 'Pattern', 'Tier', 'Return', 'Result'].map(h => (
            <span key={h} className="font-mono text-[10px] tracking-widest uppercase" style={{ color: '#7c7a8e' }}>
              {h}
            </span>
          ))}
        </div>

        <div>
          {filtered.map((c, i) => (
            <div key={i} className="grid py-3 items-center"
                 style={{
                   gridTemplateColumns: '60px 50px 1fr 80px 70px 60px',
                   gap: '0.5rem',
                   borderBottom: i < filtered.length - 1 ? '1px solid rgba(99,88,143,0.07)' : 'none',
                 }}>
              <span className="font-mono text-xs" style={{ color: '#7c7a8e', fontFeatureSettings: '"tnum" 1' }}>{c.date}</span>
              <span className="font-mono text-xs font-semibold" style={{ color: '#0f0d1a' }}>{c.ticker}</span>
              <span className="text-xs" style={{ color: '#3d3a4f', fontFamily: 'Inter, sans-serif' }}>{c.pattern}</span>
              <span className="font-mono text-xs"
                    style={{ color: c.tier === 'strong' ? '#059669' : c.tier === 'moderate' ? '#d97706' : '#7c7a8e' }}>
                {c.tier}
              </span>
              <span className="font-mono text-xs text-right"
                    style={{ color: c.fwdReturn >= 0 ? '#2563eb' : '#ea580c', fontFeatureSettings: '"tnum" 1' }}>
                {c.fwdReturn > 0 ? '+' : ''}{c.fwdReturn.toFixed(1)}%
              </span>
              <span className="font-mono text-xs font-semibold"
                    style={{ color: c.outcome === 'hit' ? '#2563eb' : '#ea580c' }}>
                {c.outcome}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
