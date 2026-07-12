import { useState } from 'react'
import { academyLessons } from '../data/mockData'
import { BookOpen, Clock, ChevronLeft } from 'lucide-react'

const catColor: Record<string, string> = {
  'Foundations': '#6366f1',
  'Market Structure': '#d97706',
  'Patterns': '#059669',
}

export default function Academy() {
  const [selected, setSelected] = useState<string | null>(null)

  const lesson = selected ? academyLessons.find(l => l.id === selected) : null

  if (lesson) {
    return (
      <div className="pt-6 max-w-2xl mx-auto">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 mb-8 text-sm transition-fast hover:opacity-70"
          style={{ color: '#6366f1', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ChevronLeft size={16} />
          Back to Academy
        </button>

        <div className="mb-2">
          <span className="font-mono text-xs tracking-widest uppercase px-2 py-0.5 rounded"
                style={{ color: catColor[lesson.category] || '#7c7a8e', background: `${catColor[lesson.category]}14` || 'rgba(99,88,143,0.08)' }}>
            {lesson.category}
          </span>
        </div>

        <h1 className="font-serif font-bold leading-tight mb-3"
            style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: '#0f0d1a' }}>
          {lesson.title}
        </h1>

        <div className="flex items-center gap-3 mb-10 pb-6" style={{ borderBottom: '1px solid rgba(99,88,143,0.15)' }}>
          <Clock size={13} style={{ color: '#7c7a8e' }} />
          <span className="font-mono text-xs" style={{ color: '#7c7a8e' }}>{lesson.readTime} min read</span>
        </div>

        <div className="prose-content space-y-0">
          {lesson.body.split('\n\n').map((para, i) => {
            if (para.startsWith('**') && para.endsWith('**')) {
              return (
                <h3 key={i} className="font-serif font-semibold mt-8 mb-3"
                    style={{ fontSize: '1.15rem', color: '#0f0d1a' }}>
                  {para.replace(/\*\*/g, '')}
                </h3>
              )
            }
            const rendered = para
              .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
              .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            return (
              <p key={i} className="mb-5 leading-[1.8]"
                 style={{ fontSize: '1rem', color: '#3d3a4f', fontFamily: 'Inter, sans-serif' }}
                 dangerouslySetInnerHTML={{ __html: rendered }} />
            )
          })}
        </div>

        <div className="mt-12 pt-6" style={{ borderTop: '1px solid rgba(99,88,143,0.15)' }}>
          <p className="text-xs italic" style={{ color: '#aaa9b8', fontFamily: 'Inter, sans-serif' }}>
            Academy content is for education only. It describes how markets and analysis tools work — not what to do with your money.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-6">
      <div className="mb-8">
        <p className="font-mono text-xs tracking-widest uppercase mb-1" style={{ color: '#6366f1' }}>
          Learn
        </p>
        <h1 className="font-serif font-bold" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: '#0f0d1a' }}>
          Academy
        </h1>
        <p className="text-sm mt-1 max-w-xl" style={{ color: '#7c7a8e', fontFamily: 'Inter, sans-serif' }}>
          Prose-first explanations of market concepts, analysis tools, and the reasoning behind what you see on the desk. Written for beginners, useful for everyone.
        </p>
      </div>

      {/* Category groups */}
      {['Foundations', 'Market Structure', 'Patterns'].map(cat => {
        const lessons = academyLessons.filter(l => l.category === cat)
        if (!lessons.length) return null
        const cc = catColor[cat] || '#7c7a8e'
        return (
          <div key={cat} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1 h-5 rounded-full" style={{ background: cc }} />
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: cc }}>{cat}</span>
            </div>

            <div className="space-y-0 glass rounded-2xl overflow-hidden">
              {lessons.map((lesson, i) => (
                <button
                  key={lesson.id}
                  onClick={() => setSelected(lesson.id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4 transition-fast"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: i < lessons.length - 1 ? '1px solid rgba(99,88,143,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.04)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <BookOpen size={16} style={{ color: cc, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium mb-0.5" style={{ color: '#0f0d1a', fontFamily: 'Inter, sans-serif' }}>
                      {lesson.title}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={11} style={{ color: '#aaa9b8' }} />
                      <span className="font-mono text-xs" style={{ color: '#aaa9b8' }}>{lesson.readTime} min read</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs" style={{ color: '#6366f1', flexShrink: 0 }}>Read →</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <div className="glass rounded-2xl p-6 text-center mt-6"
           style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)' }}>
        <p className="font-serif italic" style={{ fontSize: '1.05rem', color: '#3d3a4f', lineHeight: 1.7 }}>
          "The first step to understanding markets is understanding that no one fully understands markets."
        </p>
        <p className="font-mono text-xs mt-3" style={{ color: '#aaa9b8' }}>— A useful reminder before every trading session</p>
      </div>
    </div>
  )
}
