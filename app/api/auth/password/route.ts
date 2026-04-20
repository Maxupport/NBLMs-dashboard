import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { getUserFromRequest, verifyPassword, hashPassword } from '@/lib/auth';

const pwdSchema = z.object({
  oldPassword: z.string().min(1, '舊密碼不得為空'),
  newPassword: z.string().min(8, '新密碼至少需 8 碼')
});

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '拒絕存取' }, { status: 401 });

    const body = await request.json();
    const parsed = pwdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { oldPassword, newPassword } = parsed.data;

    const db = await getDb();
    
    // Check old password
    const res = await db.execute({
      sql: 'SELECT password_hash FROM users WHERE id = ?',
      args: [user.sub]
    });
    const dbUser = res.rows[0] as any;
    if (!dbUser) return NextResponse.json({ error: '使用者不存在' }, { status: 404 });

    const isValid = await verifyPassword(oldPassword, dbUser.password_hash);
    if (!isValid) return NextResponse.json({ error: '舊密碼不正確' }, { status: 400 });

    // Hash new password and update BOTH hash and raw
    const newHash = await hashPassword(newPassword);
    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, raw_password = ? WHERE id = ?',
      args: [newHash, newPassword, user.sub]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
