export {};

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    user?: import('./auth/types').AuthenticatedUser;
  }
}
