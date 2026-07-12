import { calendarEvents } from '../data/mockData'

const typeColor: Record<string, string> = {
  macro: '#6366f1',
  earnings: '#d97706',
  fomc: '#dc2626',
  options: '#7c3aed',
}

const typeLabel: Record<string, string> = {
  macro: 'MACRO',
  earnings: 'EARNINGS',
  fomc: 'FOMC',
  options: 'OPTIONS',
}

export default function SessionCalendar() {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif font-semibold" style={{ fontSize: '1.2rem', color: '#0f0d1a' }}>
          Session Calendar
        </h2>
        <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>
          Next 21 days
        </span>
      </div>

      <div className="space-y-0">
        {calendarEvents.map((ev, i) => (
          <div key={i}
               className="py-3 flex items-start gap-4"
               style={{ borderBottom: i < calendarEvents.length - 1 ? '1px solid rgba(99,88,143,0.08)' : 'none' }}>
            {/* Date */}
            <div className="flex-shrink-0 w-20">
              <span className="font-mono text-xs" style={{ color: '#7c7a8e', fontFeatureSettings: '"tnum" 1' }}>{ev.date}</span>
              <br />
              <span className="font-mono text-xs" style={{ color: '#aaa9b8', fontFeatureSettings: '"tnum" 1' }}>{ev.time}</span>
            </div>

            {/* Type badge */}
            <div className="flex-shrink-0 mt-0.5">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      color: typeColor[ev.type],
                      background: `${typeColor[ev.type]}14`,
                      letterSpacing: '0.06em',
                    }}>
                {typeLabel[ev.type]}
              </span>
            </div>

            {/* Event detail */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium" style={{ color: '#0f0d1a', fontFamily: 'Inter, sans-serif' }}>
                  {ev.label}
                  {ev.importance === 'high' && (
                    <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full align-middle" style={{ background: '#ea580c', marginBottom: 1 }} />
                  )}
                </span>
              </div>
              {ev.consensus && (
                <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                  <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>
                    Est: <span style={{ color: '#3d3a4f' }}>{ev.consensus}</span>
                  </span>
                  {ev.prior && (
                    <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>
                      Prior: <span style={{ color: '#3d3a4f' }}>{ev.prior}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
