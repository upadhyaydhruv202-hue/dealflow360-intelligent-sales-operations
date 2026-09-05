import type { Request } from 'express';

export function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function userOrIp(req: Request): string {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  return `ip:${clientIp(req)}`;
}
