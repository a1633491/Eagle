export function EagleMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="eagle-metal-fill" x1="7" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="22%" stopColor="#f7f6f1" stopOpacity="0.95" />
          <stop offset="54%" stopColor="#d1d7cf" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#677364" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="eagle-metal-stroke" x1="8" y1="9" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#73806f" />
        </linearGradient>
        <radialGradient id="eagle-metal-glow" cx="34%" cy="27%" r="64%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="52%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M32 12.6c-3.9 0-6.9 3-6.9 6.7v4.1l-9.1-5.5c-4.5-2.7-9.8-2.8-13.9-.1 1.7 1.6 4.2 3.2 7.4 4.7L5 24.5c2.2 1.8 5.2 3.2 8.9 4.1L6 31.8c3.7 3.2 8.8 3.7 13 1.2l6.2-3.6 1.7 9.6-5.3 7.6c1.5 1.3 3.4 2 5.3 2h10.1c1.9 0 3.8-.7 5.3-2L37 39l1.8-9.6L45 33c4.2 2.5 9.3 2 13-1.2l-7.9-3.2c3.7-.9 6.7-2.3 8.9-4.1l-4.5-2c3.2-1.5 5.7-3.1 7.4-4.7-4.1-2.7-9.4-2.6-13.9.1l-9 5.5v-4.1c0-3.7-3-6.7-7-6.7Z"
          fill="url(#eagle-metal-fill)"
          fillOpacity="0.96"
          stroke="url(#eagle-metal-stroke)"
          strokeWidth="2.05"
        />
        <path
          d="M11.7 21.7c4.4 1.1 8 3.1 10.8 5.8m-10.8 2.9c4.2 1 7.4 2.8 9.9 5.1m30.7-13.8c-4.4 1.1-8 3.1-10.8 5.8m10.8 2.9c-4.2 1-7.4 2.8-9.9 5.1"
          stroke="#f4f6ef"
          strokeOpacity="0.52"
          strokeWidth="1.28"
        />
        <path
          d="M28.9 18.4c1.1 0 2.2.4 3.1 1.2 1-.8 2-1.2 3.1-1.2 1.8 0 3.5.8 4.9 2.4-.8 2.3-2.2 4.1-4.3 5.3L32 28.5l-3.8-2.4c-2.1-1.2-3.5-3-4.3-5.3 1.4-1.6 3.1-2.4 5-2.4Z"
          fill="none"
          stroke="#f5f3ed"
          strokeWidth="1.55"
        />
        <path d="M27.8 21.5c.7-.9 1.5-1.3 2.4-1.3.6 0 1.2.2 1.8.7.6-.5 1.2-.7 1.8-.7.9 0 1.7.4 2.4 1.3" stroke="#f8f7f3" strokeWidth="1.35" />
        <path d="M29.2 24.4 32 26.6l2.8-2.2" stroke="#f6f5ef" strokeWidth="1.5" />
        <path d="M26.9 29.4c1.3 1 3 1.5 5.1 1.5s3.8-.5 5.1-1.5" stroke="#f6f5ef" strokeOpacity="0.8" strokeWidth="1.35" />
        <path d="M23.6 46.9c1.5-.4 2.9-.6 4.3-.6h8.2c1.4 0 2.8.2 4.3.6" stroke="#f4f3ed" strokeOpacity="0.5" strokeWidth="1.15" />
        <path
          d="M32 12.6c-3.9 0-6.9 3-6.9 6.7v4.1l-9.1-5.5c-4.5-2.7-9.8-2.8-13.9-.1 1.7 1.6 4.2 3.2 7.4 4.7L5 24.5c2.2 1.8 5.2 3.2 8.9 4.1L6 31.8c3.7 3.2 8.8 3.7 13 1.2l6.2-3.6 1.7 9.6-5.3 7.6c1.5 1.3 3.4 2 5.3 2h10.1c1.9 0 3.8-.7 5.3-2L37 39l1.8-9.6L45 33c4.2 2.5 9.3 2 13-1.2l-7.9-3.2c3.7-.9 6.7-2.3 8.9-4.1l-4.5-2c3.2-1.5 5.7-3.1 7.4-4.7-4.1-2.7-9.4-2.6-13.9.1l-9 5.5v-4.1c0-3.7-3-6.7-7-6.7Z"
          fill="url(#eagle-metal-glow)"
          stroke="none"
        />
      </g>
    </svg>
  );
}
