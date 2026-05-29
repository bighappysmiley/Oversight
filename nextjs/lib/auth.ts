import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'oversight-dev-secret-change-in-prod';

export function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function getAuthToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export function getParentFromRequest(req: NextRequest): any | null {
  const token = getAuthToken(req);
  if (!token) return null;
  return verifyToken(token);
}

export function getDeviceTokenFromRequest(req: NextRequest): string | null {
  return req.headers.get('x-device-token');
}
