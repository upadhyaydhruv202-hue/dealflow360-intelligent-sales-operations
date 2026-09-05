import { z } from 'zod';

export const successMetaSchema = z.record(z.unknown());

export type SuccessMeta = z.infer<typeof successMetaSchema>;

export const errorDetailsSchema = z.union([z.record(z.unknown()), z.array(z.unknown())]);

export type ErrorDetails = z.infer<typeof errorDetailsSchema>;

export const errorBodySchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  details: errorDetailsSchema,
});

export type ErrorBody = z.infer<typeof errorBodySchema>;

export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: successMetaSchema,
  });

export const unknownSuccessResponseSchema = successResponseSchema(z.unknown());

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: errorBodySchema,
  requestId: z.string().min(1),
});

export const apiResponseSchema = z.union([unknownSuccessResponseSchema, errorResponseSchema]);

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: SuccessMeta;
}

export interface ErrorResponse {
  success: false;
  error: ErrorBody;
  requestId: string;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function createSuccessEnvelope<T>(data: T, meta: SuccessMeta = {}): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

export function createErrorEnvelope(options: {
  code: string;
  message: string;
  details?: ErrorDetails;
  requestId: string;
}): ErrorResponse {
  return {
    success: false,
    error: {
      code: options.code,
      message: options.message,
      details: options.details ?? {},
    },
    requestId: options.requestId,
  };
}

export function isSuccessResponse<T>(value: unknown): value is SuccessResponse<T> {
  return unknownSuccessResponseSchema.safeParse(value).success;
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return errorResponseSchema.safeParse(value).success;
}

export function parseApiResponse<T>(value: unknown): ApiResponse<T> {
  return apiResponseSchema.parse(value) as ApiResponse<T>;
}
