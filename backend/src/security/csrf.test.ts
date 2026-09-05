import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { ACCESS_COOKIE_NAME } from '../auth/session-cookies';
import { loadConfig } from '../config';
import { ERROR_CODES } from '../constants';
import { errorHandler } from '../middleware';
import { cookieCsrfProtection, isTrustedOrigin, originFromReferer, parseCookiesMiddleware } from './index';

function csrfApp() {
  const config = loadConfig({
    NODE_ENV: 'test',
    CORS_ORIGINS: 'http://localhost:5173',
    APP_URL: 'http://localhost:5000',
    FRONTEND_URL: 'http://localhost:5173',
  });
  const app = express();
  app.use(parseCookiesMiddleware());
  app.use(cookieCsrfProtection(config));
  app.use(express.json());
  app.post('/mutate', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/safe', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return app;
}

describe('cookie CSRF protection', () => {
  it('allows Bearer mutating requests without an Origin', async () => {
    const response = await request(csrfApp())
      .post('/mutate')
      .set('Authorization', 'Bearer test-token')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=cookie-token`)
      .send({});
    expect(response.status).toBe(200);
  });

  it('rejects cookie-only mutating requests without a trusted origin', async () => {
    const missing = await request(csrfApp())
      .post('/mutate')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=cookie-token`)
      .send({});
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);

    const untrusted = await request(csrfApp())
      .post('/mutate')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=cookie-token`)
      .set('Origin', 'https://evil.example')
      .send({});
    expect(untrusted.status).toBe(403);
  });

  it('allows cookie-only mutating requests from a trusted origin or referer', async () => {
    const fromOrigin = await request(csrfApp())
      .post('/mutate')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=cookie-token`)
      .set('Origin', 'http://localhost:5173')
      .send({});
    expect(fromOrigin.status).toBe(200);

    const fromReferer = await request(csrfApp())
      .post('/mutate')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=cookie-token`)
      .set('Referer', 'http://localhost:5173/app')
      .send({});
    expect(fromReferer.status).toBe(200);
  });

  it('does not apply to safe methods or requests without session cookies', async () => {
    const get = await request(csrfApp())
      .get('/safe')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=cookie-token`);
    expect(get.status).toBe(200);

    const anonymous = await request(csrfApp()).post('/mutate').send({});
    expect(anonymous.status).toBe(200);
  });
});

describe('origin helpers', () => {
  it('extracts an origin from a referer and matches configured origins', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      CORS_ORIGINS: 'http://localhost:5173',
      APP_URL: 'http://localhost:5000',
      FRONTEND_URL: 'http://localhost:5173',
    });
    expect(originFromReferer('http://localhost:5173/login?next=/')).toBe('http://localhost:5173');
    expect(isTrustedOrigin('http://localhost:5173', config)).toBe(true);
    expect(isTrustedOrigin('http://localhost:5000', config)).toBe(true);
    expect(isTrustedOrigin('https://evil.example', config)).toBe(false);
    expect(isTrustedOrigin(undefined, config)).toBe(false);
  });
});
