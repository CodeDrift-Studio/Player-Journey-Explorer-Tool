/** Map selector — segmented buttons (only 3 maps, so no dropdown). */

import { useDataStore } from '../../store/dataStore';
import { useFilterStore } from '../../store/filterStore';
import type { MapId } from '../../types/contract';
import { SectionLabel, optionButton } from '../ui';

export function MapFilter() {
  const maps = useDataStore((s) => s.manifest?.maps);
  const mapId = useFilterStore((s) => s.mapId);
  const setMap = useFilterStore((s) => s.setMap);

  if (!maps) return null;
  const ids = Object.keys(maps) as MapId[];

  return (
    <div>
      <SectionLabel>Map</SectionLabel>
      <div className="grid gap-1">
        {ids.map((id) => (
          <button key={id} className={optionButton(mapId === id)} onClick={() => setMap(id)}>
            {id}
          </button>
        ))}
      </div>
    </div>
  );
}
