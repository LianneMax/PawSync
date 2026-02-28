/**
 * nfcAuth middleware — validates the x-nfc-secret shared secret header.
 *
 * The local NFC agent sends this header on every request. The backend
 * compares it against NFC_SECRET from the environment using a
 * constant-time comparison to prevent timing attacks.
 */

import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  // timingSafeEqual requires equal-length buffers
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function nfcAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.NFC_SECRET;

  if (!secret) {
    res.status(500).json({ success: false, message: 'NFC_SECRET not configured on server' });
    return;
  }

  const provided = req.headers['x-nfc-secret'];

  if (typeof provided !== 'string' || !safeCompare(provided, secret)) {
    res.status(401).json({ success: false, message: 'Invalid or missing x-nfc-secret' });
    return;
  }

  next();
}
