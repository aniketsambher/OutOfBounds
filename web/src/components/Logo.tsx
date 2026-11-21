/** Out of Bounds mark: an arrow breaking out of a dashed bubble. */
export function AppMark({ size = 30, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="13" cy="19" r="10" stroke={light ? '#FFFFFF' : '#B7412E'} strokeWidth="2.2" strokeDasharray="4 3" />
      <path d="M13 19L28 4M19 4h9v9" stroke={light ? '#FFFFFF' : '#14213D'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A school logo on a white tile with an optional colored border. */
export function CampusLogo({ src, alt, size = 40, border }: { src: string; alt: string; size?: number; border?: string }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[10px] bg-white p-[3px]"
      style={{ width: size, height: size, border: `${border ? 2 : 1}px solid ${border ?? '#E4DFD3'}` }}
    >
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </span>
  );
}
