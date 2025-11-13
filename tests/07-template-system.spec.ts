import { expect, test } from '@playwright/test';

import { authHeaders, ensureTestSession, type TestSession } from './helpers';

let session: TestSession;

test.beforeAll(async () => {
  session = await ensureTestSession();
});

test.describe('Template system', () => {
  test('saves a template and instantiates a todo from it', async ({ request }) => {
    const tagResponse = await request.post('/api/tags', {
      headers: authHeaders(session),
      data: {
        name: `TemplateTag-${Date.now()}`,
        color: '#f97316',
      },
    });
    expect(tagResponse.status()).toBe(201);
    const tagJson = await tagResponse.json();
    const tagId = tagJson.data.id as string;

    const templateResponse = await request.post('/api/templates', {
      headers: authHeaders(session),
      data: {
        name: 'Weekly Review',
        description: 'Check goals and plan next week',
        category: 'Routines',
        payload: {
          title: 'Weekly review todo',
          description: 'Plan upcoming work',
          priority: 'high',
          isRecurring: true,
          recurrencePattern: 'weekly',
          reminderMinutes: 1440,
          dueOffsetMinutes: 120,
          subtasks: [
            { title: 'Assess goals', position: 0 },
            { title: 'Plan next steps', position: 1 },
          ],
          tagIds: [tagId],
        },
      },
    });
    expect(templateResponse.status()).toBe(201);
    const templateJson = await templateResponse.json();
    const templateId = templateJson.data.id as string;

    const useResponse = await request.post(`/api/templates/${templateId}/use`, {
      headers: authHeaders(session),
      data: {
        titleOverride: 'Weekly review (override)',
        dueOffsetMinutes: 60,
      },
    });
    expect(useResponse.status()).toBe(201);
    const useJson = await useResponse.json();
    expect(useJson.ok).toBeTruthy();
    expect(useJson.data.title).toBe('Weekly review (override)');
    expect(useJson.data.tags[0].id).toBe(tagId);
    expect(useJson.data.subtasks).toHaveLength(2);
  });
});
