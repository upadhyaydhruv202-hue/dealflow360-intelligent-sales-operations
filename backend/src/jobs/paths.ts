import { JOBS } from '../constants';
import { resolveLocalStorageDir } from '../integrations/storage/storage.keys';

export function resolveJobsDir(jobsDir = JOBS.FILE_DIR): string {
  return resolveLocalStorageDir(jobsDir);
}
