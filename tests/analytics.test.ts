import { beforeEach, expect, it, vi } from 'vitest';
import { createTestDatabase } from './d1Fixture';

const mocks = vi.hoisted(() => ({ database: vi.fn() }));
vi.mock('../lib/database', () => ({ database: mocks.database }));
vi.mock('../lib/hosting', () => ({ clientAddress: () => 'test-address' }));
vi.mock('../lib/logger', () => ({ digest: () => 'test-rate-limit-key' }));

import { POST } from '../app/api/analytics/route';
let db: ReturnType<typeof createTestDatabase>;

function request(body: unknown) {
  return new Request('http://localhost:3000/api/analytics', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  db = createTestDatabase();
  mocks.database.mockResolvedValue(db);
});

it('records anonymous validation field and reason counts', async () => {
  const response = await POST(
    request({
      event: 'form_validation_failed',
      failures: [
        { field: 'eligibility', reason: 'required' },
        { field: 'mobile', reason: 'format' },
        { field: 'email', reason: 'format' },
        { field: 'consent', reason: 'required' },
      ],
    }),
  );
  expect(response.status).toBe(204);
  expect(
    db.sqlite
      .prepare('SELECT field, reason, count FROM site_validation_failure_daily ORDER BY field')
      .all(),
  ).toEqual([
    { field: 'consent', reason: 'required', count: 1 },
    { field: 'eligibility', reason: 'required', count: 1 },
    { field: 'email', reason: 'format', count: 1 },
    { field: 'mobile', reason: 'format', count: 1 },
  ]);
  expect(db.sqlite.prepare('SELECT event, count FROM site_event_daily').all()).toEqual([
    { event: 'form_validation_failed', count: 1 },
  ]);
  db.sqlite.close();
});

it('rejects unrecognized details without recording an event', async () => {
  const response = await POST(
    request({
      event: 'form_validation_failed',
      failures: [{ field: 'phone_number', reason: 'private value' }],
    }),
  );
  expect(response.status).toBe(400);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM site_event_daily').get()).toEqual({
    count: 0,
  });
  db.sqlite.close();
});
