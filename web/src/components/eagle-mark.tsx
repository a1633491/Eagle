import { useId } from 'react';

export function EagleMark({ className = 'h-6 w-6' }: { className?: string }) {
  const id = useId();
  const shellStrokeId = `${id}-shell-stroke`;
  const shellFillId = `${id}-shell-fill`;
  const shellGlowId = `${id}-shell-glow`;
  const floorGlowId = `${id}-floor-glow`;
  const floorBlurId = `${id}-floor-blur`;
  const markGlowId = `${id}-mark-glow`;

  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={shellStrokeId} x1="14" y1="10" x2="85" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8fbff" stopOpacity="0.94" />
          <stop offset="50%" stopColor="#d9ddff" stopOpacity="0.74" />
          <stop offset="100%" stopColor="#b7b2ff" stopOpacity="0.84" />
        </linearGradient>
        <linearGradient id={shellFillId} x1="48" y1="10" x2="48" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#03050a" />
          <stop offset="62%" stopColor="#070a15" />
          <stop offset="100%" stopColor="#2d2758" />
        </linearGradient>
        <radialGradient id={shellGlowId} cx="52%" cy="102%" r="78%">
          <stop offset="0%" stopColor="#c8b8ff" stopOpacity="0.64" />
          <stop offset="45%" stopColor="#7368ff" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#7368ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={floorGlowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7d78ff" stopOpacity="0.95" />
          <stop offset="58%" stopColor="#9f93ff" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#9f93ff" stopOpacity="0" />
        </radialGradient>
        <filter id={floorBlurId} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="5.5" />
        </filter>
        <filter id={markGlowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="48" cy="85.5" rx="34" ry="8" fill={`url(#${floorGlowId})`} filter={`url(#${floorBlurId})`} />
        <path
          d="M18 12h60c7.7 0 14 6.3 14 14v44c0 7.7-6.3 14-14 14H18C10.3 84 4 77.7 4 70V26c0-7.7 6.3-14 14-14Z"
          fill={`url(#${shellFillId})`}
          stroke={`url(#${shellStrokeId})`}
          strokeWidth="1.6"
        />
        <path
          d="M18 12h60c7.7 0 14 6.3 14 14v44c0 7.7-6.3 14-14 14H18C10.3 84 4 77.7 4 70V26c0-7.7 6.3-14 14-14Z"
          fill={`url(#${shellGlowId})`}
        />
        <path
          d="M39.5 24.5 19 55.5c-4.5 6.8-2.6 15.9 4.1 20.3 6.8 4.5 15.9 2.6 20.3-4.1l19.7-30.1c4-6.1 12.2-7.8 18.2-3.8 6.1 4 7.8 12.2 3.8 18.2L65.4 86c-9.4 14.3-28.6 18.3-42.9 9C8.2 85.6 4.2 66.4 13.5 52.1L34 21"
          filter={`url(#${markGlowId})`}
          stroke="#ffffff"
          strokeOpacity="0.18"
          strokeWidth="12.5"
        />
        <path
          d="M39.5 24.5 19 55.5c-4.5 6.8-2.6 15.9 4.1 20.3 6.8 4.5 15.9 2.6 20.3-4.1l19.7-30.1c4-6.1 12.2-7.8 18.2-3.8 6.1 4 7.8 12.2 3.8 18.2L65.4 86c-9.4 14.3-28.6 18.3-42.9 9C8.2 85.6 4.2 66.4 13.5 52.1L34 21"
          stroke="#ffffff"
          strokeWidth="10.5"
        />
        <path
          d="M18 12h60c7.7 0 14 6.3 14 14"
          stroke="#ffffff"
          strokeOpacity="0.72"
          strokeWidth="1.35"
        />
      </g>
    </svg>
  );
}
