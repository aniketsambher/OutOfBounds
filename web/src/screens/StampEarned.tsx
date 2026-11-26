import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { StampSeal } from '../components/StampSeal';
import { campusById, challengeBoosted, neighborhoodById, placeById, progressFor, STAMP_GOAL } from '../lib/game';
import { useGame } from '../store/game';
import { neighborhoods, weeklyChallenge } from '../data/seed';

const ratings = ['Loved it', 'It was fine', 'Not for me'];

export function StampEarned() {
  const { id = '' } = useParams();
  const checkIns = useGame((s) => s.checkIns);
  const campusId = useGame((s) => s.campusId);
  const online = useGame((s) => Boolean(s.server));
  const [rating, setRating] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  const checkIn = checkIns.find((c) => c.id === id);
  if (!checkIn) return <Navigate to="/" replace />;

  const place = placeById[checkIn.placeId];
  const n = place.neighborhoodId ? neighborhoodById[place.neighborhoodId] : undefined;
  const completed = checkIn.completedNeighborhood ? neighborhoodById[checkIn.completedNeighborhood] : undefined;
  const stampedCount = neighborhoods.filter((x) => progressFor(checkIns, x.id).complete).length;
  const progress = n ? progressFor(checkIns, n.id) : undefined;
  const zone = checkIn.zoneId ? campusById[checkIn.zoneId] : undefined;
  const me = campusById[campusId];
  /** Visitor check-in without GPS: it counts for this player only, not on the shared turf map. */
  const privateStamp = online && checkIn.verified === false;
  const date = new Date(checkIn.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

  async function share() {
    const text = completed
      ? `I just earned the ${completed.name} stamp on Out of Bounds! ${stampedCount}/${neighborhoods.length} Boston neighborhoods.`
      : `Checked in at ${place.name} on Out of Bounds.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Out of Bounds', text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
    } catch {
      /* user cancelled the share sheet */
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center gap-[18px] bg-navy px-6 pb-6 pt-7 text-white">
      <div className="flex w-full items-center justify-between">
        <span className="text-xs font-bold tracking-[0.14em] text-gold">{completed ? 'STAMP EARNED' : 'CHECKED IN'}</span>
        <Link to="/" aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
          <Icon name="close" size={20} strokeWidth={2.2} />
        </Link>
      </div>

      {completed ? (
        <div className="relative flex h-[300px] w-[300px] items-center justify-center overflow-hidden rounded-[28px] bg-paper shadow-[0_18px_40px_rgba(0,0,0,0.35)]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 27px, #E9E3D5 27px, #E9E3D5 28px)' }}>
          <div className="stamp-in">
            <StampSeal neighborhood={completed} size={196} rotate={0} caption={date} showName />
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-3 rounded-[28px] bg-paper px-5 py-7 text-navy">
          <span className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ background: n?.ink ?? me.color }}>
            <Icon name="check" size={32} strokeWidth={2.4} />
          </span>
          <span className="text-center font-display text-2xl font-extrabold leading-tight">{place.name}</span>
          {n && progress && (
            <span className="text-center text-sm text-muted">
              {progress.done} of {STAMP_GOAL} for the {n.name} stamp
            </span>
          )}
          {!n && zone && <span className="text-center text-sm text-muted">Counts toward the {zone.name} turf zone</span>}
        </div>
      )}

      <div className="flex flex-col items-center gap-1.5 text-center">
        <h1 className="font-display text-[32px] font-extrabold leading-tight">{completed ? 'Bubble popped!' : 'Nice one!'}</h1>
        <p className="text-[15px] leading-relaxed text-[#C9D1E3]">
          +{checkIn.points} points{checkIn.away ? ` (2× away game in ${zone?.short} turf)` : ''}
          {challengeBoosted(checkIn) ? ` (${weeklyChallenge.multiplier}× ${weeklyChallenge.title})` : ''}
          {checkIn.bonus ? ` · +${checkIn.bonus} mix bonus` : ''}
          {completed ? ` · ${stampedCount} of ${neighborhoods.length} neighborhoods` : ''}
        </p>
        {privateStamp && (
          <p className="text-xs leading-snug text-gold">Visitor stamp: only you can see it. It doesn't change the shared turf map.</p>
        )}
      </div>

      {checkIn.captured?.map((z) => (
        <div key={z} className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-gold bg-gold/10 px-3.5 py-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-1">
            <img src={me.logo} alt={`${me.name} logo`} className="max-h-full max-w-full object-contain" />
          </span>
          <span className="text-sm">
            <b className="block text-base text-gold">{me.team} captured {campusById[z].short}!</b>
            {privateStamp ? 'On your map, your' : 'Your'} check-in tipped the {campusById[z].name} zone.
          </span>
        </div>
      ))}

      <fieldset className="flex w-full flex-col gap-2">
        <legend className="mb-2 text-[13px] font-semibold">How was {place.name}?</legend>
        <div className="grid grid-cols-3 gap-2">
          {ratings.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={rating === r}
              onClick={() => setRating(r)}
              className={`h-11 rounded-xl text-[13px] font-semibold ${rating === r ? 'border-[1.5px] border-gold bg-gold/15 font-bold' : 'border border-[#3A4A70] text-[#E6EAF3]'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-auto flex w-full flex-col gap-2.5">
        <button type="button" onClick={share} className="flex h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-gold text-base font-extrabold text-navy">
          <Icon name="share" size={20} strokeWidth={2} />
          {shared ? 'Shared!' : completed ? 'Share my stamp' : 'Share check-in'}
        </button>
        {n && !completed && progress && !progress.complete ? (
          <Link to={`/n/${n.id}`} className="flex h-[50px] items-center justify-center rounded-2xl border-[1.5px] border-[#3A4A70] text-[15px] font-bold">
            Back to {n.name}
          </Link>
        ) : (
          <Link to={zone && !n ? '/turf' : '/'} className="flex h-[50px] items-center justify-center rounded-2xl border-[1.5px] border-[#3A4A70] text-[15px] font-bold">
            {zone && !n ? 'Back to turf map' : 'Back to passport'}
          </Link>
        )}
      </div>
    </div>
  );
}
