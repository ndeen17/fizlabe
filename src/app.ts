import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { limitsRouter } from './routes/limits';
import { activitiesRouter } from './routes/activities';
import { summaryRouter } from './routes/summary';

export function createApp() {
  const app = express();

  const origin = process.env.CORS_ORIGIN ?? '*';
  app.use(cors({ origin: origin === '*' ? true : origin.split(',').map((s) => s.trim()) }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/limits', limitsRouter);
  app.use('/activities', activitiesRouter);
  app.use('/limit-summary', summaryRouter);

  // 404
  app.use((_req, res) => res.status(404).json({ error: { message: 'Not found' } }));

  // Central error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  });

  return app;
}
