import { useState } from 'react'
import { dailyBrief } from '../data/mockData'

export default function DailyBrief() {
  const [tab, setTab] = useState<'am' | 'pm'>('am')
  const brief = dailyBrief[tab]

  return (
    <div className="glass rounded-2xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif font-semibold" style={{ fontSize: '1.2rem', color: '#0f0d1a' }}>
          Daily Brief
        </h2>
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(99,88,143,0.08)' }}>
          {(['am', 'pm'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1 text-xs font-medium rounded-md transition-fast"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                background: tab === t ? 'white' : 'transparent',
                color: tab === t ? '#4f46e5' : '#7c7a8e',
                border: 'none',
                cursor: 'pointer',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t === 'am' ? 'AM Plan' : 'PM Scorecard'}
            </button>
          ))}
        </div>
      </div>

      <p className="font-mono text-xs tracking-wide mb-4" style={{ color: '#7c7a8e' }}>{brief.label}</p>

      <div className="space-y-0">
        {brief.items.map((item, i) => (
          <div key={i} className="py-3.5" style={{ borderBottom: i < brief.items.length - 1 ? '1px solid rgba(99,88,143,0.1)' : 'none' }}>
            <div className="font-mono text-xs tracking-widest uppercase mb-1.5" style={{ color: '#6366f1' }}>
              {item.heading}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#3d3a4f', fontFamily: 'Inter, sans-serif' }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
