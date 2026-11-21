import 'leaflet/dist/leaflet.css';
import { useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { neighborhoods, places } from '../data/seed';
import type { PlaceType } from '../data/types';
import { useCheckIn } from '../hooks/useCheckIn';
import {
  bubbleRadiusM,
  campusById,
  neighborhoodById,
  nextNeighborhood,
  placeById,
  progressFor,
  STAMP_GOAL,
  typeMeta,
  zoneForPos,
} from '../lib/game';
import { distanceM } from '../lib/geo';
import { pinIcon, youIcon } from '../lib/markers';
import { useGame } from '../store/game';

type Filter = 'all' | PlaceType;
const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Neighborhoods' },
  { id: 'eat', label: 'Local eats' },
  { id: 'bakery', label: 'Bakeries' },
  { id: 'landmark', label: 'Landmarks' },
  { id: 'park', label: 'Parks' },
];

export function ExploreMap() {
  const checkIns = useGame((s) => s.checkIns);
  const campusId = useGame((s) => s.campusId);
  const campus = campusById[campusId];
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedN, setSelectedN] = useState<string | undefined>(() => nextNeighborhood(checkIns, campusId)?.id ?? neighborhoods[0].id);
  const [selectedPlace, setSelectedPlace] = useState<string | undefined>();
  const { run, busyId, error } = useCheckIn();

  const bubble = useMemo(() => bubbleRadiusM(checkIns, campusId), [checkIns, campusId]);
  const stampedIds = useMemo(() => new Set(checkIns.map((c) => c.placeId)), [checkIns]);

  const n = selectedN ? neighborhoodById[selectedN] : undefined;
  const place = filter !== 'all' && selectedPlace ? placeById[selectedPlace] : undefined;

  return (
    <div className="flex h-[calc(100dvh-76px)] flex-col">
      <div className="flex flex-col gap-2.5 bg-paper px-4 pb-2.5 pt-3.5">
        <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight">Explore</h1>
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setSelectedPlace(undefined);
              }}
              className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold ${
                filter === f.id ? 'bg-navy text-white' : 'border border-line bg-white text-navy'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <MapContainer center={[42.333, -71.08]} zoom={12} zoomControl={false} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle
            center={campus.center}
            radius={bubble}
            pathOptions={{ color: '#B7412E', weight: 2, dashArray: '8 6', fillColor: '#B7412E', fillOpacity: 0.07 }}
          />
          <Marker position={campus.center} icon={youIcon(`You · ${campus.short}`)} />

          {filter === 'all'
            ? neighborhoods.map((nb) => {
                const p = progressFor(checkIns, nb.id);
                return (
                  <Marker
                    key={nb.id}
                    position={nb.center}
                    icon={pinIcon({ icon: p.complete ? 'check' : nb.icon, color: nb.ink, label: nb.name, filled: p.complete, selected: nb.id === selectedN })}
                    eventHandlers={{ click: () => setSelectedN(nb.id) }}
                  />
                );
              })
            : places
                .filter((pl) => pl.type === filter)
                .map((pl) => {
                  const color = pl.neighborhoodId ? neighborhoodById[pl.neighborhoodId].ink : '#14213D';
                  return (
                    <Marker
                      key={pl.id}
                      position={pl.pos}
                      icon={pinIcon({ icon: typeMeta[pl.type].icon, color, label: pl.name, filled: stampedIds.has(pl.id), selected: pl.id === selectedPlace, size: 30 })}
                      eventHandlers={{ click: () => setSelectedPlace(pl.id) }}
                    />
                  );
                })}
        </MapContainer>
      </div>

      <section aria-label="Selection" className="flex flex-col gap-2 rounded-t-3xl bg-paper px-5 pb-4 pt-2.5 shadow-[0_-4px_18px_rgba(20,33,61,0.12)]">
        <div className="mx-auto h-1 w-10 rounded bg-[#C9C3B4]" />
        {filter === 'all' && n && <NeighborhoodSheet nId={n.id} outside={distanceM(campus.center, n.center) > bubble} />}
        {filter !== 'all' && !place && <p className="py-3 text-center text-sm text-muted">Tap a pin to see the spot.</p>}
        {place && (
          <>
            <span className="text-[11px] font-bold tracking-[0.1em]" style={{ color: typeMeta[place.type].text }}>{typeMeta[place.type].label}</span>
            <h2 className="font-display text-[22px] font-extrabold leading-tight">{place.name}</h2>
            <p className="text-[13px] text-muted">{place.blurb}</p>
            {error && <p role="alert" className="text-[13px] font-semibold text-brick-dark">{error}</p>}
            {place.neighborhoodId ? (
              <Link to={`/n/${place.neighborhoodId}`} className="mt-1 flex h-12 items-center justify-center gap-2 rounded-[14px] bg-navy text-[15px] font-bold text-white">
                Open {neighborhoodById[place.neighborhoodId].name} quest <Icon name="arrowRight" size={18} strokeWidth={2.2} />
              </Link>
            ) : stampedIds.has(place.id) ? (
              <p className="py-2 text-center text-sm font-semibold text-navy">Stamped ✓</p>
            ) : (
              <button type="button" disabled={busyId !== null} onClick={() => run(place.id)} className="mt-1 h-12 rounded-[14px] bg-brick text-[15px] font-bold text-white disabled:opacity-60">
                {busyId ? 'Checking…' : `Check in · ${zoneForPos(place.pos) ? `${campusById[zoneForPos(place.pos)!].short} zone` : 'post'}`}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function NeighborhoodSheet({ nId, outside }: { nId: string; outside: boolean }) {
  const checkIns = useGame((s) => s.checkIns);
  const n = neighborhoodById[nId];
  const p = progressFor(checkIns, nId);
  return (
    <>
      <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: n.ink }}>
        {p.complete ? 'Stamped' : outside ? 'Pop your bubble' : 'Inside your bubble'}
      </span>
      <h2 className="font-display text-2xl font-extrabold leading-tight">{n.name}</h2>
      <p className="text-[13px] text-muted">{n.tagline}</p>
      <div className="mt-0.5 flex flex-wrap gap-2">
        <span className="flex h-[26px] items-center rounded-full bg-brick-tint px-2.5 text-xs font-semibold text-brick-dark">
          {Math.min(p.done, STAMP_GOAL)}/{STAMP_GOAL} quests
        </span>
        <span className="flex h-[26px] items-center gap-1.5 rounded-full bg-[#E6EAF3] px-2.5 text-xs font-semibold text-navy">
          <span className="h-2 w-2 rounded-full" style={{ background: n.tLineColor }} />
          {n.tLine}
        </span>
        <span className="flex h-[26px] items-center rounded-full bg-[#E6EAF3] px-2.5 text-xs font-semibold text-navy">{n.travel}</span>
      </div>
      <Link to={`/n/${n.id}`} className="mt-1.5 flex h-12 items-center justify-center gap-2 rounded-[14px] bg-navy text-[15px] font-bold text-white">
        {p.complete ? 'View stamp' : 'Open quest'} <Icon name="arrowRight" size={18} strokeWidth={2.2} />
      </Link>
    </>
  );
}
