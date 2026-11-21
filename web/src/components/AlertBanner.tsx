import { useEffect } from 'react';
import { useGame } from '../store/game';
import { Icon } from './Icon';

/** In-app stand-in for push notifications: shows the newest capture alert at the top. */
export function AlertBanner() {
  const alert = useGame((s) => s.alerts[0]);
  const dismiss = useGame((s) => s.dismissAlert);

  useEffect(() => {
    if (!alert) return;
    const t = window.setTimeout(() => dismiss(alert.id), 7000);
    return () => window.clearTimeout(t);
  }, [alert, dismiss]);

  if (!alert) return null;
  return (
    <div className="fixed left-1/2 top-3 z-[2000] w-[calc(100%-24px)] max-w-[406px] -translate-x-1/2 animate-[drop_0.35s_ease-out]" role="status" aria-live="polite">
      <div className="flex items-start gap-3 rounded-[20px] bg-[#F4F2EE] p-3 text-navy shadow-[0_12px_30px_rgba(20,33,61,0.35)]">
        {alert.logo && (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-white p-1">
            <img src={alert.logo} alt="" className="max-h-full max-w-full object-contain" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-semibold tracking-wide text-muted">OUT OF BOUNDS · now</span>
          <span className="text-[15px] font-extrabold leading-tight">{alert.title}</span>
          <span className="text-[13px] leading-snug text-[#33394A]">{alert.body}</span>
        </div>
        <button type="button" onClick={() => dismiss(alert.id)} aria-label="Dismiss alert" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-black/5">
          <Icon name="close" size={18} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
