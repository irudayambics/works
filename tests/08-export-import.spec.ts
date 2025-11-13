import { test, expect } from '@playwright/test';
import { TodoAppHelpers } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Export and Import Tests
 * Based on USER_GUIDE.md Section 11: Export & Import
 *
 * Features tested:
 * - Export as JSON
 * - Export as CSV
 * - Import from JSON
 * - File format validation
 * - Data preservation
 */

test.describe('Export Functionality', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should have Export JSON button', async ({ page }) => {
    await expect(page.locator('button:text("Export JSON")')).toBeVisible();
  });

  test('should have Export CSV button', async ({ page }) => {
    await expect(page.locator('button:text("Export CSV")')).toBeVisible();
  });

  test('should export JSON file', async ({ page }) => {
    // Create a todo first
    await helpers.createTodo('Export Test Todo');

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export JSON")');

    const download = await downloadPromise;
    const filename = download.suggestedFilename();

    // Filename should match pattern todos-YYYY-MM-DD.json
    expect(filename).toMatch(/todos-\d{4}-\d{2}-\d{2}\.json/);
  });

  test('should export CSV file', async ({ page }) => {
    await helpers.createTodo('CSV Export Todo');

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export CSV")');

    const download = await downloadPromise;
    const filename = download.suggestedFilename();

    // Filename should match pattern todos-YYYY-MM-DD.csv
    expect(filename).toMatch(/todos-\d{4}-\d{2}-\d{2}\.csv/);
  });

  test('should export JSON with correct data structure', async ({ page }) => {
    const todoTitle = 'JSON Structure Test ' + Date.now();

    await helpers.createTodo(todoTitle, {
      priority: 'high',
      dueDate: helpers.getSingaporeDateTime(60)
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export JSON")');

    const download = await downloadPromise;
    const downloadPath = await download.path();

    if (downloadPath) {
      const content = fs.readFileSync(downloadPath, 'utf-8');
      const data = JSON.parse(content);

      // Should be an array
      expect(Array.isArray(data)).toBeTruthy();

      // Should contain our todo
      const todo = data.find((t: any) => t.title === todoTitle);
      expect(todo).toBeDefined();
      expect(todo.priority).toBe('high');
      expect(todo.due_date).toBeDefined();
    }
  });

  test('should export CSV with proper columns', async ({ page }) => {
    await helpers.createTodo('CSV Column Test');

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export CSV")');

    const download = await downloadPromise;
    const downloadPath = await download.path();

    if (downloadPath) {
      const content = fs.readFileSync(downloadPath, 'utf-8');
      const lines = content.split('\n');

      // First line should be headers
      const headers = lines[0];
      expect(headers).toContain('ID');
      expect(headers).toContain('Title');
      expect(headers).toContain('Completed');
      expect(headers).toContain('Priority');
    }
  });

  test('should export all todos including completed', async ({ page }) => {
    const todo1 = 'Active Todo ' + Date.now();
    const todo2 = 'Completed Todo ' + Date.now();

    await helpers.createTodo(todo1);
    await helpers.createTodo(todo2);
    await helpers.toggleTodoComplete(todo2);

    await page.waitForTimeout(1000);

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export JSON")');

    const download = await downloadPromise;
    const downloadPath = await download.path();

    if (downloadPath) {
      const content = fs.readFileSync(downloadPath, 'utf-8');
      const data = JSON.parse(content);

      // Should have both todos
      const activeTodo = data.find((t: any) => t.title === todo1);
      const completedTodo = data.find((t: any) => t.title === todo2);

      expect(activeTodo).toBeDefined();
      expect(completedTodo).toBeDefined();
      expect(completedTodo.completed).toBeTruthy();
    }
  });

  test('should export recurring todos with pattern', async ({ page }) => {
    const recurringTitle = 'Recurring Export ' + Date.now();

    await helpers.createTodo(recurringTitle, {
      dueDate: helpers.getSingaporeDateTime(60),
      recurring: true,
      recurrencePattern: 'weekly'
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export JSON")');

    const download = await downloadPromise;
    const downloadPath = await download.path();

    if (downloadPath) {
      const content = fs.readFileSync(downloadPath, 'utf-8');
      const data = JSON.parse(content);

      const todo = data.find((t: any) => t.title === recurringTitle);
      expect(todo.is_recurring).toBeTruthy();
      expect(todo.recurrence_pattern).toBe('weekly');
    }
  });
});

test.describe('Import Functionality', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should have Import button', async ({ page }) => {
    await expect(page.locator('button:text("Import")')).toBeVisible();
  });

  test('should have hidden file input', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);
    await expect(fileInput).toHaveAttribute('accept', '.json');
  });

  test('should import valid JSON file', async ({ page }) => {
    // Create a test JSON file
    const testData = [
      {
        title: 'Imported Todo ' + Date.now(),
        completed: false,
        priority: 'medium',
        due_date: null
      }
    ];

    const tempFile = path.join('/tmp', `test-import-${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(testData));

    // Import the file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tempFile);

    // Wait for import
    await page.waitForTimeout(2000);

    // Todo should appear
    await expect(page.locator(`text=${testData[0].title}`)).toBeVisible();

    // Cleanup
    fs.unlinkSync(tempFile);
  });

  test('should import multiple todos at once', async ({ page }) => {
    const testData = [
      { title: 'Import 1 ' + Date.now(), completed: false, priority: 'high' },
      { title: 'Import 2 ' + Date.now(), completed: false, priority: 'medium' },
      { title: 'Import 3 ' + Date.now(), completed: false, priority: 'low' }
    ];

    const tempFile = path.join('/tmp', `test-import-${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(testData));

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tempFile);

    await page.waitForTimeout(2000);

    // All should be visible
    for (const todo of testData) {
      await expect(page.locator(`text=${todo.title}`)).toBeVisible();
    }

    fs.unlinkSync(tempFile);
  });

  test('should show error for invalid JSON', async ({ page }) => {
    const tempFile = path.join('/tmp', `invalid-${Date.now()}.json`);
    fs.writeFileSync(tempFile, 'invalid json content {{{');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tempFile);

    await page.waitForTimeout(1000);

    // Should show error message
    page.once('dialog', dialog => {
      expect(dialog.message()).toMatch(/failed|error|invalid/i);
      dialog.accept();
    });

    fs.unlinkSync(tempFile);
  });

  test('should preserve todo properties on import', async ({ page }) => {
    const testData = [
      {
        title: 'Preserved Todo ' + Date.now(),
        completed: true,
        priority: 'high',
        is_recurring: true,
        recurrence_pattern: 'daily',
        due_date: helpers.getSingaporeDateTime(60)
      }
    ];

    const tempFile = path.join('/tmp', `preserve-test-${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(testData));

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tempFile);

    await page.waitForTimeout(2000);

    // Check if properties are preserved
    const todoTitle = testData[0].title;
    await expect(page.locator(`text=${todoTitle}`)).toBeVisible();

    // Should have high priority badge
    await helpers.verifyPriorityBadge(todoTitle, 'High');

    // Should have recurring badge
    await helpers.verifyRecurringBadge(todoTitle, 'daily');

    fs.unlinkSync(tempFile);
  });

  test('should reset file input after import', async ({ page }) => {
    const testData = [{ title: 'Reset Test', completed: false, priority: 'medium' }];

    const tempFile = path.join('/tmp', `reset-test-${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(testData));

    const fileInput = page.locator('input[type="file"]');

    // Import once
    await fileInput.setInputFiles(tempFile);
    await page.waitForTimeout(1000);

    // File input should be reset
    const inputValue = await fileInput.inputValue();
    expect(inputValue).toBe('');

    fs.unlinkSync(tempFile);
  });

  test('should show success message after import', async ({ page }) => {
    const testData = [{ title: 'Success Test', completed: false, priority: 'medium' }];

    const tempFile = path.join('/tmp', `success-test-${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(testData));

    const fileInput = page.locator('input[type="file"]');

    // Listen for alert
    page.once('dialog', async dialog => {
      expect(dialog.message()).toMatch(/success|imported/i);
      await dialog.accept();
    });

    await fileInput.setInputFiles(tempFile);
    await page.waitForTimeout(2000);

    fs.unlinkSync(tempFile);
  });
});

test.describe('Export-Import Round Trip', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should export and re-import data successfully', async ({ page }) => {
    const originalTitle = 'Round Trip Test ' + Date.now();

    // Create a todo
    await helpers.createTodo(originalTitle, {
      priority: 'high',
      dueDate: helpers.getSingaporeDateTime(60)
    });

    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export JSON")');

    const download = await downloadPromise;
    const exportPath = await download.path();

    if (exportPath) {
      // Delete the original todo
      await helpers.deleteTodo(originalTitle);

      // Verify it's gone
      await expect(page.locator(`text=${originalTitle}`)).not.toBeVisible();

      // Re-import
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(exportPath);

      await page.waitForTimeout(2000);

      // Todo should be back
      await expect(page.locator(`text=${originalTitle}`)).toBeVisible();

      // Should have correct priority
      await helpers.verifyPriorityBadge(originalTitle, 'High');
    }
  });

  test('should maintain data integrity through export-import', async ({ page }) => {
    const todo1 = 'Integrity Test 1 ' + Date.now();
    const todo2 = 'Integrity Test 2 ' + Date.now();

    await helpers.createTodo(todo1, { priority: 'high' });
    await helpers.createTodo(todo2, { priority: 'low' });
    await helpers.toggleTodoComplete(todo2);

    await page.waitForTimeout(1000);

    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export JSON")');

    const download = await downloadPromise;
    const exportPath = await download.path();

    if (exportPath) {
      // Read exported data
      const exportedContent = fs.readFileSync(exportPath, 'utf-8');
      const exportedData = JSON.parse(exportedContent);

      // Verify structure
      expect(Array.isArray(exportedData)).toBeTruthy();

      const exportedTodo1 = exportedData.find((t: any) => t.title === todo1);
      const exportedTodo2 = exportedData.find((t: any) => t.title === todo2);

      expect(exportedTodo1.priority).toBe('high');
      expect(exportedTodo1.completed).toBeFalsy();

      expect(exportedTodo2.priority).toBe('low');
      expect(exportedTodo2.completed).toBeTruthy();
    }
  });
});

test.describe('File Format Validation', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should only accept JSON files for import', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    const acceptAttr = await fileInput.getAttribute('accept');

    expect(acceptAttr).toBe('.json');
  });

  test('should handle empty JSON array', async ({ page }) => {
    const tempFile = path.join('/tmp', `empty-${Date.now()}.json`);
    fs.writeFileSync(tempFile, '[]');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tempFile);

    await page.waitForTimeout(1000);

    // Should handle gracefully (might show "0 todos imported" message)
    // No error should occur

    fs.unlinkSync(tempFile);
  });

  test('should handle large JSON files', async ({ page }) => {
    // Create 100 todos
    const testData = Array.from({ length: 100 }, (_, i) => ({
      title: `Large Import Todo ${i}`,
      completed: false,
      priority: 'medium'
    }));

    const tempFile = path.join('/tmp', `large-${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(testData));

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tempFile);

    // Wait longer for large import
    await page.waitForTimeout(5000);

    // Check if some todos were imported
    await expect(page.locator('text=Large Import Todo 0')).toBeVisible();

    fs.unlinkSync(tempFile);
  });
});
