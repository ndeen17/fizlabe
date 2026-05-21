import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db';
import { CreateActivity, UpdateActivity } from '../schemas';

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

activitiesRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = UpdateActivity.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: 'Invalid body', details: parsed.error.flatten() } });
  }
  const { id } = req.params;
  const { categoryId, amount, description, occurredAt } = parsed.data;
  const sets: string[] = [];
  const values: any[] = [];
  if (categoryId !== undefined) {
    sets.push(`category_id = $${sets.length + 1}`);
    values.push(categoryId);
  }
  if (amount !== undefined) {
    sets.push(`amount = $${sets.length + 1}`);
    values.push(amount);
  }
  if (description !== undefined) {
    sets.push(`description = $${sets.length + 1}`);
    values.push(description);
  }
  if (occurredAt !== undefined) {
    sets.push(`occurred_at = $${sets.length + 1}`);
    values.push(occurredAt);
  }
  values.push(id);
  try {
    const { rows } = await getPool().query(
      `UPDATE activities SET ${sets.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, category_id AS "categoryId", amount, description, occurred_at AS "occurredAt"`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { message: 'Activity not found' } });
    }
    const row = rows[0];
    res.json({ ...row, amount: Number(row.amount) });
  } catch (err: any) {
    if (err && err.code === '23503') {
      return res.status(400).json({ error: { message: 'Unknown categoryId' } });
    }
    next(err);
  }
});

activitiesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rowCount } = await getPool().query(`DELETE FROM activities WHERE id = $1`, [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: { message: 'Activity not found' } });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
