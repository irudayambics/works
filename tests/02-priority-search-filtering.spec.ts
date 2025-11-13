import { expect, test } from '@playwright/test';

import { authHeaders, ensureTestSession, sgFutureIso, type TestSession } from './helpers';

let session: TestSession;

test.beforeAll(async () => {
  session = await ensureTestSession();
});

test.describe('Priority, search, and filter behaviour', () => {
  test('filters by priority, search term, and tag', async ({ request }) => {
    const tagResponse = await request.post('/api/tags', {
      headers: authHeaders(session),
      data: {
        name: `Focus-${Date.now()}`,
        color: '#34d399',
      },
    });
    expect(tagResponse.status()).toBe(201);
    const tagBody = await tagResponse.json();
    const tagId = tagBody.data.id as string;

    const createHigh = await request.post('/api/todos', {
      headers: authHeaders(session),
      data: {
        title: 'High priority todo',
        priority: 'high',
        dueAt: sgFutureIso({ minutes: 10 }),
        tags: [tagId],
      },
    });
    expect(createHigh.status()).toBe(201);
    const highJson = await createHigh.json();
    const highId = highJson.data.id as string;

    const createLow = await request.post('/api/todos', {
      headers: authHeaders(session),
      data: {
        title: 'Low priority chore',
        priority: 'low',
        dueAt: sgFutureIso({ minutes: 12 }),
      },
    });
    expect(createLow.status()).toBe(201);
    const lowJson = await createLow.json();
    const lowId = lowJson.data.id as string;

    const priorityResponse = await request.get('/api/todos?priority=high', {
      headers: authHeaders(session),
    });
    expect(priorityResponse.status()).toBe(200);
    const priorityJson = await priorityResponse.json();
    expect(priorityJson.ok).toBeTruthy();
    const priorityIds = (priorityJson.data as Array<{ id: string }>).map((todo) => todo.id);
    expect(priorityIds.length).toBeGreaterThanOrEqual(1);
    expect(priorityIds).toContain(highId);
    expect(priorityIds).not.toContain(lowId);

    const searchResponse = await request.get('/api/todos?search=chore', {
      headers: authHeaders(session),
    });
    expect(searchResponse.status()).toBe(200);
    const searchJson = await searchResponse.json();
    expect(searchJson.ok).toBeTruthy();
    expect(searchJson.data).toHaveLength(1);
    expect(searchJson.data[0].priority).toBe('low');

    const tagResponseFiltered = await request.get(`/api/todos?tags=${tagId}`, {
      headers: authHeaders(session),
    });
    expect(tagResponseFiltered.status()).toBe(200);
    const tagJson = await tagResponseFiltered.json();
    expect(tagJson.ok).toBeTruthy();
    expect(tagJson.data).toHaveLength(1);
    expect(tagJson.data[0].tags[0].id).toBe(tagId);
  });
});
