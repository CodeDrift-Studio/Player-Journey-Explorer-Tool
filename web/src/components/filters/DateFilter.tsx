/** Date selector — a compact grid of day buttons (5 days). */

import { shortDate } from '../../lib/format';
import { useDataStore } from '../../store/dataStore';
import { useFilterStore } from '../../store/filterStore';
import { SectionLabel, optionButton } from '../ui';

export function DateFilter() {
  const dates = useDataStore((s) => s.manifest?.dates);
  const date = useFilterStore((s) => s.date);
  const setDate = useFilterStore((s) => s.setDate);

  if (!dates) return null;

  return (
    <div>
      <SectionLabel>Date</SectionLabel>
      <div className="grid grid-cols-3 gap-1">
        {dates.map((d) => (
          <button
            key={d}
            className={`${optionButton(date === d)} text-center`}
            onClick={() => setDate(d)}
          >
            {shortDate(d)}
          </button>
        ))}
      </div>
    </div>
  );
}
