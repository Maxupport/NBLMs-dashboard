import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, createToken } from '@/lib/auth';

import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, '請填寫帳號'),
  password: z.string().min(1, '請填寫密碼')
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { username, password } = parsed.data;

    const db = await getDb();
    const res = await db.execute({
      sql: 'SELECT id, username, password_hash, role, status FROM users WHERE username = ?',
      args: [username]
    });
    const user = res.rows[0] as any;

    if (!user) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
    }

    if (user.status === 'disabled') {
       return NextResponse.json({ error: '您的帳號已被停用，請聯絡管理員' }, { status: 403 });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
    }

    // 登入成功，更新最後登入時間
    await db.execute({
      sql: "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [user.id]
    });

    // 產生 JWT token
    const token = await createToken({
      sub: user.id.toString(),
      username: user.username,
      role: user.role,
    });

    // 設定 Cookie
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role }
    });

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
