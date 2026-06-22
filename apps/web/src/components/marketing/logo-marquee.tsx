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
    <section className="border-y border-slate-200 bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-slate-500">
          Built for implementation-heavy B2B teams who cannot afford surprise delays
        </p>
        <div className="marketing-marquee-mask relative mt-8 overflow-hidden">
          <div className="marketing-marquee-track flex w-max items-center gap-4 sm:gap-6">
            {track.map((segment, index) => (
              <span
                key={`${segment}-${index}`}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600"
              >
                {segment}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
