import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3, '帳號至少 3 個字元').max(20, '帳號最多 20 個字元'),
  password: z.string().min(8, '密碼至少需 8 碼'),
  email: z.string().email('信箱格式錯誤'),
  note: z.string().optional(),
  inviteProjectId: z.number().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { username, password, email, note, inviteProjectId } = parsed.data;

    const db = getDb();
    
    // 檢查是否已有相同帳號的正式 user 或審核中的表單
    const existingUser = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [username]
    });
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: '此帳號已存在' }, { status: 400 });
    }

    const existingApp = await db.execute({
      sql: 'SELECT id FROM registration_applications WHERE username = ? AND status = ?',
      args: [username, 'pending']
    });
    if (existingApp.rows.length > 0) {
      return NextResponse.json({ error: '此帳號已在審核中，請勿重複提交' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    if (inviteProjectId) {
      // 方案一：有邀請碼，直接進站並綁定 Channel，不經過審核
      const userRes = await db.execute({
        sql: `INSERT INTO users (username, password_hash, email, role, status) VALUES (?, ?, ?, 'member', 'active')`,
        args: [username, passwordHash, email]
      });
      const newUserId = userRes.lastInsertRowid?.toString();
      
      if (newUserId) {
        // 1. 綁定受邀頻道
        await db.execute({
          sql: `INSERT INTO project_members (project_id, user_id) VALUES (?, ?)`,
          args: [inviteProjectId, newUserId]
        });

        // 2. 額外綁定全域歡迎頻道 (比照後台手動建立邏輯)
        const welcomeProjects = await db.execute(`SELECT id FROM projects WHERE is_global_welcome = 1`);
        for (const p of welcomeProjects.rows) {
          // 避免重複插入（如果 inviteProjectId 剛好就是全域頻道）
          if (Number(p.id) !== Number(inviteProjectId)) {
            await db.execute({
              sql: 'INSERT INTO project_members (project_id, user_id) VALUES (?, ?)',
              args: [p.id, newUserId]
            });
          }
        }
      }

      return NextResponse.json({ success: true, message: '註冊成功！系統已為您開通專屬 Channel 存取權，請直接登入' });
    } else {
      // 原流程：送審機制
      await db.execute({
        sql: `INSERT INTO registration_applications (username, password_hash, email, note) VALUES (?, ?, ?, ?)`,
        args: [username, passwordHash, email, note || '']
      });

      return NextResponse.json({ success: true, message: '您的申請已送出，請等待管理員審核' });
    }
  } catch (error: any) {
    console.error('Register error:', error);
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: '此帳號或 Email 已被使用' }, { status: 400 });
    }
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
