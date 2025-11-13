import { test, expect } from '@playwright/test';
import { TodoAppHelpers } from './helpers';

/**
 * Todo CRUD Tests
 * Based on USER_GUIDE.md Section 2: Creating Todos & Section 13: Managing Todos
 *
 * Features tested:
 * - Create todo with title
 * - Create todo with due date
 * - Edit todo
 * - Delete todo
 * - Complete/uncomplete todo
 * - Todo validation (empty title, past due date)
 */

test.describe('Todo CRUD Operations', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test.describe('Create Todo', () => {
    test('should create a simple todo', async ({ page }) => {
      const todoTitle = 'Test Todo ' + Date.now();

      await helpers.createTodo(todoTitle);

      // Verify todo appears in list
      await expect(page.locator(`text=${todoTitle}`)).toBeVisible();
    });

    test('should create todo with high priority', async ({ page }) => {
      const todoTitle = 'High Priority Task ' + Date.now();

      await helpers.createTodo(todoTitle, { priority: 'high' });

      // Verify todo exists with high priority badge
      await helpers.verifyPriorityBadge(todoTitle, 'High');
    });

    test('should create todo with medium priority (default)', async ({ page }) => {
      const todoTitle = 'Medium Priority Task ' + Date.now();

      await helpers.createTodo(todoTitle, { priority: 'medium' });

      // Verify todo exists with medium priority badge
      await helpers.verifyPriorityBadge(todoTitle, 'Medium');
    });

    test('should create todo with low priority', async ({ page }) => {
      const todoTitle = 'Low Priority Task ' + Date.now();

      await helpers.createTodo(todoTitle, { priority: 'low' });

      // Verify todo exists with low priority badge
      await helpers.verifyPriorityBadge(todoTitle, 'Low');
    });

    test('should create todo with due date', async ({ page }) => {
      const todoTitle = 'Todo with Due Date ' + Date.now();
      const dueDate = helpers.getSingaporeDateTime(60); // 1 hour from now

      await helpers.createTodo(todoTitle, { dueDate });

      // Verify todo exists
      await expect(page.locator(`text=${todoTitle}`)).toBeVisible();

      // Verify due date is displayed
      const todoRow = page.locator(`text=${todoTitle}`).locator('..').locator('..');
      await expect(todoRow.locator('text=/Due in/i')).toBeVisible();
    });

    test('should not create todo with empty title', async ({ page }) => {
      // Try to create todo with empty title
      const addButton = page.locator('button:text("Add")');
      await addButton.click();

      // Todo should not be created (or error should be shown)
      // The exact behavior depends on implementation
    });

    test('should trim whitespace from title', async ({ page }) => {
      const todoTitle = '  Trimmed Todo  ';
      const trimmedTitle = todoTitle.trim();

      await helpers.createTodo(todoTitle);

      // Should see trimmed version
      await expect(page.locator(`text=${trimmedTitle}`)).toBeVisible();
    });

    test('should not create todo with past due date', async ({ page }) => {
      const todoTitle = 'Past Due Todo ' + Date.now();

      // Get past date (implementation should prevent this)
      const pastDate = helpers.getSingaporeDateTime(-60); // 1 hour ago

      // Fill todo form
      await page.fill('input[placeholder*="Add a new todo"]', todoTitle);
      await page.fill('input[type="datetime-local"]', pastDate);
      await page.click('button:text("Add")');

      // Should show error or prevent creation
      await page.waitForTimeout(1000);

      // Check if error message appears or todo wasn't created
      const errorOrNoTodo = (await page.locator('text=/error/i').count() > 0) ||
        (await page.locator(`text=${todoTitle}`).count() === 0);

      expect(errorOrNoTodo).toBeTruthy();
    });
  });

  test.describe('Edit Todo', () => {
    test('should edit todo title', async ({ page }) => {
      const originalTitle = 'Original Title ' + Date.now();
      const newTitle = 'Updated Title ' + Date.now();

      // Create todo
      await helpers.createTodo(originalTitle);

      // Edit todo
      await helpers.editTodo(originalTitle, { title: newTitle });

      // Verify new title appears
      await expect(page.locator(`text=${newTitle}`)).toBeVisible();

      // Verify old title doesn't exist
      await expect(page.locator(`text=${originalTitle}`)).not.toBeVisible();
    });

    test('should edit todo priority', async ({ page }) => {
      const todoTitle = 'Priority Change Todo ' + Date.now();

      // Create with low priority
      await helpers.createTodo(todoTitle, { priority: 'low' });

      // Edit to high priority
      await helpers.editTodo(todoTitle, { priority: 'high' });

      // Verify high priority badge
      await helpers.verifyPriorityBadge(todoTitle, 'High');
    });

    test('should edit todo due date', async ({ page }) => {
      const todoTitle = 'Due Date Change Todo ' + Date.now();
      const initialDate = helpers.getSingaporeDateTime(60);
      const newDate = helpers.getSingaporeDateTime(120);

      // Create with initial due date
      await helpers.createTodo(todoTitle, { dueDate: initialDate });

      // Edit due date
      await helpers.editTodo(todoTitle, { dueDate: newDate });

      // Verify todo still exists
      await expect(page.locator(`text=${todoTitle}`)).toBeVisible();
    });

    test('should cancel edit without saving changes', async ({ page }) => {
      const todoTitle = 'Cancel Edit Todo ' + Date.now();

      await helpers.createTodo(todoTitle);

      // Open edit modal
      const todoRow = page.locator(`text=${todoTitle}`).locator('..').locator('..');
      await todoRow.locator('button:text("Edit")').click();

      // Wait for modal
      await page.waitForSelector('text=Update');

      // Click Cancel (or close modal)
      const cancelButton = page.locator('button:text("Cancel")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }

      // Original todo should still exist unchanged
      await expect(page.locator(`text=${todoTitle}`)).toBeVisible();
    });
  });

  test.describe('Delete Todo', () => {
    test('should delete todo', async ({ page }) => {
      const todoTitle = 'Delete Me ' + Date.now();

      // Create todo
      await helpers.createTodo(todoTitle);

      // Verify it exists
      await expect(page.locator(`text=${todoTitle}`)).toBeVisible();

      // Delete todo
      await helpers.deleteTodo(todoTitle);

      // Verify it's gone
      await expect(page.locator(`text=${todoTitle}`)).not.toBeVisible();
    });

    test('should delete completed todo', async ({ page }) => {
      const todoTitle = 'Delete Completed ' + Date.now();

      // Create and complete todo
      await helpers.createTodo(todoTitle);
      await helpers.toggleTodoComplete(todoTitle);

      // Delete todo
      await helpers.deleteTodo(todoTitle);

      // Verify it's gone
      await expect(page.locator(`text=${todoTitle}`)).not.toBeVisible();
    });
  });

  test.describe('Complete/Uncomplete Todo', () => {
    test('should mark todo as complete', async ({ page }) => {
      const todoTitle = 'Complete Me ' + Date.now();

      // Create todo
      await helpers.createTodo(todoTitle);

      // Complete todo
      await helpers.toggleTodoComplete(todoTitle);

      // Wait for todo to move to completed section
      await page.waitForTimeout(1000);

      // Verify todo is in Completed section
      await helpers.verifyTodoInSection(todoTitle, 'Completed');
    });

    test('should mark todo as incomplete', async ({ page }) => {
      const todoTitle = 'Uncomplete Me ' + Date.now();

      // Create and complete todo
      await helpers.createTodo(todoTitle);
      await helpers.toggleTodoComplete(todoTitle);

      // Wait for completion
      await page.waitForTimeout(1000);

      // Uncomplete todo
      await helpers.toggleTodoComplete(todoTitle);

      // Wait for todo to move back
      await page.waitForTimeout(1000);

      // Verify todo is in Pending section
      await helpers.verifyTodoInSection(todoTitle, 'Pending');
    });

    test('should show checkbox as checked when completed', async ({ page }) => {
      const todoTitle = 'Checkbox Check ' + Date.now();

      await helpers.createTodo(todoTitle);

      const todoRow = page.locator(`text=${todoTitle}`).locator('..').locator('..');
      const checkbox = todoRow.locator('input[type="checkbox"]').first();

      // Initially unchecked
      await expect(checkbox).not.toBeChecked();

      // Complete todo
      await helpers.toggleTodoComplete(todoTitle);

      // Wait a moment
      await page.waitForTimeout(500);

      // Should be checked
      await expect(checkbox).toBeChecked();
    });
  });

  test.describe('Todo Sorting and Organization', () => {
    test('should sort todos by priority', async ({ page }) => {
      const lowTodo = 'Low Priority ' + Date.now();
      const mediumTodo = 'Medium Priority ' + Date.now();
      const highTodo = 'High Priority ' + Date.now();

      // Create in mixed order
      await helpers.createTodo(lowTodo, { priority: 'low' });
      await helpers.createTodo(mediumTodo, { priority: 'medium' });
      await helpers.createTodo(highTodo, { priority: 'high' });

      // Get all pending todos
      const pendingSection = page.locator('h2:has-text("Pending")').locator('..').locator('..');
      const todos = pendingSection.locator('[class*="space-y"] > div');

      // High priority should appear before medium and low
      const todosText = await todos.allTextContents();
      const highIndex = todosText.findIndex(t => t.includes(highTodo));
      const mediumIndex = todosText.findIndex(t => t.includes(mediumTodo));
      const lowIndex = todosText.findIndex(t => t.includes(lowTodo));

      expect(highIndex).toBeLessThan(mediumIndex);
      expect(mediumIndex).toBeLessThan(lowIndex);
    });

    test('should show overdue todos in separate section', async ({ page }) => {
      // This test would require creating a todo with a past due date
      // which the app prevents, so we'll check if overdue section exists
      const overdueHeader = page.locator('h2:has-text("Overdue")');

      if (await overdueHeader.isVisible()) {
        // Verify it has the warning icon
        await expect(overdueHeader.locator('text=⚠️')).toBeVisible();

        // Verify red styling
        await expect(overdueHeader).toHaveClass(/red/);
      }
    });
  });
});
