'use client';

import { useReducedMotion } from 'framer-motion';

export function MarketingBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="marketing-grid-bg absolute inset-0 opacity-80" />
      <div
        className={reduceMotion ? '' : 'marketing-orb marketing-orb-a'}
        style={{
          background:
            'radial-gradient(circle, rgba(13,148,136,0.22) 0%, rgba(13,148,136,0) 70%)',
        }}
      />
      <div
        className={reduceMotion ? '' : 'marketing-orb marketing-orb-b'}
        style={{
          background:
            'radial-gradient(circle, rgba(8,145,178,0.16) 0%, rgba(8,145,178,0) 70%)',
        }}
      />
      <div
        className={reduceMotion ? '' : 'marketing-orb marketing-orb-c'}
        style={{
          background:
            'radial-gradient(circle, rgba(15,118,110,0.12) 0%, rgba(15,118,110,0) 70%)',
        }}
      />
    </div>
  );
}
