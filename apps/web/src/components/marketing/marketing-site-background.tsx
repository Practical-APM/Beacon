'use client';

import { useReducedMotion } from 'framer-motion';

export function MarketingSiteBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="marketing-site-ambient" aria-hidden>
      <div
        className={
          reduceMotion ? 'marketing-site-ambient-base' : 'marketing-site-ambient-base marketing-site-ambient-shift'
        }
      />
      {!reduceMotion ? (
        <>
          <div className="marketing-site-ambient-orb marketing-site-ambient-orb-a" />
          <div className="marketing-site-ambient-orb marketing-site-ambient-orb-b" />
          <div className="marketing-site-ambient-orb marketing-site-ambient-orb-c" />
        </>
      ) : null}
    </div>
  );
}
