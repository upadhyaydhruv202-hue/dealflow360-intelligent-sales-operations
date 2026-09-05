import { createHmac, timingSafeEqual } from 'node:crypto';

export function hashOtp(secret: string, purpose: string, destination: string, code: string): string {
  return createHmac('sha256', secret)
    .update(`${purpose}:${normalizeDestination(destination)}:${code}`)
    .digest('hex');
}

export function otpHashesEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizeDestination(destination: string): string {
  return destination.trim().toLowerCase();
}
