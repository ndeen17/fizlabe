import 'dotenv/config';
import { createApp } from './app';
import { initSchema } from './db';
import { seedIfEmpty } from './seed';

async function main() {
  await initSchema();
  await seedIfEmpty();

  const app = createApp();
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[fizlabe] listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[fatal]', err);
  process.exit(1);
});
