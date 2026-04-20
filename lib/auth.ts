import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'notebooklm-dashboard-super-secret-key-2024'
);
const ALGORITHM = 'HS256';
const EXPIRES_IN = '7d';

// ── 密碼工具 ──────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * 產生隨機強密碼（12位，含大小寫英文、數字、特殊符號）
 */
export function generateStrongPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  const getRand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  // 確保每種類別至少一個
  const required = [
    getRand(upper),
    getRand(upper),
    getRand(lower),
    getRand(lower),
    getRand(digits),
    getRand(digits),
    getRand(special),
  ];

  // 補滿至 12 位
  const rest = Array.from({ length: 5 }, () => getRand(all));
  const password = [...required, ...rest].sort(() => Math.random() - 0.5).join('');
  return password;
}

// ── JWT 工具 ──────────────────────────────────────────────
export interface JwtPayload {
  sub: string;       // user id (string)
  username: string;
  role: string;
}

export async function createToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// ── 從 Request Cookie 取得使用者 ──────────────────────────
export async function getUserFromRequest(request: Request): Promise<JwtPayload | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
  if (!tokenMatch) return null;
  return verifyToken(decodeURIComponent(tokenMatch[1]));
}
