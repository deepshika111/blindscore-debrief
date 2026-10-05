import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
          <span className="font-display text-lg tracking-tight">BlindScore</span>
          <Link
            to="/dashboard"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Open a room
          </Link>
        </header>
        <main className="mx-auto grid w-full max-w-5xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Hiring debriefs</p>
            <h1 className="font-display mt-4 max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Scores stay sealed until everyone has spoken.
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground">
              The first interviewer to post a number anchors the rest of the panel. BlindScore keeps each scorecard private until the room reveals them together.
            </p>
          </div>
          <ol className="space-y-4 border-t border-border pt-6 text-sm">
            <li>
              <span className="font-display text-2xl text-primary">01</span>
              <p className="mt-1 text-foreground">Set the panel size and share one invite link.</p>
            </li>
            <li>
              <span className="font-display text-2xl text-primary">02</span>
              <p className="mt-1 text-foreground">Each person seals one scorecard. Peers only see that it landed.</p>
            </li>
            <li>
              <span className="font-display text-2xl text-primary">03</span>
              <p className="mt-1 text-foreground">When the panel is full — or the hiring manager forces it — every score opens together.</p>
            </li>
          </ol>
        </main>
      </div>
    </>
  )
}
