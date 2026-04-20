import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '拒絕存取' }, { status: 401 });

    const db = getDb();
    
    // 檢查權限：只有 admin 或「該留言的發表者」可以刪除
    const fbRes = await db.execute({
      sql: 'SELECT user_id FROM feedbacks WHERE id = ?',
      args: [params.id]
    });
    
    const fb = fbRes.rows[0];
    if (!fb) return NextResponse.json({ error: '找不到該留言' }, { status: 404 });

    if (user.role !== 'admin' && fb.user_id?.toString() !== user.sub) {
      return NextResponse.json({ error: '您沒有權限刪除此留言' }, { status: 403 });
    }

    await db.execute({
      sql: 'DELETE FROM feedbacks WHERE id = ?',
      args: [params.id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
