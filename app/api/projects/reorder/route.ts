import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

const reorderSchema = z.object({
  orderedIds: z.array(z.number())
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

    const { orderedIds } = parsed.data;
    const db = getDb();

    // Perform batch updates
    // For simplicity with libSQL, we'll run multiple queries in a transaction if possible, 
    // but here we can just update them sequentially or use a single transaction statement.
    const statements = orderedIds.map((id, index) => ({
      sql: 'UPDATE projects SET sort_order = ? WHERE id = ?',
      args: [index + 1, id]
    }));

    await db.batch(statements);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
