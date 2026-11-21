import type { Neighborhood } from '../data/types';
import { Icon } from './Icon';

interface StampSealProps {
  neighborhood: Neighborhood;
  size?: number;
  rotate?: number;
  /** Small caption at the bottom of the seal, e.g. a date. */
  caption?: string;
  /** Show the neighborhood name around the top of the seal (large stamps). */
  showName?: boolean;
}

/** A rubber-stamp style seal in the neighborhood's ink color. */
export function StampSeal({ neighborhood: n, size = 80, rotate = -8, caption, showName = false }: StampSealProps) {
  const big = size >= 140;
  return (
    <div
      className="box-border rounded-full"
      style={{ width: size, height: size, border: `${big ? 6 : 3}px solid ${n.ink}`, padding: big ? 7 : 3, transform: `rotate(${rotate}deg)` }}
      role="img"
      aria-label={`${n.name} stamp`}
    >
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full"
        style={{ border: `${big ? 2 : 1.5}px dashed ${n.ink}`, color: n.ink }}
      >
        {showName && <span className="text-[11px] font-extrabold tracking-[0.2em]">{n.name.toUpperCase()}</span>}
        <Icon name={n.icon} size={big ? 50 : 22} strokeWidth={big ? 1.6 : 2} />
        <span className={`font-display font-extrabold tracking-[0.06em] ${big ? 'text-[24px] leading-none' : 'text-[10px]'}`}>
          {n.stampWord}
        </span>
        {caption && <span className={`font-bold tracking-[0.12em] ${big ? 'text-[11px]' : 'text-[8px]'}`}>{caption}</span>}
      </div>
    </div>
  );
}
