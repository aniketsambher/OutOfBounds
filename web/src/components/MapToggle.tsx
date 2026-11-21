import { Link } from 'react-router-dom';
import { Icon } from './Icon';

/** Explore / Turf switch shown at the top of both map screens. */
export function MapToggle({ active }: { active: 'explore' | 'turf' }) {
  const base = 'flex items-center justify-center gap-1.5 rounded-[20px] text-sm font-bold';
  return (
    <div role="group" aria-label="Map layer" className="grid h-12 flex-1 grid-cols-2 gap-1 rounded-3xl bg-white p-1 shadow-[0_2px_10px_rgba(20,33,61,0.12)]">
      {active === 'explore' ? (
        <span aria-current="page" className={`${base} bg-navy text-white`}><Icon name="compass" size={16} strokeWidth={2} />Explore</span>
      ) : (
        <Link to="/explore" className={`${base} text-navy`}><Icon name="compass" size={16} strokeWidth={2} />Explore</Link>
      )}
      {active === 'turf' ? (
        <span aria-current="page" className={`${base} bg-navy text-white`}><Icon name="flag" size={16} strokeWidth={2} />Turf</span>
      ) : (
        <Link to="/turf" className={`${base} text-navy`}><Icon name="flag" size={16} strokeWidth={2} />Turf</Link>
      )}
    </div>
  );
}
