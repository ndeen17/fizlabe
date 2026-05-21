import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db';
import { CreateActivity } from '../schemas';

export const activitiesRouter = Router();

activitiesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
  try {
    const sql = `
      SELECT id, category_id AS "categoryId", amount, description, occurred_at AS "occurredAt"
      FROM activities
      ${categoryId ? 'WHERE category_id = $1' : ''}
      ORDER BY occurred_at DESC`;
    const { rows } = await getPool().query(sql, categoryId ? [categoryId] : []);
    res.json(rows.map((r) => ({ ...r, amount: Number(r.amount) })));
  } catch (err) {
    next(err);
  }
});

activitiesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = CreateActivity.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: 'Invalid body', details: parsed.error.flatten() } });
  }
  const { categoryId, amount, description, occurredAt } = parsed.data;
  const id = randomUUID();
  try {
    const { rows } = await getPool().query(
      `INSERT INTO activities (id, category_id, amount, description, occurred_at)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
       RETURNING id, category_id AS "categoryId", amount, description, occurred_at AS "occurredAt"`,
      [id, categoryId, amount, description, occurredAt ?? null]
    );
    const row = rows[0];
    res.status(201).json({ ...row, amount: Number(row.amount) });
  } catch (err: any) {
    if (err && err.code === '23503') {
      return res.status(400).json({ error: { message: 'Unknown categoryId' } });
    }
    next(err);
  }
});
