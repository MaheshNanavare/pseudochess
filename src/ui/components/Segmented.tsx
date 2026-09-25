import type { ReactNode } from 'react';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

/** Radio group styled as a segmented control; arrow keys work natively. */
export function Segmented<T extends string>({ legend, name, value, options, onChange }: SegmentedProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-muted">{legend}</legend>
      <div className="flex rounded-lg bg-surface p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-[15px] transition-colors has-focus-visible:ring-3 has-focus-visible:ring-jade ${
              value === o.value ? 'bg-page font-bold shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
