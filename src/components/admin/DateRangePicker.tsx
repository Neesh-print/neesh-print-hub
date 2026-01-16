import { useState } from "react";
import { Calendar } from "lucide-react";

export interface DatePreset {
  label: string;
  getValue: () => { start: Date; end: Date };
}

export interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
  presets?: DatePreset[];
}

const defaultPresets: DatePreset[] = [
  {
    label: '7D',
    getValue: () => ({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: '30D',
    getValue: () => ({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: '90D',
    getValue: () => ({
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: 'YTD',
    getValue: () => ({
      start: new Date(new Date().getFullYear(), 0, 1),
      end: new Date(),
    }),
  },
  {
    label: 'All',
    getValue: () => ({
      start: new Date(2020, 0, 1),
      end: new Date(),
    }),
  },
];

export const DateRangePicker = ({
  startDate,
  endDate,
  onChange,
  presets = defaultPresets,
}: DateRangePickerProps) => {
  const [activePreset, setActivePreset] = useState<string | null>('30D');
  const [showCustom, setShowCustom] = useState(false);

  const handlePresetClick = (preset: DatePreset) => {
    const { start, end } = preset.getValue();
    onChange(start, end);
    setActivePreset(preset.label);
    setShowCustom(false);
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Preset buttons */}
      <div className="flex gap-1">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset)}
            className={`px-3 py-1.5 rounded text-caption font-medium transition-colors ${
              activePreset === preset.label && !showCustom
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom date toggle */}
      <button
        onClick={() => {
          setShowCustom(!showCustom);
          setActivePreset(null);
        }}
        className={`p-2 rounded transition-colors ${
          showCustom
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
        aria-label="Custom date range"
      >
        <Calendar className="w-4 h-4" />
      </button>

      {/* Custom date inputs */}
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={formatDate(startDate)}
            onChange={(e) => onChange(new Date(e.target.value), endDate)}
            className="px-2 py-1 text-caption border border-border rounded bg-background text-foreground"
          />
          <span className="text-caption text-muted-foreground">to</span>
          <input
            type="date"
            value={formatDate(endDate)}
            onChange={(e) => onChange(startDate, new Date(e.target.value))}
            className="px-2 py-1 text-caption border border-border rounded bg-background text-foreground"
          />
        </div>
      )}
    </div>
  );
};
