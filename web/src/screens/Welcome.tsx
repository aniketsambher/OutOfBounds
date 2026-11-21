import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppMark } from '../components/Logo';
import { campuses } from '../data/seed';
import type { CampusId } from '../data/types';
import { useGame } from '../store/game';

export function Welcome() {
  const navigate = useNavigate();
  const setProfile = useGame((s) => s.setProfile);
  const [name, setName] = useState('');
  const [campusId, setCampusId] = useState<CampusId>('neu');
  const [withDemo, setWithDemo] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await setProfile(name, campusId, withDemo);
    navigate('/', { replace: true });
  }

  return (
    <form onSubmit={submit} className="flex min-h-[100dvh] flex-col gap-5 px-6 pb-8 pt-10">
      <div className="flex flex-col gap-3">
        <AppMark size={56} />
        <h1 className="font-display text-[40px] font-extrabold leading-none tracking-tight">Out of Bounds</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Pop your campus bubble. Collect stamps at local eats, landmarks and parks across Boston, and help your campus capture turf.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name"
          autoComplete="given-name"
          className="h-12 rounded-xl border border-line bg-white px-3.5 text-base outline-none focus:border-navy"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Your campus</legend>
        <div className="grid grid-cols-3 gap-2">
          {campuses.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={campusId === c.id}
              onClick={() => setCampusId(c.id)}
              className="flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-2"
              style={{ border: campusId === c.id ? `2.5px solid ${c.color}` : '1px solid #E4DFD3' }}
            >
              <img src={c.logo} alt="" className="h-9 max-w-full object-contain" />
              <span className="text-xs font-bold">{c.short}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-[44px] items-center gap-3">
        <input type="checkbox" checked={withDemo} onChange={(e) => setWithDemo(e.target.checked)} className="h-5 w-5 accent-brick" />
        <span className="text-sm">Start with demo progress (3 stamps already collected)</span>
      </label>

      <button type="submit" disabled={busy} className="mt-auto h-14 rounded-2xl bg-brick text-base font-extrabold text-white disabled:opacity-60">
        {busy ? 'Setting up…' : 'Start exploring'}
      </button>
    </form>
  );
}
