import styles from "./NumberField.module.css";

/** Labeled numeric input; min defaults to step when not provided. */
export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <div className={styles.field}>
      <label>
        {label}
        <input
          type="number"
          step={step}
          min={min ?? step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
    </div>
  );
}
