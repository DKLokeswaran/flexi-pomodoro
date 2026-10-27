import { useId } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
  const inputId = useId();

  return (
    <Field className="gap-2 text-left">
      <FieldLabel
        htmlFor={inputId}
        className="type-label font-normal text-muted-foreground"
      >
        {label}
      </FieldLabel>
      <Input
        id={inputId}
        type="number"
        step={step}
        min={min ?? step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}
