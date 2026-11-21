import { Link, Navigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useCheckIn } from '../hooks/useCheckIn';
import { MIX_BONUS, neighborhoodById, placesIn, progressFor, STAMP_GOAL, typeMeta } from '../lib/game';
import { useGame } from '../store/game';

const speechLang: Record<string, string> = { it: 'it-IT', zh: 'zh-CN', ko: 'ko-KR', vi: 'vi-VN', es: 'es-ES', ht: 'fr-HT' };

export function Neighborhood() {
  const { id = '' } = useParams();
  const n = neighborhoodById[id];
  const checkIns = useGame((s) => s.checkIns);
  const { run, busyId, error, clearError, demoMode, photoEnabled } = useCheckIn();

  if (!n) return <Navigate to="/" replace />;
  const list = placesIn(n.id);
  const progress = progressFor(checkIns, n.id);

  function speak() {
    if (!n.phrase || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(n.phrase.text);
    u.lang = speechLang[n.phrase.lang] ?? n.phrase.lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  return (
    <div className="pb-[96px]">
      <header className="relative flex flex-col gap-3 overflow-hidden px-5 pb-5 pt-4 text-white" style={{ background: n.ink }}>
        <div aria-hidden="true" className="absolute -right-6 top-10 flex h-[150px] w-[150px] rotate-[-12deg] flex-col items-center justify-center gap-1 rounded-full border-[3px] border-dashed border-white/45 text-white/60">
          <Icon name={n.icon} size={40} strokeWidth={1.6} />
          <span className="font-display text-[13px] font-extrabold tracking-[0.12em]">{n.stampWord}</span>
        </div>
        <Link to="/explore" aria-label="Back to map" className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
          <Icon name="back" size={22} strokeWidth={2.2} />
        </Link>
        <div className="relative flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-white/85">
            {progress.complete ? 'Stamp earned' : 'Neighborhood quest'}
          </span>
          <h1 className="font-display text-[38px] font-extrabold leading-none tracking-tight">{n.name}</h1>
          <span className="text-[15px] text-white/90">{n.tagline}</span>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <span className="flex h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-xs font-bold text-navy">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: n.tLineColor }} aria-hidden="true" />
            {n.tLine}
          </span>
          <span className="flex h-7 items-center rounded-full bg-white/20 px-2.5 text-xs font-semibold">{n.travel} from campus</span>
        </div>
      </header>

      <div className="flex flex-col gap-2.5 px-5 pt-4">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-extrabold">Earn the stamp</h2>
            <span className="text-[13px] text-muted">
              <b className="text-navy">{Math.min(progress.done, STAMP_GOAL)} / {STAMP_GOAL}</b> quests done
            </span>
          </div>
          <span className="text-xs text-[#4A5064]">
            Mix bonus: 1 local eat + 1 place = <b className="text-brick-dark">+{MIX_BONUS}</b>
          </span>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-brick bg-brick-tint px-3 py-2 text-[13px] text-brick-dark">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={clearError} aria-label="Dismiss" className="font-bold">✕</button>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {list.map((p) => {
            const meta = typeMeta[p.type];
            const done = progress.doneIds.has(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border bg-white px-3 py-2.5" style={{ borderColor: done ? n.ink : '#E4DFD3' }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: meta.bg, color: meta.text }}>
                  <Icon name={meta.icon} size={22} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded px-1.5 text-[10px] font-extrabold tracking-[0.06em]" style={{ background: meta.bg, color: meta.text }}>{meta.label}</span>
                    {p.tags?.map((t) => (
                      <span key={t} className="text-[11px] font-bold text-brick-dark">{t}</span>
                    ))}
                  </span>
                  <span className="text-[15px] font-bold leading-tight">{p.name}</span>
                  <span className="text-xs text-muted">{p.blurb}</span>
                </div>
                {done ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: n.ink }} aria-label="Checked in">
                    <Icon name="check" size={18} strokeWidth={2.4} />
                  </span>
                ) : (
                  <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                    <button
                      type="button"
                      onClick={() => run(p.id)}
                      disabled={busyId !== null}
                      className="h-11 rounded-xl bg-brick px-3 text-[13px] font-bold text-white disabled:opacity-60"
                    >
                      {busyId === p.id ? 'Checking…' : 'Check in'}
                    </button>
                    {photoEnabled && (
                      <label className={`flex h-9 cursor-pointer items-center justify-center rounded-xl border border-brick px-2 text-[11px] font-bold text-brick-dark ${busyId !== null ? 'pointer-events-none opacity-60' : ''}`}>
                        + Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="sr-only"
                          aria-label={`Check in at ${p.name} with a photo`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) void run(p.id, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {n.phrase && (
          <section aria-label="Phrase card" className="flex items-center gap-3 rounded-2xl bg-navy px-3.5 py-3 text-white">
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold">Order like a local</span>
              <span lang={n.phrase.lang} className="font-display text-lg font-bold">{n.phrase.text}</span>
              <span className="text-xs text-[#C9D1E3]">“{n.phrase.meaning}”</span>
            </div>
            <button type="button" onClick={speak} aria-label="Play pronunciation" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-navy">
              <Icon name="speaker" size={20} strokeWidth={2} />
            </button>
          </section>
        )}

        <p className="text-center text-xs text-muted">
          {demoMode ? 'Demo mode is on: check-ins skip the GPS check.' : 'Check-ins need you within 200 m of the spot.'}
          {photoEnabled ? ' "+ Photo" lets Gemini confirm you’re really there.' : ''}
        </p>
      </div>
    </div>
  );
}
