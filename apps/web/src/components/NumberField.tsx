export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <div className="field">
      <label>
        {label}
        <input
          type="number"
          step={step}
          min={min ?? step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
