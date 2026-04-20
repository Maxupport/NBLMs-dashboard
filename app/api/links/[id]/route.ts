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
          WHERE nl.id = ? AND p.owner_id = ?
        `,
        args: [params.id, user.sub]
      });
      if (res.rows.length > 0) canDelete = true;
    }

    if (!canDelete) return NextResponse.json({ error: '只有專案建立者或管理員可以刪除連結' }, { status: 403 });

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
