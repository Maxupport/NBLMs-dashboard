import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

async function checkAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    if (!await checkAdmin(request)) {
      return NextResponse.json({ error: '拒絕存取' }, { status: 403 });
    }

    const { id } = params;
    const db = await getDb();
    
    // 檢查是否為管理員，防止刪除管理員自身（安全保護）
    const targetUser = await db.execute({
      sql: 'SELECT role FROM users WHERE id = ?',
      args: [id]
    });

    if (targetUser.rows.length === 0) {
      return NextResponse.json({ error: '找不到該使用者' }, { status: 404 });
    }

    if ((targetUser.rows[0] as any).role === 'admin') {
      return NextResponse.json({ error: '系統保護：無法刪除管理員帳號' }, { status: 400 });
    }

    await db.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [id]
    });

    return NextResponse.json({ success: true, message: '使用者帳號及其所有相關資料已全數刪除' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
