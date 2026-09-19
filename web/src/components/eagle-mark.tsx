export function EagleMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="-4 -4 104 104" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-shell-stroke" x1="16" y1="10" x2="84" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbfdff" stopOpacity="0.96" />
          <stop offset="45%" stopColor="#d7deff" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#b9b9ff" stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id="logo-shell-fill" x1="48" y1="14" x2="48" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#060810" />
          <stop offset="68%" stopColor="#0b0d18" />
          <stop offset="100%" stopColor="#191739" />
        </linearGradient>
        <radialGradient id="logo-bottom-glow" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#8d80ff" stopOpacity="0.95" />
          <stop offset="58%" stopColor="#5667ff" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#5667ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="logo-top-gloss" cx="50%" cy="0%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="logo-blur" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="logo-mark-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="48" cy="86" rx="34" ry="10" fill="url(#logo-bottom-glow)" filter="url(#logo-blur)" />
        <path
          d="M20 12h56c6.6 0 12 5.4 12 12v48c0 6.6-5.4 12-12 12H20c-6.6 0-12-5.4-12-12V24c0-6.6 5.4-12 12-12Z"
          fill="url(#logo-shell-fill)"
          stroke="url(#logo-shell-stroke)"
          strokeWidth="2"
        />
        <path
          d="M20 12h56c6.6 0 12 5.4 12 12v48c0 6.6-5.4 12-12 12H20c-6.6 0-12-5.4-12-12V24c0-6.6 5.4-12 12-12Z"
          fill="url(#logo-top-gloss)"
        />
        <path
          d="M42 24 24 51.5C20.7 56.6 22.2 63.4 27.3 66.7c5.1 3.3 11.9 1.8 15.2-3.3L60.1 36c3-4.5 9-5.7 13.5-2.7 4.5 3 5.7 9 2.7 13.5L56.7 77.2c-7.1 10.9-21.7 14-32.7 6.9S10 62.4 17.1 51.5l25-38.2"
          filter="url(#logo-mark-glow)"
          stroke="#ffffff"
          strokeOpacity="0.22"
          strokeWidth="12"
        />
        <path
          d="M42 24 24 51.5C20.7 56.6 22.2 63.4 27.3 66.7c5.1 3.3 11.9 1.8 15.2-3.3L60.1 36c3-4.5 9-5.7 13.5-2.7 4.5 3 5.7 9 2.7 13.5L56.7 77.2c-7.1 10.9-21.7 14-32.7 6.9S10 62.4 17.1 51.5l25-38.2"
          stroke="#ffffff"
          strokeWidth="11"
        />
        <path
          d="M20 12h56c6.6 0 12 5.4 12 12"
          stroke="#ffffff"
          strokeOpacity="0.6"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}
