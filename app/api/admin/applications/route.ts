import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

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

    const db = await getDb();
    const res = await db.execute('SELECT * FROM registration_applications ORDER BY created_at DESC');
    
    return NextResponse.json({ applications: res.rows });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!await checkAdmin(request)) {
      return NextResponse.json({ error: '拒絕存取' }, { status: 403 });
    }

    const { id, action } = await request.json();
    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '無效的請求' }, { status: 400 });
    }

    const db = await getDb();
    const res = await db.execute({
      sql: 'SELECT * FROM registration_applications WHERE id = ?',
      args: [id]
    });
    const app = res.rows[0] as any;

    if (!app) {
      return NextResponse.json({ error: '找不到該申請' }, { status: 404 });
    }

    if (app.status !== 'pending') {
      return NextResponse.json({ error: '該申請已處理過' }, { status: 400 });
    }

    if (action === 'approve') {
      // libSQL Transaction 採 batch 或 Promise.all 如果沒有嚴格前後相依，
      // 但我們可以用 executeMultiple 或兩個獨立 execute。
      await db.execute({
        sql: 'UPDATE registration_applications SET status = ? WHERE id = ?',
        args: ['approved', id]
      });
      
      const userResult = await db.execute({
        sql: 'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        args: [app.username, app.password_hash, 'member']
      });
      
      const newUserId = userResult.lastInsertRowid;
      
      // Auto-grant access to the global welcome project
      const welcomeProjects = await db.execute(`
        SELECT id FROM projects WHERE is_global_welcome = 1
      `);
      
      if (newUserId) {
        for (const p of welcomeProjects.rows) {
          await db.execute({
            sql: 'INSERT INTO project_members (project_id, user_id) VALUES (?, ?)',
            args: [p.id, newUserId]
          });
        }
      }

      return NextResponse.json({ success: true, message: '已核准並建立帳號，並自動授權進入全域歡迎區' });
    } else {
      await db.execute({
        sql: 'UPDATE registration_applications SET status = ? WHERE id = ?',
        args: ['rejected', id]
      });
      return NextResponse.json({ success: true, message: '已拒絕該申請' });
    }

  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: '該帳號已被其他人註冊使用' }, { status: 400 });
    }
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
