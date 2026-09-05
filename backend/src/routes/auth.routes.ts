import { Router, type RequestHandler } from 'express';

import { API_ROUTE_PATHS } from '../constants';
import type { AuthController } from '../controllers/auth.controller';

export function createAuthRouter(options: {
  controller: AuthController;
  authenticate: RequestHandler;
  loginRateLimit: RequestHandler;
  otpRateLimit: RequestHandler;
  passwordResetRateLimit: RequestHandler;
  publicRateLimit: RequestHandler;
  authenticationRateLimit: RequestHandler;
}): Router {
  const router = Router();
  const publicAuth = [options.publicRateLimit, options.authenticationRateLimit];

  router.post(API_ROUTE_PATHS.auth.register, ...publicAuth, options.controller.register);
  router.post(API_ROUTE_PATHS.auth.login, options.loginRateLimit, options.controller.login);
  router.post(API_ROUTE_PATHS.auth.refresh, ...publicAuth, options.controller.refresh);
  router.post(API_ROUTE_PATHS.auth.logout, ...publicAuth, options.controller.logout);
  router.get(API_ROUTE_PATHS.auth.me, options.authenticate, options.controller.me);
  router.post(API_ROUTE_PATHS.auth.otpRequest, options.otpRateLimit, options.controller.requestOtp);
  router.post(API_ROUTE_PATHS.auth.otpVerify, options.otpRateLimit, options.controller.verifyOtp);
  router.post(
    API_ROUTE_PATHS.auth.passwordResetRequest,
    options.passwordResetRateLimit,
    options.controller.requestPasswordReset,
  );
  router.post(
    API_ROUTE_PATHS.auth.passwordResetConfirm,
    options.passwordResetRateLimit,
    options.controller.confirmPasswordReset,
  );

  return router;
}
