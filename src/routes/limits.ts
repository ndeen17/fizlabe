import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db';
import { CreateCategoryLimit, UpdateCategoryLimit } from '../schemas';

export const limitsRouter = Router();

limitsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await getPool().query(
      `SELECT id, name, limit_amount AS "limitAmount", period, created_at AS "createdAt"
       FROM categories ORDER BY name ASC`
    );
    res.json(rows.map((r) => ({ ...r, limitAmount: Number(r.limitAmount) })));
  } catch (err) {
    next(err);
  }
});

limitsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = CreateCategoryLimit.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: 'Invalid body', details: parsed.error.flatten() } });
  }
  const { name, limitAmount, period } = parsed.data;
  const id = randomUUID();
  try {
    const { rows } = await getPool().query(
      `INSERT INTO categories (id, name, limit_amount, period)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, limit_amount AS "limitAmount", period, created_at AS "createdAt"`,
      [id, name, limitAmount, period]
    );
    const row = rows[0];
    res.status(201).json({ ...row, limitAmount: Number(row.limitAmount) });
  } catch (err: any) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: { message: `Category "${name}" already exists` } });
    }
    next(err);
  }
});

limitsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = UpdateCategoryLimit.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: 'Invalid body', details: parsed.error.flatten() } });
  }
  const { id } = req.params;
  const { name, limitAmount } = parsed.data;
  const sets: string[] = [];
  const values: any[] = [];
  if (name !== undefined) {
    sets.push(`name = $${sets.length + 1}`);
    values.push(name);
  }
  if (limitAmount !== undefined) {
    sets.push(`limit_amount = $${sets.length + 1}`);
    values.push(limitAmount);
  }
  values.push(id);
  try {
    const { rows } = await getPool().query(
      `UPDATE categories SET ${sets.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, name, limit_amount AS "limitAmount", period, created_at AS "createdAt"`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { message: 'Category not found' } });
    }
    const row = rows[0];
    res.json({ ...row, limitAmount: Number(row.limitAmount) });
  } catch (err: any) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: { message: `Category "${name}" already exists` } });
    }
    next(err);
  }
});

limitsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rowCount } = await getPool().query(`DELETE FROM categories WHERE id = $1`, [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: { message: 'Category not found' } });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
