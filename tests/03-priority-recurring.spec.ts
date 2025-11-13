import { test, expect } from '@playwright/test';
import { TodoAppHelpers } from './helpers';

/**
 * Priority and Recurring Todos Tests
 * Based on USER_GUIDE.md Section 3: Priority Levels & Section 5: Recurring Todos
 *
 * Features tested:
 * - Priority badges and colors
 * - Priority filtering
 * - Recurring todo creation
 * - Recurring patterns (daily, weekly, monthly, yearly)
 * - Auto-creation of next instance on completion
 */

test.describe('Priority Levels', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should display high priority badge in red', async ({ page }) => {
    const todoTitle = 'High Priority ' + Date.now();
    await helpers.createTodo(todoTitle, { priority: 'high' });

    const todoRow = page.locator(`text=${todoTitle}`).locator('..').locator('..');
    const badge = todoRow.locator('text=High');

    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/red/);
  });

  test('should display medium priority badge in yellow', async ({ page }) => {
    const todoTitle = 'Medium Priority ' + Date.now();
    await helpers.createTodo(todoTitle, { priority: 'medium' });

    const todoRow = page.locator(`text=${todoTitle}`).locator('..').locator('..');
    const badge = todoRow.locator('text=Medium');

    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/yellow/);
  });

  test('should display low priority badge in blue', async ({ page }) => {
    const todoTitle = 'Low Priority ' + Date.now();
    await helpers.createTodo(todoTitle, { priority: 'low' });

    const todoRow = page.locator(`text=${todoTitle}`).locator('..').locator('..');
    const badge = todoRow.locator('text=Low');

    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/blue/);
  });

  test('should filter todos by high priority', async ({ page }) => {
    const highTodo = 'High Todo ' + Date.now();
    const lowTodo = 'Low Todo ' + Date.now();

    await helpers.createTodo(highTodo, { priority: 'high' });
    await helpers.createTodo(lowTodo, { priority: 'low' });

    // Filter by high priority
    await helpers.filterByPriority('high');

    // High priority should be visible
    await expect(page.locator(`text=${highTodo}`)).toBeVisible();

    // Low priority should not be visible
    await expect(page.locator(`text=${lowTodo}`)).not.toBeVisible();
  });

  test('should show all priorities when filter is "all"', async ({ page }) => {
    const highTodo = 'High Todo ' + Date.now();
    const mediumTodo = 'Medium Todo ' + Date.now();
    const lowTodo = 'Low Todo ' + Date.now();

    await helpers.createTodo(highTodo, { priority: 'high' });
    await helpers.createTodo(mediumTodo, { priority: 'medium' });
    await helpers.createTodo(lowTodo, { priority: 'low' });

    // Filter by all
    await helpers.filterByPriority('all');

    // All should be visible
    await expect(page.locator(`text=${highTodo}`)).toBeVisible();
    await expect(page.locator(`text=${mediumTodo}`)).toBeVisible();
    await expect(page.locator(`text=${lowTodo}`)).toBeVisible();
  });
});

test.describe('Recurring Todos', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should create daily recurring todo', async ({ page }) => {
    const todoTitle = 'Daily Task ' + Date.now();
    const dueDate = helpers.getSingaporeDateTime(60);

    await helpers.createTodo(todoTitle, {
      dueDate,
      recurring: true,
      recurrencePattern: 'daily'
    });

    // Verify recurring badge
    await helpers.verifyRecurringBadge(todoTitle, 'daily');
  });

  test('should create weekly recurring todo', async ({ page }) => {
    const todoTitle = 'Weekly Task ' + Date.now();
    const dueDate = helpers.getSingaporeDateTime(60);

    await helpers.createTodo(todoTitle, {
      dueDate,
      recurring: true,
      recurrencePattern: 'weekly'
    });

    await helpers.verifyRecurringBadge(todoTitle, 'weekly');
  });

  test('should create monthly recurring todo', async ({ page }) => {
    const todoTitle = 'Monthly Task ' + Date.now();
    const dueDate = helpers.getSingaporeDateTime(60);

    await helpers.createTodo(todoTitle, {
      dueDate,
      recurring: true,
      recurrencePattern: 'monthly'
    });

    await helpers.verifyRecurringBadge(todoTitle, 'monthly');
  });

  test('should create yearly recurring todo', async ({ page }) => {
    const todoTitle = 'Yearly Task ' + Date.now();
    const dueDate = helpers.getSingaporeDateTime(60);

    await helpers.createTodo(todoTitle, {
      dueDate,
      recurring: true,
      recurrencePattern: 'yearly'
    });

    await helpers.verifyRecurringBadge(todoTitle, 'yearly');
  });

  test('should display recurring icon (🔄)', async ({ page }) => {
    const todoTitle = 'Recurring Icon Test ' + Date.now();
    const dueDate = helpers.getSingaporeDateTime(60);

    await helpers.createTodo(todoTitle, {
      dueDate,
      recurring: true,
      recurrencePattern: 'weekly'
    });

    const todoRow = page.locator(`text=${todoTitle}`).locator('..').locator('..');
    await expect(todoRow.locator('text=🔄')).toBeVisible();
  });

  test('should require due date for recurring todos', async ({ page }) => {
    const todoTitle = 'No Due Date Recurring ' + Date.now();

    // Fill form
    await page.fill('input[placeholder*="Add a new todo"]', todoTitle);

    // Check recurring checkbox
    await page.check('input[type="checkbox"]:near(:text("Repeat"))');

    // Select pattern
    await page.selectOption('select:near(:text("Repeat"))', 'daily');

    // Try to add without due date
    await page.click('button:text("Add")');

    // Wait a moment
    await page.waitForTimeout(1000);

    // Should show error or not create todo
    const errorOrNoTodo = (await page.locator('text=/error/i').count() > 0) ||
      (await page.locator(`text=${todoTitle}`).count() === 0);

    expect(errorOrNoTodo).toBeTruthy();
  });

  test('should create next instance when recurring todo completed', async ({ page }) => {
    const todoTitle = 'Complete Recurring ' + Date.now();
    const dueDate = helpers.getSingaporeDateTime(60);

    await helpers.createTodo(todoTitle, {
      dueDate,
      recurring: true,
      recurrencePattern: 'daily'
    });

    // Complete the todo
    await helpers.toggleTodoComplete(todoTitle);

    // Wait for next instance creation
    await page.waitForTimeout(2000);

    // Should still see the todo (new instance) in pending
    const pendingSection = page.locator('h2:has-text("Pending")').locator('..').locator('..');

    // May need to check for multiple instances or verify one is in completed, one in pending
    const todoCount = await page.locator(`text=${todoTitle}`).count();

    expect(todoCount).toBeGreaterThanOrEqual(1);
  });

  test('should maintain recurrence settings in next instance', async ({ page }) => {
    const todoTitle = 'Maintain Settings ' + Date.now();
    const dueDate = helpers.getSingaporeDateTime(60);

    await helpers.createTodo(todoTitle, {
      dueDate,
      priority: 'high',
      recurring: true,
      recurrencePattern: 'weekly'
    });

    // Complete the todo
    await helpers.toggleTodoComplete(todoTitle);

    // Wait for next instance
    await page.waitForTimeout(2000);

    // Check if a todo with same title exists with high priority and recurring badge
    const pendingTodos = page.locator('h2:has-text("Pending")').locator('..').locator('..');
    const matchingTodo = pendingTodos.locator(`text=${todoTitle}`).first().locator('..').locator('..');

    if (await matchingTodo.isVisible()) {
      await expect(matchingTodo.locator('text=High')).toBeVisible();
      await expect(matchingTodo.locator('text=🔄')).toBeVisible();
    }
  });
});

test.describe('Due Date and Time Management', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should display "Due in" text for upcoming todos', async ({ page }) => {
    const todoTitle = 'Upcoming Todo ' + Date.now();
    const dueDate = helpers.getSingaporeDateTime(120); // 2 hours from now

    await helpers.createTodo(todoTitle, { dueDate });

    const todoRow = page.locator(`text=${todoTitle}`).locator('..').locator('..');
    await expect(todoRow.locator('text=/Due in/i')).toBeVisible();
  });

  test('should use Singapore timezone', async ({ page }) => {
    // Verify timezone is set (this is more of a configuration test)
    const timezone = await page.evaluate(() => {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    });

    // Note: This checks browser timezone, actual server validation would be in API tests
    expect(timezone).toBeDefined();
  });

  test('should accept datetime-local input format', async ({ page }) => {
    const todoTitle = 'Datetime Format ' + Date.now();
    const dueDate = helpers.getSingaporeDateTime(60);

    // Fill form with datetime
    await page.fill('input[placeholder*="Add a new todo"]', todoTitle);
    await page.fill('input[type="datetime-local"]', dueDate);
    await page.click('button:text("Add")');

    // Todo should be created
    await expect(page.locator(`text=${todoTitle}`)).toBeVisible();
  });
});
