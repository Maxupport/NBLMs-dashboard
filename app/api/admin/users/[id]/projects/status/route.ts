import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

async function checkAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    if (!await checkAdmin(request)) {
      return NextResponse.json({ error: '拒絕存取' }, { status: 403 });
    }

    const { status } = await request.json(); // 'active' or 'disabled'

    if (status !== 'active' && status !== 'disabled') {
      return NextResponse.json({ error: '無效的狀態' }, { status: 400 });
    }

    const db = getDb();
    
    // Prevent disabling admin's projects through this endpoint just to be safe
    const userRes = await db.execute({
      sql: 'SELECT role FROM users WHERE id = ?',
      args: [params.id]
    });
    
    if (userRes.rows[0]?.role === 'admin') {
      return NextResponse.json({ error: '無法停用管理員的頻道' }, { status: 403 });
    }

    await db.execute({
      sql: 'UPDATE projects SET status = ? WHERE owner_id = ?',
      args: [status, params.id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
