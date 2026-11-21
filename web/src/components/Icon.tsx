import type { ReactNode } from 'react';
import type { IconName } from '../data/types';

const paths: Record<IconName, ReactNode> = {
  passport: (<><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M9 16h6" /></>),
  map: (<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>),
  trophy: (<><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" /><path d="M12 13v4M8 20h8" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  lock: (<><rect x="6" y="11" width="12" height="9" rx="2" /><path d="M9 11V8a3 3 0 0 1 6 0v3" /></>),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  pin: (<><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  compass: (<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" /></>),
  share: (<><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>),
  speaker: (<><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></>),
  shield: <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />,
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>),
  bowl: (<><path d="M3 11h18a9 9 0 0 1-18 0z" /><path d="M8.5 7.5c0-1.5 1-2 1-3.5M12.5 7.5c0-1.5 1-2 1-3.5" /></>),
  dumpling: (<><path d="M3 15a9 6 0 0 0 18 0z" /><path d="M6.5 15c.8-2 2-2 2.8 0M10.6 15c.8-2 2-2 2.8 0M14.7 15c.8-2 2-2 2.8 0" /></>),
  grill: (<><circle cx="12" cy="12" r="8" /><path d="M6 9h12M4.5 12h15M6 15h12" /></>),
  cannoli: <rect x="3" y="8.75" width="18" height="6.5" rx="3.25" transform="rotate(-24 12 12)" />,
  landmark: <path d="M3 21h18M5 21V11M9.5 21V11M14.5 21V11M19 21V11M2.5 11L12 4l9.5 7z" />,
  tree: (<><path d="M12 21v-6" /><path d="M12 3c-3.5 0-6 2.8-6 6.2 0 3.2 2.7 5.8 6 5.8s6-2.6 6-5.8C18 5.8 15.5 3 12 3z" /></>),
  bread: (<><path d="M3 14c0-3 4-6 9-6s9 3 9 6c0 1.5-1 2-2 2H5c-1 0-2-.5-2-2z" /><path d="M8 11l1 2M12 10v2.5M16 11l-1 2" /></>),
  pupusa: (<><ellipse cx="12" cy="11" rx="8" ry="4" /><path d="M4 11v1.5c0 2.2 3.6 4 8 4s8-1.8 8-4V11" /></>),
};

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}

export function Icon({ name, size = 24, strokeWidth = 1.8, className, label }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {paths[name]}
    </svg>
  );
}
