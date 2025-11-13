import { Page, expect } from '@playwright/test';

/**
 * Test helpers and utilities for Todo App E2E tests
 * Based on USER_GUIDE.md
 */

export class TodoAppHelpers {
  constructor(public readonly page: Page) {}

  /**
   * Get current Singapore time + offset minutes
   */
  getSingaporeDateTime(offsetMinutes: number = 5): string {
    const now = new Date();
    const sgTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
    sgTime.setMinutes(sgTime.getMinutes() + offsetMinutes);

    const year = sgTime.getFullYear();
    const month = String(sgTime.getMonth() + 1).padStart(2, '0');
    const day = String(sgTime.getDate()).padStart(2, '0');
    const hours = String(sgTime.getHours()).padStart(2, '0');
    const minutes = String(sgTime.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Create a mock WebAuthn virtual authenticator
   * Note: This requires browser support for WebAuthn testing
   */
  async setupVirtualAuthenticator() {
    // For Chromium, virtual authenticator is enabled via launch args
    // For testing, we'll mock the behavior
    await this.page.addInitScript(() => {
      // Mock WebAuthn if needed for testing
      if (!navigator.credentials) {
        (navigator as any).credentials = {
          create: async () => ({}),
          get: async () => ({})
        };
      }
    });
  }

  /**
   * Login helper (for tests that need authenticated state)
   * Since WebAuthn requires user interaction, we'll need to mock or use API directly
   */
  async loginWithMockAuth(username: string = 'testuser') {
    // For E2E tests, we might need to create a session directly via API
    // Or navigate to login and handle WebAuthn
    await this.page.goto('/login');

    // Fill username
    await this.page.fill('input[type="text"]', username);

    // Note: Actual WebAuthn flow would require virtual authenticator
    // For now, we'll assume the auth flow works
  }

  /**
   * Create session via API (alternative to WebAuthn for testing)
   */
  async createSessionDirectly(username: string = 'playwright-test-user') {
    // This would require implementing a test endpoint or using existing API
    // For now, this is a placeholder
    const response = await this.page.request.post('/api/auth/test-login', {
      data: { username }
    });

    if (!response.ok()) {
      throw new Error('Failed to create test session');
    }
  }

  /**
   * Navigate to home page
   */
  async goToHome() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a todo via UI
   */
  async createTodo(
    title: string,
    options: {
      priority?: 'high' | 'medium' | 'low';
      dueDate?: string;
      recurring?: boolean;
      recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
      reminderMinutes?: number;
      tags?: string[];
    } = {}
  ) {
    // Fill title
    await this.page.fill('input[placeholder*="Add a new todo"]', title);

    // Set priority
    if (options.priority) {
      await this.page.selectOption('select >> nth=0', options.priority);
    }

    // Set due date
    if (options.dueDate) {
      await this.page.fill('input[type="datetime-local"]', options.dueDate);
    }

    // Set recurring
    if (options.recurring) {
      await this.page.check('input[type="checkbox"]:near(:text("Repeat"))');
      if (options.recurrencePattern) {
        await this.page.selectOption('select:near(:text("Repeat"))', options.recurrencePattern);
      }
    }

    // Set reminder
    if (options.reminderMinutes !== undefined) {
      const reminderSelect = this.page.locator('select:near(:text("Reminder"))');
      await reminderSelect.selectOption(String(options.reminderMinutes));
    }

    // Select tags
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        await this.page.click(`button:text("${tag}")`);
      }
    }

    // Click Add button
    await this.page.click('button:text("Add")');

    // Wait for todo to appear in list
    await this.page.waitForSelector(`text=${title}`);
  }

  /**
   * Get todo by title
   */
  getTodoByTitle(title: string) {
    return this.page.locator(`text=${title}`).first();
  }

  /**
   * Edit todo
   */
  async editTodo(
    originalTitle: string,
    updates: {
      title?: string;
      priority?: 'high' | 'medium' | 'low';
      dueDate?: string;
      recurring?: boolean;
      recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
      reminderMinutes?: number;
      tags?: string[];
    }
  ) {
    // Find and click Edit button for the todo
    const todoRow = this.page.locator(`text=${originalTitle}`).locator('..').locator('..');
    await todoRow.locator('button:text("Edit")').click();

    // Wait for modal
    await this.page.waitForSelector('text=Edit');

    // Update title
    if (updates.title) {
      const titleInput = this.page.locator('input[type="text"]').first();
      await titleInput.fill(updates.title);
    }

    // Update priority
    if (updates.priority) {
      await this.page.selectOption('select >> nth=0', updates.priority);
    }

    // Update due date
    if (updates.dueDate) {
      await this.page.fill('input[type="datetime-local"]', updates.dueDate);
    }

    // Click Update button
    await this.page.click('button:text("Update")');

    // Wait for modal to close
    await this.page.waitForSelector('text=Edit', { state: 'hidden' });
  }

  /**
   * Delete todo
   */
  async deleteTodo(title: string) {
    const todoRow = this.page.locator(`text=${title}`).locator('..').locator('..');
    await todoRow.locator('button:text("Delete")').click();

    // Wait for todo to disappear
    await this.page.waitForSelector(`text=${title}`, { state: 'hidden' });
  }

  /**
   * Complete/uncomplete todo
   */
  async toggleTodoComplete(title: string) {
    const todoRow = this.page.locator(`text=${title}`).locator('..').locator('..');
    const checkbox = todoRow.locator('input[type="checkbox"]').first();
    await checkbox.click();
  }

  /**
   * Expand subtasks section
   */
  async expandSubtasks(todoTitle: string) {
    const todoRow = this.page.locator(`text=${todoTitle}`).locator('..').locator('..');
    await todoRow.locator('button:has-text("Subtasks")').click();
  }

  /**
   * Add subtask
   */
  async addSubtask(todoTitle: string, subtaskTitle: string) {
    // Ensure subtasks are expanded
    await this.expandSubtasks(todoTitle);

    // Find the subtask input within the todo section
    const todoRow = this.page.locator(`text=${todoTitle}`).locator('..').locator('..').locator('..');
    const subtaskInput = todoRow.locator('input[placeholder*="Add subtask"]');
    await subtaskInput.fill(subtaskTitle);
    await todoRow.locator('button:text("Add")').last().click();

    // Wait for subtask to appear
    await this.page.waitForSelector(`text=${subtaskTitle}`);
  }

  /**
   * Create tag
   */
  async createTag(name: string, color: string = '#3B82F6') {
    // Click Manage Tags button
    await this.page.click('button:has-text("Manage Tags")');

    // Wait for modal
    await this.page.waitForSelector('text=Tag Management');

    // Fill tag name
    await this.page.fill('input[placeholder*="tag name"]', name);

    // Set color
    await this.page.fill('input[type="color"]', color);

    // Click Create Tag
    await this.page.click('button:text("Create Tag")');

    // Wait for tag to appear in list
    await this.page.waitForSelector(`text=${name}`);
  }

  /**
   * Save template
   */
  async saveTemplate(
    name: string,
    description?: string,
    category?: string
  ) {
    // Click Save as Template button
    await this.page.click('button:has-text("Save as Template")');

    // Wait for modal
    await this.page.waitForSelector('text=Save as Template');

    // Fill template name
    await this.page.fill('input[placeholder*="template name"]', name);

    if (description) {
      await this.page.fill('textarea[placeholder*="description"]', description);
    }

    if (category) {
      await this.page.fill('input[placeholder*="category"]', category);
    }

    // Click Save Template
    await this.page.click('button:text("Save Template")');

    // Wait for success message or modal close
    await this.page.waitForSelector('text=Save as Template', { state: 'hidden' });
  }

  /**
   * Use template
   */
  async useTemplate(templateName: string) {
    // Open template dropdown
    const templateSelect = this.page.locator('select:near(:text("Use Template"))');
    await templateSelect.selectOption({ label: templateName });

    // Wait for todo to be created
    await this.page.waitForTimeout(1000);
  }

  /**
   * Search todos
   */
  async search(query: string) {
    const searchInput = this.page.locator('input[placeholder*="Search todos"]');
    await searchInput.fill(query);

    // Wait for results to filter
    await this.page.waitForTimeout(500);
  }

  /**
   * Clear search
   */
  async clearSearch() {
    const clearButton = this.page.locator('button:near(input[placeholder*="Search todos"]):has-text("✕")');
    if (await clearButton.isVisible()) {
      await clearButton.click();
    }
  }

  /**
   * Apply priority filter
   */
  async filterByPriority(priority: 'all' | 'high' | 'medium' | 'low') {
    await this.page.selectOption('select:has-text("All Priorities")', priority);
    await this.page.waitForTimeout(500);
  }

  /**
   * Apply tag filter
   */
  async filterByTag(tagName: string) {
    await this.page.selectOption('select:has-text("All Tags")', { label: tagName });
    await this.page.waitForTimeout(500);
  }

  /**
   * Open advanced filters
   */
  async openAdvancedFilters() {
    const advancedButton = this.page.locator('button:has-text("Advanced")');
    if (!await advancedButton.locator('text=▼').isVisible()) {
      await advancedButton.click();
    }
  }

  /**
   * Set date range filter
   */
  async setDateRange(from?: string, to?: string) {
    await this.openAdvancedFilters();

    if (from) {
      await this.page.fill('input[type="date"] >> nth=0', from);
    }

    if (to) {
      await this.page.fill('input[type="date"] >> nth=1', to);
    }

    await this.page.waitForTimeout(500);
  }

  /**
   * Clear all filters
   */
  async clearAllFilters() {
    const clearButton = this.page.locator('button:has-text("Clear All")');
    if (await clearButton.isVisible()) {
      await clearButton.click();
    }
  }

  /**
   * Save filter preset
   */
  async saveFilterPreset(name: string) {
    await this.page.click('button:has-text("Save Filter")');

    // Wait for modal
    await this.page.waitForSelector('text=Save Filter Preset');

    // Fill preset name
    await this.page.fill('input[placeholder*="filter name"]', name);

    // Click Save
    await this.page.click('button:text("Save")');

    // Wait for modal to close
    await this.page.waitForSelector('text=Save Filter Preset', { state: 'hidden' });
  }

  /**
   * Export todos
   */
  async exportTodos(format: 'json' | 'csv'): Promise<string> {
    const downloadPromise = this.page.waitForEvent('download');

    if (format === 'json') {
      await this.page.click('button:text("Export JSON")');
    } else {
      await this.page.click('button:text("Export CSV")');
    }

    const download = await downloadPromise;
    const path = await download.path();

    return path || '';
  }

  /**
   * Import todos
   */
  async importTodos(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Wait for import to complete
    await this.page.waitForTimeout(2000);
  }

  /**
   * Navigate to calendar
   */
  async goToCalendar() {
    await this.page.click('a:text("Calendar")');
    await this.page.waitForURL(/.*\/calendar/);
  }

  /**
   * Check if element exists
   */
  async exists(selector: string): Promise<boolean> {
    return await this.page.locator(selector).count() > 0;
  }

  /**
   * Wait for notification permission (for reminder tests)
   */
  async grantNotificationPermission() {
    await this.page.context().grantPermissions(['notifications']);
  }

  /**
   * Click enable notifications button
   */
  async enableNotifications() {
    const enableButton = this.page.locator('button:has-text("Enable Notifications")');
    if (await enableButton.isVisible()) {
      await this.grantNotificationPermission();
      await enableButton.click();
    }
  }

  /**
   * Verify todo appears in section
   */
  async verifyTodoInSection(todoTitle: string, section: 'Overdue' | 'Pending' | 'Completed') {
    const sectionHeader = this.page.locator(`h2:has-text("${section}")`);
    const sectionDiv = sectionHeader.locator('..').locator('..');
    await expect(sectionDiv.locator(`text=${todoTitle}`)).toBeVisible();
  }

  /**
   * Verify priority badge
   */
  async verifyPriorityBadge(todoTitle: string, priority: 'High' | 'Medium' | 'Low') {
    const todoRow = this.page.locator(`text=${todoTitle}`).locator('..').locator('..');
    await expect(todoRow.locator(`text=${priority}`)).toBeVisible();
  }

  /**
   * Verify recurring badge
   */
  async verifyRecurringBadge(todoTitle: string, pattern: string) {
    const todoRow = this.page.locator(`text=${todoTitle}`).locator('..').locator('..');
    await expect(todoRow.locator(`text=🔄`)).toBeVisible();
    await expect(todoRow.locator(`text=${pattern}`)).toBeVisible();
  }

  /**
   * Verify reminder badge
   */
  async verifyReminderBadge(todoTitle: string) {
    const todoRow = this.page.locator(`text=${todoTitle}`).locator('..').locator('..');
    await expect(todoRow.locator(`text=🔔`)).toBeVisible();
  }

  /**
   * Verify tag on todo
   */
  async verifyTag(todoTitle: string, tagName: string) {
    const todoRow = this.page.locator(`text=${todoTitle}`).locator('..').locator('..');
    await expect(todoRow.locator(`text=${tagName}`)).toBeVisible();
  }

  /**
   * Get progress percentage
   */
  async getProgressPercentage(todoTitle: string): Promise<number> {
    const todoRow = this.page.locator(`text=${todoTitle}`).locator('..').locator('..');
    const progressText = await todoRow.locator('text=/\\d+\\/\\d+ subtasks/').textContent();

    if (!progressText) return 0;

    const [completed, total] = progressText.match(/\d+/g)?.map(Number) || [0, 0];
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }
}

/**
 * Custom expect matchers for todo assertions
 */
export const customExpect = {
  async toBeInOverdueSection(page: Page, todoTitle: string) {
    const overdueSection = page.locator('h2:has-text("Overdue")').locator('..').locator('..');
    await expect(overdueSection.locator(`text=${todoTitle}`)).toBeVisible();
  },

  async toBeInPendingSection(page: Page, todoTitle: string) {
    const pendingSection = page.locator('h2:has-text("Pending")').locator('..').locator('..');
    await expect(pendingSection.locator(`text=${todoTitle}`)).toBeVisible();
  },

  async toBeInCompletedSection(page: Page, todoTitle: string) {
    const completedSection = page.locator('h2:has-text("Completed")').locator('..').locator('..');
    await expect(completedSection.locator(`text=${todoTitle}`)).toBeVisible();
  }
};
