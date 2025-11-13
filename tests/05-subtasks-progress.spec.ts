import { expect, test } from '@playwright/test';

import { authHeaders, ensureTestSession, sgFutureIso, type TestSession } from './helpers';

let session: TestSession;

test.beforeAll(async () => {
  session = await ensureTestSession();
});

test.describe('Subtasks and progress', () => {
  test('manages subtasks and tracks completion', async ({ request }) => {
    const createResponse = await request.post('/api/todos', {
      headers: authHeaders(session),
      data: {
        title: 'Todo with subtasks',
        priority: 'medium',
        dueAt: sgFutureIso({ minutes: 8 }),
        subtasks: [
          { title: 'Draft outline', position: 0 },
          { title: 'Review outline', position: 1 },
        ],
      },
    });
    expect(createResponse.status()).toBe(201);
    const createJson = await createResponse.json();
    const todoId = createJson.data.id as string;
    const initialSubtasks = createJson.data.subtasks as Array<{ id: string; completed: boolean }>;
    expect(initialSubtasks).toHaveLength(2);
    expect(initialSubtasks.every((subtask) => subtask.completed === false)).toBeTruthy();

    const addSubtaskResponse = await request.post(`/api/todos/${todoId}/subtasks`, {
      headers: authHeaders(session),
      data: { title: 'Finalize document' },
    });
    expect(addSubtaskResponse.status()).toBe(201);
    const addedSubtask = await addSubtaskResponse.json();
    const subtaskId = addedSubtask.data.id as string;

    const completeResponse = await request.put(`/api/subtasks/${subtaskId}`, {
      headers: authHeaders(session),
      data: { completed: true },
    });
    expect(completeResponse.status()).toBe(200);

    const getResponse = await request.get(`/api/todos/${todoId}`, {
      headers: authHeaders(session),
    });
    expect(getResponse.status()).toBe(200);
    const getJson = await getResponse.json();
    expect(getJson.ok).toBeTruthy();

    const refreshed = getJson.data as {
      subtasks: Array<{ id: string; completed: boolean }>;
    };
    const totals = refreshed.subtasks.reduce(
      (acc, subtask) => {
        if (subtask.completed) acc.completed += 1;
        acc.total += 1;
        return acc;
      },
      { completed: 0, total: 0 }
    );

    expect(totals.total).toBe(3);
    expect(totals.completed).toBe(1);
  });
});
