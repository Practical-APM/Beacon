'use client';

import { useReducedMotion } from 'framer-motion';

export function MarketingBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className={reduceMotion ? '' : 'marketing-orb marketing-orb-a'}
        style={{
          background: 'radial-gradient(circle, rgba(45,212,191,0.16) 0%, transparent 70%)',
        }}
      />
      <div
        className={reduceMotion ? '' : 'marketing-orb marketing-orb-b'}
        style={{
          background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)',
        }}
      />
      <div
        className={reduceMotion ? '' : 'marketing-orb marketing-orb-c'}
        style={{
          background: 'radial-gradient(circle, rgba(129,140,248,0.08) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}
