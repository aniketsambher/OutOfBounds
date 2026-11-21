import 'leaflet/dist/leaflet.css';
import { Fragment, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer } from 'react-leaflet';
import { Icon } from '../components/Icon';
import { CampusLogo } from '../components/Logo';
import { campuses, places } from '../data/seed';
import type { CampusId } from '../data/types';
import { useCheckIn } from '../hooks/useCheckIn';
import { allZoneStatuses, campusById, zoneForPos } from '../lib/game';
import { zoneIcon } from '../lib/markers';
import { useGame, useZoneCounts } from '../store/game';

export function TurfMap() {
  const checkIns = useGame((s) => s.checkIns);
  const campusId = useGame((s) => s.campusId);
  const counts = useZoneCounts();
  const [selected, setSelected] = useState<CampusId>(campusId === 'bu' ? 'neu' : 'bu');
  const { run, busyId, error } = useCheckIn();

  const statuses = useMemo(() => allZoneStatuses(counts), [counts]);
  const stampedIds = useMemo(() => new Set(checkIns.map((c) => c.placeId)), [checkIns]);

  const zone = campusById[selected];
  const status = statuses[selected];
  const owner = campusById[status.owner];
  const myStamps = checkIns.filter((c) => c.zoneId === selected).length;
  const isHome = selected === campusId;
  const posts = places.filter((p) => !p.neighborhoodId && zoneForPos(p.pos) === selected);
  const top = status.ranking.slice(0, 3);
  const max = Math.max(...top.map((r) => r.count), 1);

  const tagFor = (z: CampusId) => {
    const s = statuses[z];
    if (s.captured) return { tag: `${campusById[s.owner].team.toUpperCase()} HOLD`, bg: campusById[s.owner].color };
    if (s.contested) return { tag: 'CONTESTED', bg: '#14213D' };
    if (z === campusId) return { tag: 'HOME · 1×', bg: campusById[z].color };
    return { tag: campusById[z].short.toUpperCase(), bg: campusById[z].color };
  };

  return (
    <div className="flex h-[calc(100dvh-76px)] flex-col">
      <div className="flex flex-col gap-2 bg-paper px-4 pb-2.5 pt-3.5">
        <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight">Turf</h1>
        <span className="flex h-7 items-center gap-1.5 self-start rounded-full bg-navy px-3 text-xs font-semibold text-white">
          <b className="text-gold">2×</b> in rival zones · most stamps this week wins
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <MapContainer center={[42.352, -71.085]} zoom={13} zoomControl={false} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {campuses.map((c) => {
            const s = statuses[c.id];
            const holder = campusById[s.owner];
            const t = tagFor(c.id);
            return (
              <Fragment key={`zone-${c.id}`}>
              <Circle
                center={c.center}
                radius={c.radiusM}
                pathOptions={{
                  color: s.captured ? holder.color : c.color,
                  weight: c.id === selected ? 3.5 : 2.5,
                  dashArray: s.contested ? '7 6' : undefined,
                  fillColor: holder.color,
                  fillOpacity: s.captured ? 0.3 : 0.16,
                }}
                eventHandlers={{ click: () => setSelected(c.id) }}
              />
              <Marker
                position={c.center}
                icon={zoneIcon({ logo: holder.logo, color: holder.color, tag: t.tag, tagBg: t.bg, selected: c.id === selected })}
                eventHandlers={{ click: () => setSelected(c.id) }}
              />
              </Fragment>
            );
          })}
        </MapContainer>
      </div>

      <section aria-label="Selected zone" className="flex max-h-[46%] flex-col gap-2 overflow-y-auto rounded-t-3xl bg-paper px-5 pb-4 pt-2.5 shadow-[0_-4px_18px_rgba(20,33,61,0.12)]">
        <div className="mx-auto h-1 w-10 shrink-0 rounded bg-[#C9C3B4]" />
        <div className="flex items-center gap-3">
          <CampusLogo src={owner.logo} alt={`${owner.name} logo`} size={52} border={owner.color} />
          <div className="flex flex-col">
            <span className="text-[11px] font-extrabold tracking-[0.08em]" style={{ color: status.captured ? owner.color : '#4A5064' }}>
              {status.captured ? 'ZONE CAPTURED · THIS WEEK' : status.contested ? 'CONTESTED · THIS WEEK' : isHome ? 'YOUR HOME TURF' : 'HOME TURF HELD'}
            </span>
            <h2 className="font-display text-[22px] font-extrabold leading-tight">
              {status.captured ? `${owner.team} captured ${zone.short}` : `${zone.short} holds its turf`}
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-1.5" aria-label={`Stamps in the ${zone.short} zone`}>
          {top.map((r) => {
            const c = campusById[r.campusId];
            return (
              <div key={r.campusId} className="flex items-center gap-2 text-xs font-bold">
                <span className="w-[92px] truncate">{c.name}</span>
                <div className="h-2.5 flex-1 rounded bg-[#E9E3D5]">
                  <div className="h-2.5 rounded transition-all duration-500" style={{ width: `${(r.count / max) * 100}%`, background: c.color }} />
                </div>
                <span className="w-7 text-right">{r.count}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <span className="flex h-7 items-center rounded-full bg-brick-tint px-2.5 text-xs font-bold text-brick-dark">
            You: {myStamps} stamp{myStamps === 1 ? '' : 's'} here · {isHome ? '1×' : '2×'} points
          </span>
          <span className="text-xs text-[#4A5064]">Resets Sunday</span>
        </div>

        {posts.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Stamp posts in this zone</span>
            {error && <p role="alert" className="text-[13px] font-semibold text-brick-dark">{error}</p>}
            {posts.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-bold">{p.name}</span>
                  <span className="text-xs text-muted">{p.blurb}</span>
                </div>
                {stampedIds.has(p.id) ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-white" aria-label="Stamped">
                    <Icon name="check" size={16} strokeWidth={2.4} />
                  </span>
                ) : (
                  <button type="button" disabled={busyId !== null} onClick={() => run(p.id)} className="h-10 shrink-0 rounded-[10px] bg-brick px-3 text-[13px] font-bold text-white disabled:opacity-60">
                    {busyId === p.id ? '…' : 'Check in'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
