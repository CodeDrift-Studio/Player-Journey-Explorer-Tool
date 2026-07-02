/** Tiny shared presentational primitives for the sidebar — keeps filter
 * components free of repeated Tailwind strings. */

import type { ReactNode } from 'react';

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </div>
  );
}

/** Class string for a selectable option button (active vs idle). */
export function optionButton(active: boolean): string {
  return `w-full truncate rounded px-2 py-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 ${
    active
      ? 'bg-indigo-600 text-white'
      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
  }`;
}
