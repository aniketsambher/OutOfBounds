import { useMemo } from 'react';
import { CampusLogo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { bubbleCupAverages, campuses, weeklyChallenge } from '../data/seed';
import { allZoneStatuses, campusById, neighborhoodById, zonesHeldBy } from '../lib/game';
import { useGame, useZoneCounts } from '../store/game';

const medal = ['#F2C14E', '#D9DDE6', '#EBD1B5'];

export function BubbleCup() {
  const campusId = useGame((s) => s.campusId);
  const counts = useZoneCounts();
  const statuses = useMemo(() => allZoneStatuses(counts), [counts]);

  const ranked = [...campuses].sort((a, b) => bubbleCupAverages[b.id] - bubbleCupAverages[a.id]);
  const best = bubbleCupAverages[ranked[0].id];

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-[96px] pt-[22px]">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-display text-[30px] font-extrabold tracking-tight">Bubble Cup</h1>
        <p className="text-[13px] text-muted">Which campus gets out the most? Avg. neighborhoods stamped per student, Fall 2026 (sample numbers). Flags show turf zones held this week.</p>
      </div>

      <section aria-label="Weekly challenge" className="flex items-center gap-3.5 rounded-[18px] bg-brick px-4 py-3.5 text-white">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Icon name="dumpling" size={26} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold tracking-[0.1em] text-[#FFE1D9]">THIS WEEK'S CHALLENGE</span>
          <span className="font-display text-lg font-bold">{weeklyChallenge.title}</span>
          <span className="text-xs text-[#FFE9E3]">
            {weeklyChallenge.multiplier === 2 ? 'Double' : `${weeklyChallenge.multiplier}×`} points in{' '}
            {neighborhoodById[weeklyChallenge.neighborhoodId].name} · ends Sunday midnight
          </span>
        </div>
      </section>

      <ol className="flex flex-col gap-1.5">
        {ranked.map((c, i) => {
          const held = zonesHeldBy(statuses, c.id);
          const mine = c.id === campusId;
          const homeLostTo = statuses[c.id].captured ? campusById[statuses[c.id].owner] : undefined;
          const zoneText =
            `${held.length} zone${held.length === 1 ? '' : 's'}` +
            (held.length
              ? ` · ${held.map((z) => (z === c.id ? 'home' : `${campusById[z].short} (captured)`)).join(' + ')}`
              : homeLostTo
                ? ` · home lost to the ${homeLostTo.team}`
                : statuses[c.id].contested
                  ? ' · home contested'
                  : '');
          return (
            <li key={c.id} className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 ${mine ? 'border-[1.5px] border-brick bg-brick-tint' : 'border border-line bg-white'}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold" style={{ background: medal[i] ?? '#EFEADF' }}>
                {i + 1}
              </span>
              <CampusLogo src={c.logo} alt={`${c.name} logo`} size={42} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm font-bold">
                  {c.name}
                  {mine && <span className="ml-1.5 text-[11px] font-bold text-brick-dark">YOUR CAMPUS</span>}
                </span>
                <div className="h-1.5 rounded bg-[#EFEADF]">
                  <div className="h-1.5 rounded" style={{ width: `${(bubbleCupAverages[c.id] / best) * 100}%`, background: mine ? '#B7412E' : '#14213D' }} />
                </div>
                <span className={`flex items-center gap-1 text-[11px] ${mine ? 'font-bold text-brick-dark' : 'font-semibold text-[#4A5064]'}`}>
                  <Icon name="flag" size={12} strokeWidth={2.2} />
                  {zoneText}
                </span>
              </div>
              <span className="w-9 text-right font-display text-lg font-extrabold">{bubbleCupAverages[c.id].toFixed(1)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
