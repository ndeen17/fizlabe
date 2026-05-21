import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '../db';
import { computeStatus } from '../lib/status';

export const summaryRouter = Router();

/**
 * GET /limit-summary
 * Sums activity amounts in the current calendar month per category,
 * returns usage, percentage, and status for each.
 */
summaryRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await getPool().query(`
      SELECT
        c.id,
        c.name,
        c.limit_amount AS "limitAmount",
        c.period,
        COALESCE(SUM(a.amount), 0) AS usage
      FROM categories c
      LEFT JOIN activities a
        ON a.category_id = c.id
       AND a.occurred_at >= date_trunc('month', now())
       AND a.occurred_at <  date_trunc('month', now()) + interval '1 month'
      GROUP BY c.id, c.name, c.limit_amount, c.period
      ORDER BY c.name ASC
    `);

    const summary = rows.map((r) => {
      const limitAmount = Number(r.limitAmount);
      const usage = Number(r.usage);
      const percentage = limitAmount > 0 ? (usage / limitAmount) * 100 : 0;
      return {
        categoryId: r.id,
        name: r.name,
        limitAmount,
        period: r.period,
        usage,
        percentage: Math.round(percentage * 100) / 100,
        status: computeStatus(percentage)
      };
    });

    res.json(summary);
  } catch (err) {
    next(err);
  }
});
