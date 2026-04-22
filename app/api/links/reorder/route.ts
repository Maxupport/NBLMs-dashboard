import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

const reorderSchema = z.object({
  orderedIds: z.array(z.number()),
  projectId: z.number()
});

export async function PATCH(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: '無效的資料格式' }, { status: 400 });
    }

    const { orderedIds, projectId } = parsed.data;

    const db = await getDb();

    // Verification: admin or project owner
    let canReorder = false;
    if (user.role === 'admin') {
      canReorder = true;
    } else {
      const res = await db.execute({
        sql: 'SELECT 1 FROM projects WHERE id = ? AND owner_id = ?',
        args: [projectId, user.sub]
      });
      if (res.rows.length > 0) canReorder = true;
    }

    if (!canReorder) return NextResponse.json({ error: '拒絕存取，只有管理員或建立者可以重新排序' }, { status: 403 });

    // Update sort_order based on array index
    const statements = orderedIds.map((id, index) => ({
      sql: 'UPDATE notebook_links SET sort_order = ? WHERE id = ? AND project_id = ?',
      args: [index, id, projectId]
    }));

    if (statements.length > 0) {
      // Execute in a transaction for safety
      await db.batch(statements, 'write');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder links error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
