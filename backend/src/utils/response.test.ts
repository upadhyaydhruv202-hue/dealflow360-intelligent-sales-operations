import { errorResponseSchema, unknownSuccessResponseSchema } from '@hackathon/api-contract';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { sendError, sendSuccess } from './response';

describe('API response helpers', () => {
  it('sends the standard success envelope', async () => {
    const app = express();
    app.get('/ok', (_req, res) => {
      sendSuccess(res, { id: 1 }, 201, { page: 1 });
    });

    const response = await request(app).get('/ok');
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { id: 1 },
      meta: { page: 1 },
    });
    expect(unknownSuccessResponseSchema.parse(response.body)).toEqual(response.body);
  });

  it('sends the standard error envelope', async () => {
    const app = express();
    app.get('/fail', (_req, res) => {
      sendError(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'email' },
        requestId: 'req-1',
      });
    });

    const response = await request(app).get('/fail');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'email' },
      },
      requestId: 'req-1',
    });
    expect(errorResponseSchema.parse(response.body)).toEqual(response.body);
  });
});
