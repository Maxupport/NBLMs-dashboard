import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '拒絕存取' }, { status: 401 });

    const db = getDb();
    const res = await db.execute(`
      SELECT f.id, f.content, f.created_at, u.username, u.role, f.user_id 
      FROM feedbacks f
      LEFT JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
    `);
    
    return NextResponse.json({ feedbacks: res.rows });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

const feedbackSchema = z.object({
  content: z.string().min(1, '留言不得為空').max(2000, '留言過長')
});

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

    const db = getDb();
    // 檢查留言板是否開啟
    const stRes = await db.execute("SELECT value FROM system_settings WHERE key = 'feedback_board_open'");
    if (stRes.rows[0]?.value !== 'true') {
      return NextResponse.json({ error: '留言板目前已關閉' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { content } = parsed.data;

    await db.execute({
      sql: 'INSERT INTO feedbacks (user_id, content) VALUES (?, ?)',
      args: [user.sub, content]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
