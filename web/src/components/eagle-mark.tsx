import { useId } from 'react';

export function EagleMark({ className = 'h-6 w-6' }: { className?: string }) {
  const id = useId();
  const shellStrokeId = `${id}-shell-stroke`;
  const shellFillId = `${id}-shell-fill`;
  const shellGlossId = `${id}-shell-gloss`;
  const floorGlowId = `${id}-floor-glow`;
  const floorBlurId = `${id}-floor-blur`;
  const markShadowId = `${id}-mark-shadow`;

  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={shellStrokeId} x1="12" y1="8" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fafcff" stopOpacity="0.95" />
          <stop offset="38%" stopColor="#f4f5ff" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#a89fff" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id={shellFillId} x1="48" y1="8" x2="48" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#020304" />
          <stop offset="58%" stopColor="#02040a" />
          <stop offset="100%" stopColor="#151239" />
        </linearGradient>
        <radialGradient id={shellGlossId} cx="50%" cy="6%" r="74%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset="24%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={floorGlowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7b7cff" stopOpacity="0.98" />
          <stop offset="45%" stopColor="#8a7cff" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#a59aff" stopOpacity="0" />
        </radialGradient>
        <filter id={floorBlurId} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={markShadowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" floodColor="#7d74ff" floodOpacity="0.18" />
        </filter>
      </defs>
      <g fill="none">
        <ellipse cx="48" cy="85" rx="37" ry="10" fill={`url(#${floorGlowId})`} filter={`url(#${floorBlurId})`} />
        <path
          d="M15 10h66c6.6 0 12 5.4 12 12v52c0 6.6-5.4 12-12 12H15C8.4 86 3 80.6 3 74V22c0-6.6 5.4-12 12-12Z"
          fill={`url(#${shellFillId})`}
          stroke={`url(#${shellStrokeId})`}
          strokeWidth="1.4"
        />
        <path
          d="M15 10h66c6.6 0 12 5.4 12 12v52c0 6.6-5.4 12-12 12H15C8.4 86 3 80.6 3 74V22c0-6.6 5.4-12 12-12Z"
          fill={`url(#${shellGlossId})`}
        />
        <path
          d="M35 16h20c5.5 0 10 4.5 10 10v44c0 5.5-4.5 10-10 10H35c-5.5 0-10-4.5-10-10V26c0-5.5 4.5-10 10-10Zm7.8 9C38.5 25 35 28.5 35 32.8v30.4c0 4.3 3.5 7.8 7.8 7.8h4.4c4.3 0 7.8-3.5 7.8-7.8V32.8c0-4.3-3.5-7.8-7.8-7.8h-4.4Z"
          transform="rotate(34 48 48)"
          fill="#ffffff"
          fillRule="evenodd"
          clipRule="evenodd"
          filter={`url(#${markShadowId})`}
        />
        <path
          d="M17 11.5h64c6.1 0 11 4.9 11 11"
          stroke="#ffffff"
          strokeOpacity="0.66"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
