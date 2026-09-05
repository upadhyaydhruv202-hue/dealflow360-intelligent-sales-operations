import type { PaginationMeta } from '@hackathon/api-contract';

import { PAGINATION } from '../../constants';
import { ValidationError } from '../../errors';
import { paginationQuerySchema } from '../../schemas/common';
import { issuesFromZodError } from '../../schemas/parse';

export const DEFAULT_PAGE = PAGINATION.DEFAULT_PAGE;
export const DEFAULT_PAGE_SIZE = PAGINATION.DEFAULT_PAGE_SIZE;
export const MAX_PAGE_SIZE = PAGINATION.MAX_PAGE_SIZE;

export interface PaginationInput {
  page?: number | string;
  pageSize?: number | string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export type PageMeta = PaginationMeta;

export interface PaginatedResult<T> {
  items: T[];
  meta: PageMeta;
}

export function parsePagination(input: PaginationInput = {}): PaginationParams {
  const parsed = paginationQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid pagination query', issuesFromZodError(parsed.error, 'query'));
  }

  const { page, pageSize } = parsed.data;
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPageMeta(params: PaginationParams, totalItems: number): PageMeta {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / params.pageSize);

  return {
    page: params.page,
    pageSize: params.pageSize,
    totalItems,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1 && totalPages > 0,
  };
}

export function toPaginatedResult<T>(
  items: T[],
  params: PaginationParams,
  totalItems: number,
): PaginatedResult<T> {
  return {
    items,
    meta: buildPageMeta(params, totalItems),
  };
}
