import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CampusLogo } from '../components/Logo';
import { neighborhoods } from '../data/seed';
import { allZoneStatuses, campusById, progressFor, rivalMove, totalPoints, zonesHeldBy } from '../lib/game';
import { canSkipGps, useGame, useZoneCounts } from '../store/game';

export function Profile() {
  const navigate = useNavigate();
  const name = useGame((s) => s.name);
  const campusId = useGame((s) => s.campusId);
  const checkIns = useGame((s) => s.checkIns);
  const demoMode = useGame((s) => s.demoMode);
  const server = useGame((s) => s.server);
  const isTeam = useGame((s) => s.isTeam);
  const serverCounts = useGame((s) => s.serverCounts);
  const { setDemoMode, simulateRival, resetProgress, resetTurf, signOut, joinTeam } = useGame.getState();
  const counts = useZoneCounts();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [teamKey, setTeamKey] = useState('');
  const [teamError, setTeamError] = useState<string | null>(null);

  const campus = campusById[campusId];
  const statuses = useMemo(() => allZoneStatuses(counts), [counts]);
  const stamped = neighborhoods.filter((n) => progressFor(checkIns, n.id).complete).length;
  const captured = zonesHeldBy(statuses, campusId).filter((z) => z !== campusId);
  // Same counts the store plans the move on, so the button label matches what happens.
  const move = useMemo(() => {
    const base = server && isTeam && serverCounts ? serverCounts : counts;
    return rivalMove(base, campusId);
  }, [server, isTeam, serverCounts, counts, campusId]);
  const gpsOptional = canSkipGps({ server, isTeam });
  /** Team account on the live server: the demo controls change the game for everyone. */
  const shared = Boolean(server) && isTeam;
  const visitor = Boolean(server) && !isTeam;

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

  async function unlockTeam(e: FormEvent) {
    e.preventDefault();
    setBusy('team');
    setTeamError(null);
    try {
      await joinTeam(teamKey.trim());
      setTeamKey('');
      setMessage('Team access is on. Demo controls now change the shared game.');
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  }

  async function startOver() {
    if (!window.confirm('This deletes your stamps and points so you can start over. Continue?')) return;
    setBusy('signout');
    await signOut();
    navigate('/welcome');
  }

  const attacker = move ? campusById[move.attacker] : undefined;
  const target = move ? campusById[move.zoneId] : undefined;
  const moveLabel =
    move && attacker && target
      ? move.attacker === move.zoneId
        ? `Simulate ${attacker.short} retaking its zone (+${move.amount})`
        : `Simulate ${attacker.short} attacking ${target.short} (+${move.amount})`
      : 'Simulate a rival attack (your campus holds no zones)';
  const moveDone =
    move && attacker && target
      ? `${attacker.short} added ${move.amount} stamp${move.amount === 1 ? '' : 's'} in the ${target.short} zone${shared ? '.' : ', only on your map.'}`
      : '';

  const modeText = !gpsOptional
    ? 'Turned off on this server: real GPS is required.'
    : !server
      ? 'Check in anywhere without GPS. Everything stays on this device.'
      : isTeam
        ? 'Check in anywhere without GPS. Team check-ins count on the shared turf map.'
        : "Check in from anywhere. Those stamps show only for you and don't change the shared turf map.";

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
          <span className="text-sm font-bold">
            {server ? `Live: shared game · ${isTeam ? 'Team account' : 'Visitor'}` : 'Offline: this device only'}
          </span>
          <span className="text-xs text-muted">
            {server
              ? `Database: ${server.db === 'postgres' ? 'Tiger Data / Postgres' : 'local dev database'} · Gemini photo check: ${server.gemini ? 'on' : 'off'}`
              : 'Your progress is saved on this phone and joins the shared game when the server is back.'}
          </span>
        </div>
      </section>

      {server?.teamAccess && !isTeam && (
        <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-white p-4">
          <h2 className="font-display text-lg font-extrabold">Team access</h2>
          <p className="text-xs text-muted">For the Out of Bounds team: enter the team password once on this phone to run the shared demo.</p>
          <form onSubmit={unlockTeam} className="flex gap-2">
            <input
              type="password"
              value={teamKey}
              onChange={(e) => setTeamKey(e.target.value)}
              placeholder="Team password"
              aria-label="Team password"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy"
            />
            <button
              type="submit"
              disabled={busy !== null || !teamKey.trim()}
              className="h-11 shrink-0 rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy === 'team' ? 'Checking…' : 'Unlock'}
            </button>
          </form>
          {teamError && <p role="alert" className="text-xs font-semibold text-brick-dark">{teamError}</p>}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-lg font-extrabold">Demo controls</h2>
          {visitor && <p className="text-xs text-muted">These only change what you see. Other players aren't affected.</p>}
          {shared && <p className="text-xs font-semibold text-brick-dark">Team account: these change the game for everyone.</p>}
        </div>
        <label className="flex min-h-[44px] items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-bold">{visitor ? 'Visitor mode' : 'Demo mode'}</span>
            <span className="text-xs text-muted">{modeText}</span>
          </span>
          <input
            type="checkbox"
            checked={demoMode && gpsOptional}
            disabled={!gpsOptional}
            onChange={(e) => setDemoMode(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-brick"
          />
        </label>

        <button
          type="button"
          disabled={busy !== null || !move}
          onClick={() => act('sim', simulateRival, moveDone)}
          className="h-11 rounded-xl border-[1.5px] border-navy px-2 text-sm font-bold text-navy disabled:opacity-60"
        >
          {busy === 'sim' ? 'Simulating…' : moveLabel}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            act(
              'turf',
              resetTurf,
              shared ? 'Turf reset to the starting counts for everyone.' : server ? 'Your turf view matches the shared map again.' : 'Turf reset to the starting counts.',
            )
          }
          className="h-11 rounded-xl border-[1.5px] border-navy text-sm font-bold text-navy disabled:opacity-60"
        >
          {busy === 'turf' ? 'Resetting…' : shared ? 'Reset turf for everyone (team)' : server ? 'Reset my turf view' : 'Reset turf'}
        </button>
        {captured.length > 0 && <p className="text-xs text-muted">Your campus currently holds: {captured.map((z) => campusById[z].short).join(', ')}.</p>}

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act('progress', resetProgress, 'Your progress was reset to the demo start.')}
          className="h-11 rounded-xl bg-navy text-sm font-bold text-white disabled:opacity-60"
        >
          {busy === 'progress' ? 'Resetting…' : 'Reset my demo progress'}
        </button>
        <button type="button" disabled={busy !== null} onClick={startOver} className="h-11 rounded-xl text-sm font-bold text-brick-dark disabled:opacity-60">
          {busy === 'signout' ? 'Signing out…' : 'Sign out and start over'}
        </button>
        {message && <p role="status" className="text-center text-xs font-semibold text-navy">{message}</p>}
      </section>
    </div>
  );
}
