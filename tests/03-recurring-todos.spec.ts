import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';

import { authHeaders, ensureTestSession, sgFutureIso, type TestSession } from './helpers';

let session: TestSession;

test.beforeAll(async () => {
  session = await ensureTestSession();
});

test.describe('Recurring todo lifecycle', () => {
  test('completing a recurring todo schedules the next instance', async ({ request }) => {
    const createResponse = await request.post('/api/todos', {
      headers: authHeaders(session),
      data: {
        title: 'Daily standup',
        priority: 'medium',
        dueAt: sgFutureIso({ minutes: 20 }),
        isRecurring: true,
        recurrencePattern: 'daily',
      },
    });
    expect(createResponse.status()).toBe(201);
    const createJson = await createResponse.json();
    const originalId = createJson.data.id as string;
    const originalDueAt = createJson.data.dueAt as string;

    const patchResponse = await request.patch(`/api/todos/${originalId}`, {
      headers: authHeaders(session),
      data: {
        completed: true,
      },
    });
    expect(patchResponse.status()).toBe(200);

    const listResponse = await request.get('/api/todos?includeCompleted=true&limit=10', {
      headers: authHeaders(session),
    });
    expect(listResponse.status()).toBe(200);
    const listJson = await listResponse.json();
    expect(listJson.ok).toBeTruthy();

    const todos = listJson.data as Array<{
      id: string;
      dueAt: string | null;
      completed: boolean;
      title: string;
    }>;
    const original = todos.find((todo) => todo.id === originalId);
    const spawned = todos.find((todo) => todo.id !== originalId && todo.title === 'Daily standup');

    expect(original).toBeTruthy();
    expect(original?.completed).toBe(true);
    expect(spawned).toBeTruthy();
    expect(spawned?.completed).toBe(false);
    expect(spawned?.dueAt).toBeTruthy();

    const originalDue = DateTime.fromISO(originalDueAt);
    const nextDue = DateTime.fromISO(spawned!.dueAt!);
    expect(nextDue.diff(originalDue, 'days').days).toBeCloseTo(1, 0);
  });
});
