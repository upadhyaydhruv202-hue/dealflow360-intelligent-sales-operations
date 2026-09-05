import { useStableId } from '../hooks';
import { cn } from '../cn';
import { errorClass, focusRing, helpClass, labelClass } from '../styles';

export interface RadioOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  options: RadioOption[];
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function RadioGroup({
  name,
  label,
  value,
  defaultValue,
  options,
  onChange,
  error,
  hint,
  disabled,
  className,
}: RadioGroupProps) {
  const groupId = useStableId('radio', name);

  return (
    <fieldset className={cn('space-y-2', className)} disabled={disabled}>
      {label ? (
        <legend id={groupId} className={labelClass}>
          {label}
        </legend>
      ) : null}
      {hint && !error ? <p className={helpClass}>{hint}</p> : null}
      <div role="radiogroup" aria-labelledby={label ? groupId : undefined} className="space-y-2">
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`;
          return (
            <label key={option.value} className="flex items-start gap-2 text-sm text-foreground" htmlFor={optionId}>
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                className={cn('mt-0.5 h-4 w-4 border-edge accent-accent', focusRing)}
                checked={value !== undefined ? value === option.value : undefined}
                defaultChecked={value === undefined ? defaultValue === option.value : undefined}
                disabled={disabled || option.disabled}
                onChange={() => onChange?.(option.value)}
              />
              <span>
                {option.label}
                {option.hint ? <span className={cn(helpClass, 'mt-0 block')}>{option.hint}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className={errorClass} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
