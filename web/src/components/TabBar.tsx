import { NavLink, useLocation } from 'react-router-dom';
import type { IconName } from '../data/types';
import { Icon } from './Icon';

const tabs: Array<{ to: string; label: string; icon: IconName; match: (p: string) => boolean }> = [
  { to: '/', label: 'Passport', icon: 'passport', match: (p) => p === '/' || p.startsWith('/n/') || p.startsWith('/stamp') },
  { to: '/explore', label: 'Explore', icon: 'compass', match: (p) => p.startsWith('/explore') },
  { to: '/turf', label: 'Turf', icon: 'flag', match: (p) => p.startsWith('/turf') },
  { to: '/cup', label: 'Bubble Cup', icon: 'trophy', match: (p) => p.startsWith('/cup') },
  { to: '/me', label: 'Profile', icon: 'user', match: (p) => p.startsWith('/me') },
];

export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-1/2 z-[1000] flex h-[76px] w-full max-w-[430px] -translate-x-1/2 items-start justify-around border-t border-line bg-white pt-2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <NavLink
            key={t.to}
            to={t.to}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[48px] min-w-[56px] flex-col items-center gap-[3px] text-[11px] ${
              active ? 'font-bold text-brick' : 'font-semibold text-muted'
            }`}
          >
            <Icon name={t.icon} strokeWidth={active ? 1.9 : 1.8} />
            {t.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
