import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CampusLogo } from '../components/Logo';
import { neighborhoods } from '../data/seed';
import type { CampusId } from '../data/types';
import { allZoneStatuses, campusById, progressFor, totalPoints, zonesHeldBy } from '../lib/game';
import { useGame, useZoneCounts } from '../store/game';

export function Profile() {
  const navigate = useNavigate();
  const name = useGame((s) => s.name);
  const campusId = useGame((s) => s.campusId);
  const checkIns = useGame((s) => s.checkIns);
  const demoMode = useGame((s) => s.demoMode);
  const server = useGame((s) => s.server);
  const { setDemoMode, simulateRival, setProfile, resetTurf, reset } = useGame.getState();
  const counts = useZoneCounts();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const campus = campusById[campusId];
  const statuses = useMemo(() => allZoneStatuses(counts), [counts]);
  const stamped = neighborhoods.filter((n) => progressFor(checkIns, n.id).complete).length;
  const captured = zonesHeldBy(statuses, campusId).filter((z) => z !== campusId);
  const rivalTarget: CampusId = campusId === 'bu' ? 'neu' : 'bu';
  const demoAllowed = !server || server.allowDemo;

  async function act(label: string, fn: () => Promise<void>, done: string) {
    setBusy(label);
    setMessage(null);
    try {
      await fn();
      setMessage(done);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-[96px] pt-[22px]">
      <h1 className="font-display text-[30px] font-extrabold tracking-tight">Profile</h1>

      <section className="flex items-center gap-3.5 rounded-[20px] border border-line bg-white p-4">
        <CampusLogo src={campus.logo} alt={`${campus.name} logo`} size={56} border={campus.color} />
        <div className="flex flex-col">
          <span className="font-display text-xl font-extrabold">{name || 'Explorer'}</span>
          <span className="text-[13px] text-muted">{campus.name} · {campus.team}</span>
          <span className="mt-1 text-xs font-semibold text-navy">
            {stamped} stamps · {checkIns.length} check-ins · {totalPoints(checkIns).toLocaleString()} pts
          </span>
        </div>
      </section>

      <section className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-4">
        <span className={`h-3 w-3 shrink-0 rounded-full ${server ? 'bg-[#2E8B57]' : 'bg-[#A9AEB8]'}`} aria-hidden="true" />
        <div className="flex flex-col">
          <span className="text-sm font-bold">{server ? 'Live: shared game' : 'Offline: this device only'}</span>
          <span className="text-xs text-muted">
            {server
              ? `Database: ${server.db === 'postgres' ? 'Tiger Data / Postgres' : 'local dev database'} · Gemini photo check: ${server.gemini ? 'on' : 'off'}`
              : 'Start the API server to share turf with other players.'}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-4">
        <h2 className="font-display text-lg font-extrabold">Demo controls</h2>
        <label className="flex min-h-[44px] items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-bold">Demo mode</span>
            <span className="text-xs text-muted">
              {demoAllowed ? 'Check in anywhere without GPS. Keep this on for the stage demo.' : 'Turned off on this server: real GPS is required.'}
            </span>
          </span>
          <input type="checkbox" checked={demoMode && demoAllowed} disabled={!demoAllowed} onChange={(e) => setDemoMode(e.target.checked)} className="h-6 w-6 accent-brick" />
        </label>

        {demoAllowed && (
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => act('sim', () => simulateRival(rivalTarget, rivalTarget, 3), `${campusById[rivalTarget].short} added 3 stamps in its zone.`)}
              className="h-11 rounded-xl border-[1.5px] border-navy text-sm font-bold text-navy disabled:opacity-60"
            >
              {busy === 'sim' ? 'Simulating…' : `Simulate a ${campusById[rivalTarget].short} counter-attack (+3 stamps)`}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => act('turf', resetTurf, 'Turf reset to the starting counts.')}
              className="h-11 rounded-xl border-[1.5px] border-navy text-sm font-bold text-navy disabled:opacity-60"
            >
              {busy === 'turf' ? 'Resetting…' : 'Reset turf for everyone (demo)'}
            </button>
          </>
        )}
        {captured.length > 0 && <p className="text-xs text-muted">Your campus currently holds: {captured.map((z) => campusById[z].short).join(', ')}.</p>}

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act('progress', () => setProfile(name, campusId, true), 'Your progress was reset to the demo start.')}
          className="h-11 rounded-xl bg-navy text-sm font-bold text-white disabled:opacity-60"
        >
          {busy === 'progress' ? 'Resetting…' : 'Reset my demo progress'}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            navigate('/welcome');
          }}
          className="h-11 rounded-xl text-sm font-bold text-brick-dark"
        >
          Sign out and start over
        </button>
        {message && <p role="status" className="text-center text-xs font-semibold text-navy">{message}</p>}
      </section>
    </div>
  );
}
