import { expect, test } from '@playwright/test';

import { authHeaders, ensureTestSession, sgFutureIso, type TestSession } from './helpers';

let session: TestSession;

test.beforeAll(async () => {
  session = await ensureTestSession();
});

test.describe('Reminder notifications', () => {
  test('returns todos requiring reminders and marks them as sent', async ({ request }) => {
    const createResponse = await request.post('/api/todos', {
      headers: authHeaders(session),
      data: {
        title: 'Reminder eligible todo',
        priority: 'medium',
        dueAt: sgFutureIso({ minutes: 5 }),
        reminderMinutes: 15,
      },
    });
    expect(createResponse.status()).toBe(201);
    const createJson = await createResponse.json();
    const todoId = createJson.data.id as string;

    const checkResponse = await request.get('/api/notifications/check', {
      headers: authHeaders(session),
    });
    expect(checkResponse.status()).toBe(200);
    const checkJson = await checkResponse.json();
    expect(checkJson.ok).toBeTruthy();
    const reminderIds = (checkJson.data.todos as Array<{ id: string }>).map((todo) => todo.id);
    expect(reminderIds).toContain(todoId);

    const markResponse = await request.post('/api/notifications/check', {
      headers: authHeaders(session),
      data: { todoId },
    });
    expect(markResponse.status()).toBe(200);
    const markJson = await markResponse.json();
    expect(markJson.ok).toBeTruthy();

    const secondCheck = await request.get('/api/notifications/check', {
      headers: authHeaders(session),
    });
    expect(secondCheck.status()).toBe(200);
    const secondJson = await secondCheck.json();
    expect(secondJson.ok).toBeTruthy();
    const remainingIds = (secondJson.data.todos as Array<{ id: string }>).map((todo) => todo.id);
    expect(remainingIds).not.toContain(todoId);
  });
});
