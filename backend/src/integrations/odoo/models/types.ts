import type { AuthenticatedUser } from '../../../auth/types';
import type { OdooPage } from '../odoo.operations';
import type {
  OdooCallMethodInput,
  OdooCreateInput,
  OdooPagedSearchReadInput,
  OdooReadInput,
  OdooRecord,
  OdooSearchInput,
  OdooSearchReadInput,
  OdooUnlinkInput,
  OdooWriteInput,
} from '../odoo.schemas';

export interface OdooCallerContext {
  user?: AuthenticatedUser;
  internal?: boolean;
  confirmed?: boolean;
}

export type AdapterSearchInput = Omit<OdooSearchInput, 'model'> & OdooCallerContext;
export type AdapterSearchReadInput = Omit<OdooSearchReadInput, 'model'> & OdooCallerContext;
export type AdapterPagedSearchReadInput = Omit<OdooPagedSearchReadInput, 'model'> & OdooCallerContext;
export type AdapterReadInput = Omit<OdooReadInput, 'model'> & OdooCallerContext;
export type AdapterCreateInput = Omit<OdooCreateInput, 'model'> & OdooCallerContext;
export type AdapterWriteInput = Omit<OdooWriteInput, 'model'> & OdooCallerContext;
export type AdapterUnlinkInput = Omit<OdooUnlinkInput, 'model'> & OdooCallerContext;
export type AdapterCallMethodInput = Omit<OdooCallMethodInput, 'model'> & OdooCallerContext;

export interface OdooModelAdapter<TRecord extends OdooRecord = OdooRecord> {
  readonly model: string;
  search(input?: AdapterSearchInput): Promise<number[]>;
  searchRead(input?: AdapterSearchReadInput): Promise<TRecord[]>;
  searchReadPaged(input?: AdapterPagedSearchReadInput): Promise<OdooPage<TRecord>>;
  read(input: AdapterReadInput): Promise<TRecord[]>;
  create(input: AdapterCreateInput): Promise<number[]>;
  write(input: AdapterWriteInput): Promise<boolean>;
  unlink(input: AdapterUnlinkInput): Promise<boolean>;
  callMethod<T = unknown>(input: AdapterCallMethodInput): Promise<T>;
}
