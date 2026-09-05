import type { Express } from 'express';
import request from 'supertest';

import { TEST_PASSWORD } from '../factories/constants';

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function registerSession(
  app: Express,
  email: string,
  options: { password?: string; displayName?: string } = {},
) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password: options.password ?? TEST_PASSWORD,
      displayName: options.displayName ?? email.split('@')[0],
    });

  return {
    response,
    status: response.status,
    user: response.body.data?.user as { id: string; email: string; roles: string[]; permissions: string[] } | undefined,
    tokens: response.body.data?.tokens as { accessToken: string; refreshToken: string } | undefined,
  };
}

export async function loginSession(app: Express, email: string, password = TEST_PASSWORD) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  return {
    response,
    status: response.status,
    tokens: response.body.data?.tokens as { accessToken: string; refreshToken: string } | undefined,
  };
}
