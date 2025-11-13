import { expect, test } from '@playwright/test';

import { authHeaders, ensureTestSession, sgFutureIso, type TestSession } from './helpers';

let session: TestSession;

test.beforeAll(async () => {
  session = await ensureTestSession();
});

test.describe('Export and import', () => {
  test('exports current data set and re-imports without errors', async ({ request }) => {
    const tagResponse = await request.post('/api/tags', {
      headers: authHeaders(session),
      data: {
        name: `Backup-${Date.now()}`,
        color: '#8b5cf6',
      },
    });
    expect(tagResponse.status()).toBe(201);
    const tagJson = await tagResponse.json();
    const tagId = tagJson.data.id as string;

    const todoResponse = await request.post('/api/todos', {
      headers: authHeaders(session),
      data: {
        title: 'Export baseline todo',
        priority: 'medium',
        dueAt: sgFutureIso({ minutes: 9 }),
        tags: [tagId],
        subtasks: [{ title: 'Included subtask', position: 0 }],
      },
    });
    expect(todoResponse.status()).toBe(201);

    const exportResponse = await request.get('/api/todos/export', {
      headers: authHeaders(session),
    });
    expect(exportResponse.status()).toBe(200);
    const exportJson = await exportResponse.json();
    expect(exportJson.ok).toBeTruthy();
    expect(exportJson.data.version).toBeGreaterThan(0);
    expect(exportJson.data.todos.length).toBeGreaterThan(0);

    const importResponse = await request.post('/api/todos/import', {
      headers: authHeaders(session),
      data: exportJson.data,
    });
    expect(importResponse.status()).toBe(200);
    const importJson = await importResponse.json();
    expect(importJson.ok).toBeTruthy();
    expect(importJson.data.imported).toBeGreaterThan(0);
  });
});
