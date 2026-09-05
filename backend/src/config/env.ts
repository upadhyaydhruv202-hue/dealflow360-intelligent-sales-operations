import path from 'node:path';

import dotenv from 'dotenv';

const CANDIDATE_ENV_PATHS = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

export function loadEnvFiles(): void {
  for (const envPath of CANDIDATE_ENV_PATHS) {
    dotenv.config({ path: envPath });
  }
}
