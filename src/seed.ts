import { randomUUID } from 'node:crypto';
import { getPool } from './db';

/**
 * Seed sample categories + activities only if categories table is empty.
 * Amounts chosen so the three statuses (On Track / Warning / Exceeded) are
 * all visible at first load.
 */
export async function seedIfEmpty(): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM categories');
  if (Number(rows[0].count) > 0) return;

  const now = new Date();
  const thisMonth = (day: number) => new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0).toISOString();

  const food = randomUUID();
  const transport = randomUUID();
  const fun = randomUUID();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO categories (id, name, limit_amount, period) VALUES
       ($1, 'Food',          50000, 'monthly'),
       ($2, 'Transport',     20000, 'monthly'),
       ($3, 'Entertainment', 15000, 'monthly')`,
      [food, transport, fun]
    );

    const activities: Array<[string, number, string, string]> = [
      // Food: usage 30k / 50k = 60% -> On Track
      [food, 8000,  'Groceries',   thisMonth(2)],
      [food, 12000, 'Restaurant',  thisMonth(7)],
      [food, 10000, 'Groceries',   thisMonth(14)],
      // Transport: usage 17k / 20k = 85% -> Warning
      [transport, 5000, 'Uber',    thisMonth(3)],
      [transport, 4000, 'Fuel',    thisMonth(9)],
      [transport, 8000, 'Fuel',    thisMonth(16)],
      // Entertainment: usage 20k / 15k = 133% -> Exceeded
      [fun, 6000,  'Cinema',       thisMonth(4)],
      [fun, 9000,  'Concert',      thisMonth(11)],
      [fun, 5000,  'Streaming',    thisMonth(18)]
    ];

    for (const [categoryId, amount, description, occurredAt] of activities) {
      await client.query(
        `INSERT INTO activities (id, category_id, amount, description, occurred_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), categoryId, amount, description, occurredAt]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
