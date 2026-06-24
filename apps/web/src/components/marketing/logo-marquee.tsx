'use client';

const segments = [
  'B2B SaaS',
  'FinTech',
  'HealthTech',
  'Professional services',
  'Enterprise CS',
  'RevOps',
];

export function LogoMarquee() {
  const track = [...segments, ...segments];

  return (
    <section className="border-y border-[var(--m-border)]/80 bg-[var(--m-surface)]/45 py-10 backdrop-blur-md sm:py-12">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-[var(--m-muted)]">
          Built for implementation-heavy B2B teams who cannot afford surprise delays
        </p>
        <div className="marketing-marquee-mask relative mt-8 overflow-hidden">
          <div className="marketing-marquee-track flex w-max items-center gap-4 sm:gap-6">
            {track.map((segment, index) => (
              <span key={`${segment}-${index}`} className="marketing-marquee-pill">
                {segment}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
