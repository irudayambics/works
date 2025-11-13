import { expect, test } from '@playwright/test';

import { authHeaders, ensureTestSession, type TestSession } from './helpers';

let session: TestSession;

test.beforeAll(async () => {
  session = await ensureTestSession();
});

test.describe('Tag management', () => {
  test('creates, updates, prevents duplicates, and deletes tags', async ({ request }) => {
    const uniqueName = `Planning-${Date.now()}`;

    const createResponse = await request.post('/api/tags', {
      headers: authHeaders(session),
      data: {
        name: uniqueName,
        color: '#3b82f6',
      },
    });
    expect(createResponse.status()).toBe(201);
    const createJson = await createResponse.json();
    expect(createJson.ok).toBeTruthy();
    const tagId = createJson.data.id as string;

    const duplicateResponse = await request.post('/api/tags', {
      headers: authHeaders(session),
      data: {
        name: uniqueName,
        color: '#3b82f6',
      },
    });
    expect(duplicateResponse.status()).toBe(409);

    const updateResponse = await request.put(`/api/tags/${tagId}`, {
      headers: authHeaders(session),
      data: {
        color: '#10b981',
      },
    });
    expect(updateResponse.status()).toBe(200);
    const updateJson = await updateResponse.json();
    expect(updateJson.ok).toBeTruthy();
    expect(updateJson.data.color).toBe('#10b981');

    const deleteResponse = await request.delete(`/api/tags/${tagId}`, {
      headers: authHeaders(session),
    });
    expect(deleteResponse.status()).toBe(200);
    const deleteJson = await deleteResponse.json();
    expect(deleteJson.ok).toBeTruthy();
  });
});
