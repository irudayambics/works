import { expect, test } from '@playwright/test';
import { authHeaders, ensureTestSession, sgFutureIso, type TestSession } from './helpers';

let session: TestSession;

test.beforeAll(async ({ request }) => {
  session = await ensureTestSession();
  const meResponse = await request.get('/api/auth/me', {
    headers: authHeaders(session),
  });
  if (meResponse.status() !== 200) {
    const body = await meResponse.text();
    throw new Error(`Failed to bootstrap authenticated session: ${meResponse.status()} ${body}`);
  }
});

test.describe('Todo CRUD API', () => {
  test('creates a todo and lists it', async ({ request }) => {
    const dueAt = sgFutureIso({ minutes: 5 });

    const createResponse = await request.post('/api/todos', {
      headers: authHeaders(session),
      data: {
        title: 'Playwright created todo',
        description: 'Created via E2E test',
        priority: 'high',
        dueAt,
      },
    });

    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as {
      ok: boolean;
      data: { id: string; title: string };
    };
    expect(created.ok).toBeTruthy();
    expect(created.data.id).toBeTruthy();
    expect(created.data.title).toBe('Playwright created todo');

    const listResponse = await request.get('/api/todos', {
      headers: authHeaders(session),
    });
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as {
      ok: boolean;
      data: Array<{ id: string; title: string; priority: string }>;
    };
    expect(listBody.ok).toBeTruthy();
    const match = listBody.data.find((todo) => todo.id === created.data.id);
    expect(match).toBeTruthy();
    expect(match?.priority).toBe('high');
  });

  test('rejects due dates less than a minute ahead', async ({ request }) => {
    const dueAt = sgFutureIso({ seconds: 30 });

    const invalidResponse = await request.post('/api/todos', {
      headers: authHeaders(session),
      data: {
        title: 'Too soon todo',
        priority: 'medium',
        dueAt,
      },
    });

    expect(invalidResponse.status()).toBe(400);
    const invalidBody = (await invalidResponse.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(invalidBody.ok).toBeFalsy();
    expect(invalidBody.error.code).toBe('E_VALIDATION');
  });

  test('updates and deletes an existing todo', async ({ request }) => {
    const dueAt = sgFutureIso({ minutes: 10 });

    const createResponse = await request.post('/api/todos', {
      headers: authHeaders(session),
      data: {
        title: 'Todo to update',
        priority: 'low',
        dueAt,
      },
    });

    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as {
      ok: boolean;
      data: { id: string };
    };
    const todoId = created.data.id;

    const patchResponse = await request.patch(`/api/todos/${todoId}`, {
      headers: authHeaders(session),
      data: {
        title: 'Updated title',
        completed: true,
        priority: 'medium',
        dueAt: sgFutureIso({ minutes: 15 }),
      },
    });

    expect(patchResponse.status()).toBe(200);
    const patched = (await patchResponse.json()) as {
      ok: boolean;
      data: { title: string; completed: boolean; priority: string };
    };
    expect(patched.ok).toBeTruthy();
    expect(patched.data.title).toBe('Updated title');
    expect(patched.data.completed).toBe(true);
    expect(patched.data.priority).toBe('medium');

    const deleteResponse = await request.delete(`/api/todos/${todoId}`, {
      headers: authHeaders(session),
    });
    expect(deleteResponse.status()).toBe(200);
    const deleted = await deleteResponse.json();
    expect(deleted.ok).toBeTruthy();

    const secondDelete = await request.delete(`/api/todos/${todoId}`, {
      headers: authHeaders(session),
    });
    expect(secondDelete.status()).toBe(200);
    const secondDeleteBody = await secondDelete.json();
    expect(secondDeleteBody.ok).toBeTruthy();

    const listResponse = await request.get('/api/todos', {
      headers: authHeaders(session),
    });
    const listBody = (await listResponse.json()) as { ok: boolean; data: Array<{ id: string }> };
    expect(listBody.ok).toBeTruthy();
    const exists = listBody.data.some((todo) => todo.id === todoId);
    expect(exists).toBeFalsy();
  });
});
