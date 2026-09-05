export const REQUEST_ID = {
  HEADER: 'x-request-id',
  MAX_LENGTH: 128,
  PATTERN: /^[\w.:-]{1,128}$/,
} as const;
