import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest, hashPassword, generateStrongPassword } from '@/lib/auth';

// 權限檢查 Middleware 概念
async function checkAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET(request: Request) {
  try {
    if (!await checkAdmin(request)) {
      return NextResponse.json({ error: '拒絕存取' }, { status: 403 });
    }

    const db = getDb();
    const res = await db.execute(`
      SELECT u.id, u.username, u.role, u.created_at, u.status, u.last_login_at,
             (SELECT COUNT(*) FROM projects WHERE owner_id = u.id) as channel_count
      FROM users u 
      ORDER BY u.created_at DESC
    `);
    
    return NextResponse.json({ users: res.rows });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

import { z } from 'zod';

const userSchema = z.object({
  username: z.string().min(3, '帳號至少 3 個字元').max(20, '帳號最多 20 個字元'),
  role: z.enum(['admin', 'member']).optional()
});

export async function POST(request: Request) {
  try {
    if (!await checkAdmin(request)) {
      return NextResponse.json({ error: '拒絕存取' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = userSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { username, role } = parsed.data;

    const db = getDb();
    const existingUser = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [username]
    });
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: '此帳號已存在' }, { status: 400 });
    }

    const password = generateStrongPassword();
    const passwordHash = await hashPassword(password);

    const result = await db.execute({
      sql: `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
      args: [username, passwordHash, role || 'member']
    });

    const newUserId = result.lastInsertRowid;
    if (newUserId && role === 'member') {
      const welcomeProjects = await db.execute(`
        SELECT id FROM projects WHERE is_global_welcome = 1
      `);
      for (const p of welcomeProjects.rows) {
        await db.execute({
          sql: 'INSERT INTO project_members (project_id, user_id) VALUES (?, ?)',
          args: [p.id, newUserId]
        });
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: result.lastInsertRowid?.toString(),
        username,
        role: role || 'member',
        generatedPassword: password // 僅在建立的當下回傳，讓管理員可以複製給對方
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
