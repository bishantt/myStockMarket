import MarketPulse from './MarketPulse'
import DailyBrief from './DailyBrief'
import SessionCalendar from './SessionCalendar'
import Movers from './Movers'
import Watchlist from './Watchlist'
import SetupCards from './SetupCards'

export default function Desk() {
  return (
    <div className="pt-6">
      {/* Desk header */}
      <div className="mb-6">
        <p className="font-mono text-xs tracking-widest uppercase mb-1" style={{ color: '#6366f1' }}>
          The Desk — Morning Edition
        </p>
        <h1 className="font-serif font-bold leading-none" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#0f0d1a' }}>
          Friday, July 11, 2026
        </h1>
        <p className="text-sm mt-1" style={{ color: '#7c7a8e', fontFamily: 'Inter, sans-serif' }}>
          US markets open in <strong style={{ color: '#0f0d1a' }}>2h 14m</strong> · Pre-market flat · CPI next Tuesday
        </p>
      </div>

      {/* Market pulse — full width */}
      <MarketPulse />

      {/* Main 2-col layout */}
      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'minmax(0,1fr) 340px' }}
           className="desk-grid">
        {/* Left column */}
        <div className="space-y-6 min-w-0">
          <DailyBrief />
          <Movers />
          <SetupCards />
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <Watchlist />
          <SessionCalendar />
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .desk-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
