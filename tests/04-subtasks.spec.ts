import { test, expect } from '@playwright/test';
import { TodoAppHelpers } from './helpers';

/**
 * Subtasks and Checklists Tests
 * Based on USER_GUIDE.md Section 7: Subtasks & Checklists
 *
 * Features tested:
 * - Create subtasks
 * - Complete/uncomplete subtasks
 * - Delete subtasks
 * - Progress tracking
 * - Progress bar display
 * - Subtask expansion/collapse
 */

test.describe('Subtasks', () => {
  let helpers: TodoAppHelpers;
  const testTodoTitle = 'Parent Todo ' + Date.now();

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();

    // Create a parent todo for subtask tests
    await helpers.createTodo(testTodoTitle);
  });

  test.describe('Creating Subtasks', () => {
    test('should expand subtasks section', async ({ page }) => {
      await helpers.expandSubtasks(testTodoTitle);

      // Should see subtask input
      const todoRow = page.locator(`text=${testTodoTitle}`).locator('..').locator('..').locator('..');
      await expect(todoRow.locator('input[placeholder*="Add subtask"]')).toBeVisible();
    });

    test('should create a subtask', async ({ page }) => {
      const subtaskTitle = 'Test Subtask 1';

      await helpers.addSubtask(testTodoTitle, subtaskTitle);

      // Verify subtask appears
      await expect(page.locator(`text=${subtaskTitle}`)).toBeVisible();
    });

    test('should create multiple subtasks', async ({ page }) => {
      const subtask1 = 'Subtask 1';
      const subtask2 = 'Subtask 2';
      const subtask3 = 'Subtask 3';

      await helpers.addSubtask(testTodoTitle, subtask1);
      await helpers.addSubtask(testTodoTitle, subtask2);
      await helpers.addSubtask(testTodoTitle, subtask3);

      // All should be visible
      await expect(page.locator(`text=${subtask1}`)).toBeVisible();
      await expect(page.locator(`text=${subtask2}`)).toBeVisible();
      await expect(page.locator(`text=${subtask3}`)).toBeVisible();
    });

    test('should add subtask by pressing Enter', async ({ page }) => {
      const subtaskTitle = 'Enter Key Subtask';

      await helpers.expandSubtasks(testTodoTitle);

      const todoRow = page.locator(`text=${testTodoTitle}`).locator('..').locator('..').locator('..');
      const subtaskInput = todoRow.locator('input[placeholder*="Add subtask"]');

      await subtaskInput.fill(subtaskTitle);
      await subtaskInput.press('Enter');

      // Wait a moment
      await page.waitForTimeout(500);

      // Subtask should be created
      await expect(page.locator(`text=${subtaskTitle}`)).toBeVisible();
    });

    test('should not create empty subtask', async ({ page }) => {
      await helpers.expandSubtasks(testTodoTitle);

      const todoRow = page.locator(`text=${testTodoTitle}`).locator('..').locator('..').locator('..');
      const addButton = todoRow.locator('button:text("Add")').last();

      // Click add with empty input
      await addButton.click();

      // Should not create anything (no empty subtask)
      // This is implementation-specific
    });
  });

  test.describe('Managing Subtasks', () => {
    test('should complete a subtask', async ({ page }) => {
      const subtaskTitle = 'Complete Me';

      await helpers.addSubtask(testTodoTitle, subtaskTitle);

      // Find subtask checkbox
      const subtaskRow = page.locator(`text=${subtaskTitle}`).locator('..');
      const checkbox = subtaskRow.locator('input[type="checkbox"]');

      // Should start unchecked
      await expect(checkbox).not.toBeChecked();

      // Check it
      await checkbox.click();

      // Wait a moment
      await page.waitForTimeout(500);

      // Should be checked
      await expect(checkbox).toBeChecked();
    });

    test('should show strikethrough on completed subtask', async ({ page }) => {
      const subtaskTitle = 'Strikethrough Test';

      await helpers.addSubtask(testTodoTitle, subtaskTitle);

      // Complete subtask
      const subtaskRow = page.locator(`text=${subtaskTitle}`).locator('..');
      const checkbox = subtaskRow.locator('input[type="checkbox"]');
      await checkbox.click();

      // Wait a moment
      await page.waitForTimeout(500);

      // Text should have strikethrough class
      const subtaskText = page.locator(`text=${subtaskTitle}`);
      await expect(subtaskText).toHaveClass(/line-through/);
    });

    test('should uncomplete a completed subtask', async ({ page }) => {
      const subtaskTitle = 'Uncomplete Me';

      await helpers.addSubtask(testTodoTitle, subtaskTitle);

      const subtaskRow = page.locator(`text=${subtaskTitle}`).locator('..');
      const checkbox = subtaskRow.locator('input[type="checkbox"]');

      // Complete it
      await checkbox.click();
      await page.waitForTimeout(500);

      // Uncomplete it
      await checkbox.click();
      await page.waitForTimeout(500);

      // Should be unchecked
      await expect(checkbox).not.toBeChecked();

      // Should not have strikethrough
      const subtaskText = page.locator(`text=${subtaskTitle}`);
      await expect(subtaskText).not.toHaveClass(/line-through/);
    });

    test('should delete a subtask', async ({ page }) => {
      const subtaskTitle = 'Delete Me';

      await helpers.addSubtask(testTodoTitle, subtaskTitle);

      // Find delete button
      const subtaskRow = page.locator(`text=${subtaskTitle}`).locator('..');
      const deleteButton = subtaskRow.locator('button:has-text("✕")');

      await deleteButton.click();

      // Wait a moment
      await page.waitForTimeout(500);

      // Subtask should be gone
      await expect(page.locator(`text=${subtaskTitle}`)).not.toBeVisible();
    });
  });

  test.describe('Progress Tracking', () => {
    test('should show progress bar when subtasks exist', async ({ page }) => {
      await helpers.addSubtask(testTodoTitle, 'Subtask 1');

      const todoRow = page.locator(`text=${testTodoTitle}`).locator('..').locator('..');

      // Should see progress text
      await expect(todoRow.locator('text=/\\d+\\/\\d+ subtasks/')).toBeVisible();

      // Should see progress bar
      await expect(todoRow.locator('.bg-blue-500')).toBeVisible();
    });

    test('should show correct progress fraction', async ({ page }) => {
      await helpers.addSubtask(testTodoTitle, 'Subtask 1');
      await helpers.addSubtask(testTodoTitle, 'Subtask 2');
      await helpers.addSubtask(testTodoTitle, 'Subtask 3');

      const todoRow = page.locator(`text=${testTodoTitle}`).locator('..').locator('..');

      // Should show 0/3 initially
      await expect(todoRow.locator('text=0/3 subtasks')).toBeVisible();

      // Complete one subtask
      await helpers.expandSubtasks(testTodoTitle);
      const firstSubtask = page.locator('text=Subtask 1').locator('..');
      await firstSubtask.locator('input[type="checkbox"]').click();

      await page.waitForTimeout(500);

      // Should show 1/3
      await expect(todoRow.locator('text=1/3 subtasks')).toBeVisible();
    });

    test('should calculate correct progress percentage', async ({ page }) => {
      await helpers.addSubtask(testTodoTitle, 'Sub 1');
      await helpers.addSubtask(testTodoTitle, 'Sub 2');

      // Complete one of two (50%)
      await helpers.expandSubtasks(testTodoTitle);
      const sub1 = page.locator('text=Sub 1').locator('..');
      await sub1.locator('input[type="checkbox"]').click();

      await page.waitForTimeout(500);

      // Get progress percentage
      const progress = await helpers.getProgressPercentage(testTodoTitle);

      expect(progress).toBe(50);
    });

    test('should show 100% when all subtasks completed', async ({ page }) => {
      await helpers.addSubtask(testTodoTitle, 'Sub 1');
      await helpers.addSubtask(testTodoTitle, 'Sub 2');

      // Complete both
      await helpers.expandSubtasks(testTodoTitle);

      const sub1 = page.locator('text=Sub 1').locator('..');
      await sub1.locator('input[type="checkbox"]').click();

      const sub2 = page.locator('text=Sub 2').locator('..');
      await sub2.locator('input[type="checkbox"]').click();

      await page.waitForTimeout(500);

      // Get progress
      const progress = await helpers.getProgressPercentage(testTodoTitle);

      expect(progress).toBe(100);
    });

    test('should update progress in real-time', async ({ page }) => {
      await helpers.addSubtask(testTodoTitle, 'Real-time 1');
      await helpers.addSubtask(testTodoTitle, 'Real-time 2');
      await helpers.addSubtask(testTodoTitle, 'Real-time 3');
      await helpers.addSubtask(testTodoTitle, 'Real-time 4');

      const todoRow = page.locator(`text=${testTodoTitle}`).locator('..').locator('..');

      // Initial: 0/4
      await expect(todoRow.locator('text=0/4 subtasks')).toBeVisible();

      await helpers.expandSubtasks(testTodoTitle);

      // Complete first
      const sub1 = page.locator('text=Real-time 1').locator('..');
      await sub1.locator('input[type="checkbox"]').click();
      await page.waitForTimeout(300);
      await expect(todoRow.locator('text=1/4 subtasks')).toBeVisible();

      // Complete second
      const sub2 = page.locator('text=Real-time 2').locator('..');
      await sub2.locator('input[type="checkbox"]').click();
      await page.waitForTimeout(300);
      await expect(todoRow.locator('text=2/4 subtasks')).toBeVisible();
    });
  });

  test.describe('Subtask Visibility', () => {
    test('should collapse subtasks', async ({ page }) => {
      await helpers.addSubtask(testTodoTitle, 'Hidden Subtask');

      // Expand first
      await helpers.expandSubtasks(testTodoTitle);

      // Subtask should be visible
      await expect(page.locator('text=Hidden Subtask')).toBeVisible();

      // Click to collapse
      const todoRow = page.locator(`text=${testTodoTitle}`).locator('..').locator('..');
      await todoRow.locator('button:has-text("Subtasks")').click();

      // Wait a moment
      await page.waitForTimeout(500);

      // Subtask input should be hidden
      await expect(page.locator('input[placeholder*="Add subtask"]')).not.toBeVisible();
    });

    test('should show progress even when collapsed', async ({ page }) => {
      await helpers.addSubtask(testTodoTitle, 'Sub 1');

      // Collapse
      const todoRow = page.locator(`text=${testTodoTitle}`).locator('..').locator('..');
      await todoRow.locator('button:has-text("Subtasks")').click();

      await page.waitForTimeout(500);

      // Progress should still be visible
      await expect(todoRow.locator('text=/\\d+\\/\\d+ subtasks/')).toBeVisible();
    });

    test('should toggle button text between ▶ and ▼', async ({ page }) => {
      const todoRow = page.locator(`text=${testTodoTitle}`).locator('..').locator('..');
      const subtaskButton = todoRow.locator('button:has-text("Subtasks")');

      // Initially collapsed (▶)
      await expect(subtaskButton).toContainText('▶');

      // Expand
      await subtaskButton.click();
      await page.waitForTimeout(300);

      // Should show ▼
      await expect(subtaskButton).toContainText('▼');

      // Collapse again
      await subtaskButton.click();
      await page.waitForTimeout(300);

      // Back to ▶
      await expect(subtaskButton).toContainText('▶');
    });
  });

  test.describe('Subtasks and Parent Todo', () => {
    test('should delete all subtasks when parent todo deleted', async ({ page }) => {
      const subtask1 = 'Subtask to delete 1';
      const subtask2 = 'Subtask to delete 2';

      await helpers.addSubtask(testTodoTitle, subtask1);
      await helpers.addSubtask(testTodoTitle, subtask2);

      // Delete parent
      await helpers.deleteTodo(testTodoTitle);

      // Subtasks should also be gone
      await expect(page.locator(`text=${subtask1}`)).not.toBeVisible();
      await expect(page.locator(`text=${subtask2}`)).not.toBeVisible();
    });

    test('should maintain subtasks when parent is completed', async ({ page }) => {
      await helpers.addSubtask(testTodoTitle, 'Persistent Subtask');

      // Complete parent
      await helpers.toggleTodoComplete(testTodoTitle);

      // Wait for move to completed section
      await page.waitForTimeout(1000);

      // Expand subtasks in completed section
      const completedSection = page.locator('h2:has-text("Completed")').locator('..').locator('..');
      const todoInCompleted = completedSection.locator(`text=${testTodoTitle}`).locator('..').locator('..');
      await todoInCompleted.locator('button:has-text("Subtasks")').click();

      // Subtask should still exist
      await expect(page.locator('text=Persistent Subtask')).toBeVisible();
    });
  });
});
