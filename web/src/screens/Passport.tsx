import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type QuestTip } from '../lib/api';
import { Icon } from '../components/Icon';
import { AppMark } from '../components/Logo';
import { StampSeal } from '../components/StampSeal';
import { neighborhoods } from '../data/seed';
import { formatShortDate, neighborhoodById, nextNeighborhood, progressFor, STAMP_GOAL, totalPoints, typeCounts } from '../lib/game';
import { useGame } from '../store/game';

export function Passport() {
  const checkIns = useGame((s) => s.checkIns);
  const campusId = useGame((s) => s.campusId);
  const [toast, setToast] = useState<string | null>(null);
  const token = useGame((s) => (s.server ? s.token : undefined));
  const [tip, setTip] = useState<QuestTip | null>(null);

  // Ask the server (Gemini when configured) which neighborhood to explore next.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.questTip(token).then((r) => !cancelled && setTip(r.tip)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, checkIns.length]);

  const progress = neighborhoods.map((n) => ({ n, p: progressFor(checkIns, n.id) }));
  const stamped = progress.filter((x) => x.p.complete).length;
  const counts = typeCounts(checkIns);
  const next = (tip && neighborhoodById[tip.neighborhoodId]) || nextNeighborhood(checkIns, campusId);
  const nextPitch = tip && next && tip.neighborhoodId === next.id ? tip.pitch : next?.tagline;

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-[96px] pt-[18px]">
      <header className="flex h-11 items-center justify-between">
        <div className="flex items-center gap-2">
          <AppMark />
          <h1 className="font-display text-[22px] font-extrabold tracking-tight">Out of Bounds</h1>
        </div>
        <Link to="/me" aria-label="Open profile" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white">
          <Icon name="user" size={22} />
        </Link>
      </header>

      <section aria-label="Progress" className="flex flex-col gap-2.5 rounded-[20px] bg-navy px-[18px] py-4 text-white">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#C9D1E3]">Stamps collected</span>
          <span className="font-display text-[30px] font-extrabold leading-none">
            {stamped}
            <span className="text-lg text-[#C9D1E3]"> / {neighborhoods.length}</span>
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1" aria-hidden="true">
          {neighborhoods.map((n, i) => (
            <div key={n.id} className={`h-2 rounded ${i < stamped ? 'bg-gold' : 'bg-navy-soft'}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            [counts.eats, 'Local eats'],
            [counts.landmarks, 'Landmarks'],
            [counts.parks, 'Parks'],
          ].map(([value, label]) => (
            <div key={label} className="flex flex-col rounded-[10px] bg-white/10 px-2.5 py-1.5">
              <span className="font-display text-lg font-extrabold leading-tight">{value}</span>
              <span className="text-[11px] text-[#C9D1E3]">{label}</span>
            </div>
          ))}
        </div>
        <span className="text-xs text-[#C9D1E3]">{totalPoints(checkIns).toLocaleString()} points this semester</span>
      </section>

      {next && (
        <Link to={`/n/${next.id}`} className="flex items-center gap-3.5 rounded-[20px] border border-line bg-white px-4 py-3.5">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-2 border-dashed" style={{ borderColor: next.ink, color: next.ink }}>
            <Icon name={next.icon} size={26} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: next.ink }}>
              {tip?.ai ? 'Next up · local tip by Gemini' : 'Next up · closest new stamp'}
            </span>
            <span className="font-display text-[19px] font-bold">{next.name} quest</span>
            <span className={`text-[13px] text-muted ${tip?.ai ? 'line-clamp-2' : 'truncate'}`}>{nextPitch}</span>
          </span>
          <Icon name="arrowRight" size={22} strokeWidth={2} />
        </Link>
      )}

      <div className="mt-1 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-extrabold">Your passport</h2>
        <span className="text-[13px] text-muted">Fall 2026</span>
      </div>

      <div className="grid grid-cols-3 gap-x-2 gap-y-3">
        {progress.map(({ n, p }, i) => (
          <Link key={n.id} to={`/n/${n.id}`} className="flex flex-col items-center gap-1 text-center">
            {p.complete ? (
              <StampSeal neighborhood={n} rotate={[-9, 6, -4, 8, -6, 4, -8, 5][i % 8]} />
            ) : p.done > 0 ? (
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed" style={{ borderColor: n.ink, color: n.ink, background: n.tint }}>
                <Icon name={n.icon} size={24} />
              </span>
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-[#A9AEB8] text-[#6B7080]">
                <Icon name="lock" size={22} />
              </span>
            )}
            <span className="text-[13px] font-semibold leading-tight">{n.name}</span>
            <span className="text-[11px] leading-tight" style={{ color: p.done > 0 && !p.complete ? n.ink : '#5A6072', fontWeight: p.done > 0 && !p.complete ? 700 : 400 }}>
              {p.complete && p.completedAt ? formatShortDate(p.completedAt) : p.done > 0 ? `${p.done}/${STAMP_GOAL} done` : n.tLine.split(' · ')[0]}
            </span>
          </Link>
        ))}
        <button type="button" onClick={() => setToast('Thanks! Neighborhood suggestions open soon.')} className="flex flex-col items-center gap-1 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-paper-deep">
            <Icon name="plus" size={22} strokeWidth={2} />
          </span>
          <span className="text-[13px] font-semibold">Suggest one</span>
          <span className="text-[11px] text-muted">Locals vote</span>
        </button>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-[88px] left-1/2 z-[1500] -translate-x-1/2 whitespace-nowrap rounded-full bg-navy px-4 py-2 text-sm text-white">
          {toast}
          <button type="button" className="ml-3 font-bold text-gold" onClick={() => setToast(null)}>OK</button>
        </div>
      )}
    </div>
  );
}
