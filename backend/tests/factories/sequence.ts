let sequence = 0;

export function nextSeq(): number {
  sequence += 1;
  return sequence;
}

export function uniqueLabel(prefix: string): string {
  return `${prefix}${nextSeq()}`;
}
