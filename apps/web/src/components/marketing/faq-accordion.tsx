'use client';

export function FaqAccordion({
  items,
}: {
  items: Array<{ question: string; answer: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] shadow-sm">
      {items.map((item, index) => (
        <details
          key={item.question}
          className="group border-b border-[var(--m-border)] last:border-b-0"
          open={index === 0}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-[var(--m-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600/40 [&::-webkit-details-marker]:hidden">
            <span className="font-semibold text-[var(--m-text)]">{item.question}</span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--m-border)] text-sm text-[var(--m-muted)] transition group-open:border-[var(--m-accent)]/40 group-open:bg-[var(--m-accent-soft)] group-open:text-[var(--m-accent)]">
              <span className="group-open:hidden" aria-hidden>
                +
              </span>
              <span className="hidden group-open:inline" aria-hidden>
                −
              </span>
            </span>
          </summary>
          <div className="border-t border-[var(--m-border)] px-6 pb-5 pt-4 text-sm leading-relaxed text-[var(--m-muted)]">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
