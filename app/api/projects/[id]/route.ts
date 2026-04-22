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

    const db = await getDb();
    
    // 1. Get Ghost user ID
    const ghostRes = await db.execute("SELECT id FROM users WHERE username = 'Ghost' LIMIT 1");
    const ghostId = ghostRes.rows[0]?.id;
    if (!ghostId) return NextResponse.json({ error: '系統錯誤：找不到 Ghost 虛擬帳號' }, { status: 500 });

    // 2. Check the project
    const projectRes = await db.execute({
      sql: 'SELECT owner_id, is_global_welcome FROM projects WHERE id = ?',
      args: [params.id]
    });
    
    if (projectRes.rows.length === 0) {
      return NextResponse.json({ error: '找不到該頻道' }, { status: 404 });
    }
    
    const project = projectRes.rows[0];
    const isOwner = project.owner_id?.toString() === user.sub.toString();
    const isAdmin = user.role === 'admin';
    
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: '拒絕存取：只有頻道建立者或管理員可操作' }, { status: 403 });
    }

    if (project.is_global_welcome === 1 && !isAdmin) {
      return NextResponse.json({ error: '系統保護：全域歡迎頻道僅能由管理員移除' }, { status: 403 });
    }

    if (isAdmin) {
      // Admin deletes permanently
      // Recursive delete for sub-channels
      const subChannelsRes = await db.execute({
        sql: 'SELECT id FROM projects WHERE parent_id = ?',
        args: [params.id]
      });
      for (const sub of subChannelsRes.rows) {
        await db.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [sub.id] });
      }
      await db.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [params.id] });
      return NextResponse.json({ success: true, message: '頻道已永久刪除' });
    } else {
      // General user: Transfer ownership to Ghost (Soft Delete)
      
      // Update sub-channels first
      await db.execute({
        sql: "UPDATE projects SET owner_id = ?, status = 'archived' WHERE parent_id = ?",
        args: [ghostId, params.id]
      });

      // Update the main project
      await db.execute({
        sql: "UPDATE projects SET owner_id = ?, status = 'archived' WHERE id = ?",
        args: [ghostId, params.id]
      });

      // IMPORTANT: Remove all members to ensure original owner/collaborators can't see it anymore
      await db.execute({
        sql: "DELETE FROM project_members WHERE project_id = ? OR project_id IN (SELECT id FROM projects WHERE parent_id = ?)",
        args: [params.id, params.id]
      });

      return NextResponse.json({ success: true, message: '頻道已從您的清單中移除並歸還配額' });
    }
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
    if (!allowed) return NextResponse.json({ error: '拒絕存取：只有頻道建立者或管理員可修改' }, { status: 403 });

    const body = await request.json();
    const { name, description, parent_id, color } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: '頻道名稱不得為空' }, { status: 400 });
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
