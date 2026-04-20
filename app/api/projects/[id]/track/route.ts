import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 });

    // 檢查目標頻道是否存在
    const db = await getDb();
    const res = await db.execute({
      sql: 'SELECT id FROM projects WHERE id = ?',
      args: [params.id]
    });

    if (res.rows.length === 0) {
      return NextResponse.json({ error: '找不到頻道' }, { status: 404 });
    }

    // 更新最新檢視時間
    await db.execute({
      sql: 'UPDATE projects SET last_viewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [params.id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
