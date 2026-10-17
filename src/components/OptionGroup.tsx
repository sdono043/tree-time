"use client";

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export function OptionGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  columns = 3,
}: {
  legend: string;
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  columns?: 2 | 3 | 4;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[columns];
  return (
    <fieldset>
      <legend className="text-sm font-medium mb-2">{legend}</legend>
      <div className={`grid grid-cols-2 ${cols} gap-2`}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
              value === o.value ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span className="font-medium block">{o.label}</span>
            {o.hint && <span className="text-xs text-muted block mt-0.5">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
