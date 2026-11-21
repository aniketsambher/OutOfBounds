import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { Icon } from '../components/Icon';
import type { IconName } from '../data/types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const svg = (name: IconName, size: number) => renderToStaticMarkup(<Icon name={name} size={size} strokeWidth={2} />);

/** Round neighborhood or place pin with a label underneath. */
export function pinIcon(opts: { icon: IconName; color: string; label: string; filled: boolean; selected?: boolean; size?: number }) {
  const size = opts.size ?? (opts.selected ? 46 : 36);
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
      <div style="width:${size}px;height:${size}px;border-radius:50%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;
        background:${opts.filled ? opts.color : '#FFFFFF'};color:${opts.filled ? '#FFFFFF' : opts.color};
        border:${opts.filled ? '2px solid #FFFFFF' : `2px dashed ${opts.color}`};
        box-shadow:0 2px 6px rgba(20,33,61,.3)${opts.selected ? `,0 0 0 6px ${opts.color}40` : ''}">
        ${svg(opts.icon, Math.round(size * 0.5))}
      </div>
      <span style="font:700 11px Inter,sans-serif;color:${opts.selected ? '#FFFFFF' : '#14213D'};background:${opts.selected ? '#14213D' : 'rgba(255,255,255,.92)'};padding:1px 6px;border-radius:6px;white-space:nowrap">${esc(opts.label)}</span>
    </div>`;
  return L.divIcon({ html, className: 'oob-marker', iconSize: [120, size + 22], iconAnchor: [60, size / 2] });
}

/** Blue "you are here / your campus" dot. */
export function youIcon(label: string) {
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="width:18px;height:18px;border-radius:50%;background:#2457A6;border:3px solid #FFFFFF;box-sizing:border-box;box-shadow:0 0 0 6px rgba(36,87,166,.22)"></div>
      <span style="font:700 11px Inter,sans-serif;color:#1D4687;background:rgba(255,255,255,.92);padding:1px 6px;border-radius:6px;white-space:nowrap">${esc(label)}</span>
    </div>`;
  return L.divIcon({ html, className: 'oob-marker', iconSize: [120, 40], iconAnchor: [60, 9] });
}

/** Campus zone token: the holder's logo on a white tile, with a status tag. */
export function zoneIcon(opts: { logo: string; color: string; tag: string; tagBg: string; selected: boolean }) {
  const w = opts.selected ? 58 : 48;
  const h = opts.selected ? 54 : 44;
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
      <div style="width:${w}px;height:${h}px;background:#FFFFFF;border:2.5px solid ${opts.color};border-radius:12px;padding:3px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(20,33,61,.3)">
        <img src="${opts.logo}" alt="" style="width:100%;height:100%;object-fit:contain"/>
      </div>
      <span style="font:800 10px Inter,sans-serif;letter-spacing:.04em;color:#FFFFFF;background:${opts.tagBg};padding:2px 7px;border-radius:8px;white-space:nowrap">${esc(opts.tag)}</span>
    </div>`;
  return L.divIcon({ html, className: 'oob-marker', iconSize: [140, h + 24], iconAnchor: [70, h / 2] });
}
