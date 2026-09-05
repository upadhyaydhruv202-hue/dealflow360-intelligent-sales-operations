export type ClassValue = string | false | null | undefined | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) {
        classes.push(nested);
      }
      continue;
    }

    classes.push(value);
  }

  return classes.join(' ');
}
