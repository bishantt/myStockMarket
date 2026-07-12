import { useState } from 'react'

interface Props {
  onLogin: () => void
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onLogin()
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      <div className="orb-1" />
      <div className="orb-2" />

      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative p-16"
           style={{ background: 'linear-gradient(150deg, #312e81 0%, #4f46e5 60%, #7c3aed 100%)' }}>
        <div>
          <div className="flex items-center gap-2.5 mb-20">
            <div className="w-8 h-8 rounded-sm bg-white/20 flex items-center justify-center">
              <span className="font-mono text-white text-sm font-bold">M</span>
            </div>
            <span className="font-mono text-white/70 text-sm tracking-widest uppercase">Market Desk</span>
          </div>

          <div className="max-w-md">
            <p className="font-mono text-indigo-300 text-xs tracking-widest uppercase mb-6">Morning Briefing / US Equities</p>
            <h1 className="font-serif text-white leading-[1.1] mb-8" style={{ fontSize: 'clamp(2.4rem, 4vw, 3.6rem)' }}>
              Your personal<br />
              <em>broadsheet</em><br />
              for the market.
            </h1>
            <p className="text-indigo-200 text-base leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Not a prediction oracle. Not a signal feed. A daily ritual that shows you what happened, why it might matter, and what the base rates actually say — including the misses.
            </p>
          </div>
        </div>

        {/* Quote */}
        <div className="border-l-2 border-white/20 pl-6 max-w-xs">
          <p className="text-indigo-100 text-sm italic leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
            "An investor who has all the answers doesn't even understand the questions."
          </p>
          <p className="font-mono text-indigo-400 text-xs mt-3 tracking-wide">— Sir John Templeton</p>
        </div>

        {/* Decorative grid lines */}
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-8 h-8 rounded-sm bg-indigo-600 flex items-center justify-center">
              <span className="font-mono text-white text-sm font-bold">M</span>
            </div>
            <span className="font-mono text-indigo-600 text-sm tracking-widest uppercase">Market Desk</span>
          </div>

          <p className="font-mono text-indigo-500 text-xs tracking-widest uppercase mb-2">Good morning</p>
          <h2 className="font-serif mb-1" style={{ fontSize: '2rem', color: '#0f0d1a', lineHeight: 1.2 }}>
            Sign in
          </h2>
          <p className="text-sm mb-10" style={{ color: '#7c7a8e', fontFamily: 'Inter, sans-serif' }}>
            Your desk is ready. Markets open in 2h 14m.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase mb-2" style={{ color: '#7c7a8e' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 text-sm outline-none transition-fast"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(99,88,143,0.2)',
                  borderRadius: 10,
                  color: '#0f0d1a',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(99,88,143,0.2)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase mb-2" style={{ color: '#7c7a8e' }}>
                Password
              </label>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 text-sm outline-none transition-fast"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(99,88,143,0.2)',
                  borderRadius: 10,
                  color: '#0f0d1a',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(99,88,143,0.2)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#7c7a8e', fontFamily: 'Inter, sans-serif' }}>
                <input type="checkbox" className="accent-indigo-600 w-3.5 h-3.5" />
                Remember me
              </label>
              <button type="button" className="text-sm transition-fast hover:text-indigo-600" style={{ color: '#7c7a8e', fontFamily: 'Inter, sans-serif' }}>
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 text-sm font-medium tracking-wide mt-2 transition-fast hover:opacity-90 active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white',
                borderRadius: 10,
                fontFamily: 'Inter, sans-serif',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Open my desk →
            </button>
          </form>

          <p className="text-center text-xs mt-8" style={{ color: '#7c7a8e', fontFamily: 'Inter, sans-serif' }}>
            This is a personal tool. No buy/sell signals, no financial advice.
          </p>
        </div>
      </div>
    </div>
  )
}
