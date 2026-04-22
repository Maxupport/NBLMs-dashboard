import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const db = await getDb();

    // Admin 可直接刪除；否則須驗證此連結所屬專案的 owner_id 是否為當前使用者
    let canDelete = false;
    if (user.role === 'admin') {
      canDelete = true;
    } else {
      const res = await db.execute({
        sql: `
          SELECT 1 FROM notebook_links nl
          JOIN projects p ON nl.project_id = p.id
          WHERE nl.id = ? 
          AND (
            p.owner_id = ? 
            OR p.parent_id IN (SELECT id FROM projects WHERE owner_id = ?)
            OR nl.project_id IN (SELECT project_id FROM project_members WHERE user_id = ? AND role = 'editor')
            OR p.parent_id IN (SELECT project_id FROM project_members WHERE user_id = ? AND role = 'editor')
          )
        `,
        args: [params.id, user.sub, user.sub, user.sub, user.sub]
      });
      if (res.rows.length > 0) canDelete = true;
    }

    if (!canDelete) return NextResponse.json({ error: '只有頻道建立者、協作者或管理員可以刪除連結' }, { status: 403 });

    await db.execute({
      sql: 'DELETE FROM notebook_links WHERE id = ?',
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

    const body = await request.json();
    const { title, url, description, category } = body;
    if (!title || !url) return NextResponse.json({ error: '標題與網址不得為空' }, { status: 400 });

    const db = await getDb();

    let canEdit = false;
    if (user.role === 'admin') {
      canEdit = true;
    } else {
      const res = await db.execute({
        sql: `
          SELECT 1 FROM notebook_links nl
          JOIN projects p ON nl.project_id = p.id
          WHERE nl.id = ? 
          AND (
            p.owner_id = ? 
            OR p.parent_id IN (SELECT id FROM projects WHERE owner_id = ?)
            OR nl.project_id IN (SELECT project_id FROM project_members WHERE user_id = ? AND role = 'editor')
            OR p.parent_id IN (SELECT project_id FROM project_members WHERE user_id = ? AND role = 'editor')
          )
        `,
        args: [params.id, user.sub, user.sub, user.sub, user.sub]
      });
      if (res.rows.length > 0) canEdit = true;
    }

    if (!canEdit) return NextResponse.json({ error: '只有頻道建立者、協作者或管理員可以編輯連結' }, { status: 403 });

    await db.execute({
      sql: 'UPDATE notebook_links SET title = ?, url = ?, description = ?, category = ? WHERE id = ?',
      args: [title, url, description || '', category || 'other', params.id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
