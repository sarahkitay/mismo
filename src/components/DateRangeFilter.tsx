import { Input } from '@/components/ui/input';
import type { DateRangeState, DateRangePreset } from '@/lib/dateFilters';

interface DateRangeFilterProps {
  value: DateRangeState;
  onChange: (next: DateRangeState) => void;
}

const presets: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'ALL', label: 'All time' },
  { id: '7D', label: 'Last 7' },
  { id: '30D', label: 'Last 30' },
  { id: '90D', label: 'Last 90' },
  { id: '1Y', label: 'Last 1 year' },
  { id: 'CUSTOM', label: 'Custom' },
];

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`interactive-control px-3 py-2 border text-sm ${
            value.preset === preset.id
              ? 'bg-[var(--mismo-blue)] text-white border-[var(--mismo-blue)]'
              : 'bg-white text-[var(--mismo-text-secondary)] border-gray-200'
          }`}
          onClick={() => onChange({ preset: preset.id, startDate: value.startDate, endDate: value.endDate })}
        >
          {preset.label}
        </button>
      ))}
      {value.preset === 'CUSTOM' && (
        <>
          <Input
            type="date"
            value={value.startDate ?? ''}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            className="w-[160px]"
          />
          <Input
            type="date"
            value={value.endDate ?? ''}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            className="w-[160px]"
          />
        </>
      )}
    </div>
  );
}
