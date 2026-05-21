import { newDb, IMemoryDb, DataType } from 'pg-mem';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { setPool } from '../src/db';
import { createApp } from '../src/app';

let mem: IMemoryDb;

beforeAll(async () => {
  mem = newDb();

  // pg-mem doesn't ship date_trunc; register the variants the summary query uses.
  mem.public.registerFunction({
    name: 'date_trunc',
    args: [DataType.text, DataType.timestamptz],
    returns: DataType.timestamptz,
    implementation: (field: string, d: Date) => truncDate(field, d)
  });
  mem.public.registerFunction({
    name: 'date_trunc',
    args: [DataType.text, DataType.timestamp],
    returns: DataType.timestamp,
    implementation: (field: string, d: Date) => truncDate(field, d)
  });

  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  setPool(pool as any);

  const schema = fs.readFileSync(path.join(__dirname, '..', 'src', 'schema.sql'), 'utf8');
  await pool.query(schema);
});

function truncDate(field: string, d: Date): Date {
  const x = new Date(d);
  switch (field) {
    case 'year':   x.setUTCMonth(0);   // fallthrough
    // eslint-disable-next-line no-fallthrough
    case 'month':  x.setUTCDate(1);    // fallthrough
    // eslint-disable-next-line no-fallthrough
    case 'day':    x.setUTCHours(0, 0, 0, 0); break;
    default: throw new Error(`date_trunc field not supported in tests: ${field}`);
  }
  return x;
}

describe('limits + summary API', () => {
  const app = () => createApp();

  it('POST /limits validates input', async () => {
    const res = await request(app()).post('/limits').send({ name: '', limitAmount: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /limits creates a category and GET /limit-summary returns Exceeded for over-budget usage', async () => {
    const create = await request(app())
      .post('/limits')
      .send({ name: 'Coffee', limitAmount: 1000 });
    expect(create.status).toBe(201);
    const categoryId = create.body.id as string;

    // Push usage to 150% via two activities
    await request(app())
      .post('/activities')
      .send({ categoryId, amount: 900, description: 'Latte' })
      .expect(201);
    await request(app())
      .post('/activities')
      .send({ categoryId, amount: 600, description: 'Espresso' })
      .expect(201);

    const summary = await request(app()).get('/limit-summary');
    expect(summary.status).toBe(200);
    const coffee = summary.body.find((s: any) => s.categoryId === categoryId);
    expect(coffee).toBeDefined();
    expect(coffee.usage).toBe(1500);
    expect(coffee.percentage).toBe(150);
    expect(coffee.status).toBe('Exceeded');
  });

  it('POST /limits rejects duplicate name with 409', async () => {
    await request(app())
      .post('/limits')
      .send({ name: 'Books', limitAmount: 500 })
      .expect(201);
    const dup = await request(app())
      .post('/limits')
      .send({ name: 'Books', limitAmount: 800 });
    expect(dup.status).toBe(409);
  });

  it('PATCH /limits/:id updates fields and is reflected in the summary', async () => {
    const create = await request(app())
      .post('/limits')
      .send({ name: 'Snacks', limitAmount: 1000 })
      .expect(201);
    const id = create.body.id as string;

    await request(app())
      .post('/activities')
      .send({ categoryId: id, amount: 800, description: 'Chips' })
      .expect(201);

    const patch = await request(app())
      .patch(`/limits/${id}`)
      .send({ limitAmount: 2000 });
    expect(patch.status).toBe(200);
    expect(patch.body.limitAmount).toBe(2000);

    const summary = await request(app()).get('/limit-summary').expect(200);
    const row = summary.body.find((s: any) => s.categoryId === id);
    expect(row.limitAmount).toBe(2000);
    expect(row.percentage).toBe(40);
    expect(row.status).toBe('On Track');

    const missing = await request(app()).patch('/limits/does-not-exist').send({ limitAmount: 5 });
    expect(missing.status).toBe(404);
  });

  it('DELETE /limits/:id cascades to activities', async () => {
    const create = await request(app())
      .post('/limits')
      .send({ name: 'Toys', limitAmount: 500 })
      .expect(201);
    const id = create.body.id as string;
    await request(app())
      .post('/activities')
      .send({ categoryId: id, amount: 100, description: 'Lego' })
      .expect(201);

    const del = await request(app()).delete(`/limits/${id}`);
    expect(del.status).toBe(204);

    const acts = await request(app()).get(`/activities?categoryId=${id}`).expect(200);
    expect(acts.body).toHaveLength(0);

    const again = await request(app()).delete(`/limits/${id}`);
    expect(again.status).toBe(404);
  });

  it('PATCH /activities/:id updates amount and shifts category usage', async () => {
    const create = await request(app())
      .post('/limits')
      .send({ name: 'Gas', limitAmount: 1000 })
      .expect(201);
    const categoryId = create.body.id as string;
    const act = await request(app())
      .post('/activities')
      .send({ categoryId, amount: 200, description: 'Refill' })
      .expect(201);

    const patch = await request(app())
      .patch(`/activities/${act.body.id}`)
      .send({ amount: 500 });
    expect(patch.status).toBe(200);
    expect(patch.body.amount).toBe(500);

    const summary = await request(app()).get('/limit-summary').expect(200);
    const row = summary.body.find((s: any) => s.categoryId === categoryId);
    expect(row.usage).toBe(500);
    expect(row.percentage).toBe(50);

    const delAct = await request(app()).delete(`/activities/${act.body.id}`);
    expect(delAct.status).toBe(204);
  });
});
