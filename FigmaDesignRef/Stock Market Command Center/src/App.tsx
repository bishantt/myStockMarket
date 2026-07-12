import { useState } from 'react'
import Login from './components/Login'
import Nav from './components/Nav'
import Desk from './components/Desk'
import TrackRecord from './components/TrackRecord'
import Academy from './components/Academy'

export type Page = 'desk' | 'track-record' | 'academy'

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [page, setPage] = useState<Page>('desk')

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />
  }

  return (
    <div className="relative min-h-screen">
      <div className="orb-1" />
      <div className="orb-2" />
      <div className="relative z-10">
        <Nav page={page} onNav={setPage} />
        <main className="max-w-[1440px] mx-auto px-4 md:px-8 pb-16">
          {page === 'desk' && <Desk />}
          {page === 'track-record' && <TrackRecord />}
          {page === 'academy' && <Academy />}
        </main>
      </div>
    </div>
  )
}
