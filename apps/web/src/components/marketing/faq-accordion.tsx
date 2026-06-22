'use client';

import { cn } from '@/lib/utils';

export function FaqAccordion({
  items,
}: {
  items: Array<{ question: string; answer: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {items.map((item, index) => (
        <details
          key={item.question}
          className="group border-b border-slate-200 last:border-b-0"
          open={index === 0}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600/40 [&::-webkit-details-marker]:hidden">
            <span className="font-semibold text-slate-900">{item.question}</span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-sm text-slate-500 transition group-open:border-teal-200 group-open:bg-teal-50 group-open:text-teal-700">
              <span className="group-open:hidden" aria-hidden>
                +
              </span>
              <span className="hidden group-open:inline" aria-hidden>
                −
              </span>
            </span>
          </summary>
          <div className="border-t border-slate-100 px-6 pb-5 pt-4 text-sm leading-relaxed text-slate-600">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
