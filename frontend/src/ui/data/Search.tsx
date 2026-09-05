import { type FormEvent, type InputHTMLAttributes } from 'react';

import { cn } from '../cn';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';

export interface SearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  value: string;
  onChange: (value: string) => void;
  onSubmitSearch?: (value: string) => void;
  loading?: boolean;
}

export function Search({
  value,
  onChange,
  onSubmitSearch,
  loading = false,
  placeholder = 'Search',
  className,
  ...props
}: SearchProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmitSearch?.(value.trim());
  }

  return (
    <form role="search" className={cn('flex w-full items-end gap-2', className)} onSubmit={handleSubmit}>
      <Input
        label={props['aria-label'] ? undefined : 'Search'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        autoComplete="off"
        {...props}
      />
      <Button type="submit" loading={loading}>
        Search
      </Button>
    </form>
  );
}
