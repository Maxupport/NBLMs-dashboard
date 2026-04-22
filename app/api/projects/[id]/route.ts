import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// Helper: check if user is owner or admin
async function isOwnerOrAdmin(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === 'admin') return true;
  const db = await getDb();
  const res = await db.execute({
    sql: `
      SELECT 1 FROM projects 
      WHERE id = ? AND (owner_id = ? OR parent_id IN (SELECT id FROM projects WHERE owner_id = ?))
    `,
    args: [projectId, userId, userId]
  });
  return res.rows.length > 0;
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const allowed = await isOwnerOrAdmin(user.sub, user.role, params.id);
    if (!allowed) return NextResponse.json({ error: '拒絕存取：只有專案建立者或管理員可刪除' }, { status: 403 });

    const db = await getDb();
    await db.execute({
      sql: 'DELETE FROM projects WHERE id = ?',
      args: [params.id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const allowed = await isOwnerOrAdmin(user.sub, user.role, params.id);
    if (!allowed) return NextResponse.json({ error: '拒絕存取：只有專案建立者或管理員可修改' }, { status: 403 });

    const body = await request.json();
    const { name, description, parent_id, color } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: '專案名稱不得為空' }, { status: 400 });
    }

    const db = await getDb();
    await db.execute({
      sql: 'UPDATE projects SET name = ?, description = ?, parent_id = ?, color = ? WHERE id = ?',
      args: [name.trim(), description || '', parent_id !== undefined ? parent_id : null, color || '#6366f1', params.id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
