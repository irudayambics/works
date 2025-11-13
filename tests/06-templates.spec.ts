import { test, expect } from '@playwright/test';
import { TodoAppHelpers } from './helpers';

/**
 * Todo Templates Tests
 * Based on USER_GUIDE.md Section 9: Todo Templates
 *
 * Features tested:
 * - Save todo as template
 * - Use template to create todo
 * - Delete template
 * - Template with category
 * - Template preserves settings
 */

test.describe('Todo Templates', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test.describe('Creating Templates', () => {
    test('should show save template button when todo title is filled', async ({ page }) => {
      await page.fill('input[placeholder*="Add a new todo"]', 'Template Todo');

      // Save as Template button should appear
      await expect(page.locator('button:has-text("Save as Template")')).toBeVisible();
    });

    test('should not show save template button with empty title', async ({ page }) => {
      // Button should not be visible with empty input
      const saveButton = page.locator('button:has-text("Save as Template")');
      const isVisible = await saveButton.isVisible();

      expect(isVisible).toBeFalsy();
    });

    test('should save a template with name', async ({ page }) => {
      const templateName = 'Test Template ' + Date.now();

      await page.fill('input[placeholder*="Add a new todo"]', 'Weekly Meeting');
      await helpers.saveTemplate(templateName);

      // Template should be saved
      await page.click('button:text("📋 Templates")');

      // Should see template in list
      await expect(page.locator(`text=${templateName}`)).toBeVisible();
    });

    test('should save template with description', async ({ page }) => {
      const templateName = 'Described Template ' + Date.now();
      const description = 'This is a test template';

      await page.fill('input[placeholder*="Add a new todo"]', 'Task Title');
      await helpers.saveTemplate(templateName, description);

      // Open templates
      await page.click('button:text("📋 Templates")');

      // Should see description
      await expect(page.locator(`text=${description}`)).toBeVisible();
    });

    test('should save template with category', async ({ page }) => {
      const templateName = 'Categorized Template ' + Date.now();
      const category = 'Work';

      await page.fill('input[placeholder*="Add a new todo"]', 'Task Title');
      await helpers.saveTemplate(templateName, undefined, category);

      // Open templates
      await page.click('button:text("📋 Templates")');

      // Should see category
      await expect(page.locator(`text=${category}`)).toBeVisible();
    });

    test('should save template with priority', async ({ page }) => {
      const templateName = 'Priority Template ' + Date.now();

      await page.fill('input[placeholder*="Add a new todo"]', 'High Priority Task');
      await page.selectOption('select >> nth=0', 'high');

      await helpers.saveTemplate(templateName);

      // Open templates
      await page.click('button:text("📋 Templates")');

      // Should show High priority badge
      const templateRow = page.locator(`text=${templateName}`).locator('..');
      await expect(templateRow.locator('text=High')).toBeVisible();
    });

    test('should save template with recurrence settings', async ({ page }) => {
      const templateName = 'Recurring Template ' + Date.now();
      const dueDate = helpers.getSingaporeDateTime(60);

      await page.fill('input[placeholder*="Add a new todo"]', 'Weekly Task');
      await page.fill('input[type="datetime-local"]', dueDate);
      await page.check('input[type="checkbox"]:near(:text("Repeat"))');
      await page.selectOption('select:near(:text("Repeat"))', 'weekly');

      await helpers.saveTemplate(templateName);

      // Open templates
      await page.click('button:text("📋 Templates")');

      // Should show recurring badge
      const templateRow = page.locator(`text=${templateName}`).locator('..');
      await expect(templateRow.locator('text=🔄')).toBeVisible();
    });
  });

  test.describe('Using Templates', () => {
    test('should open templates modal', async ({ page }) => {
      await page.click('button:text("📋 Templates")');

      // Modal should open
      await expect(page.locator('text=Templates')).toBeVisible();
    });

    test('should use template to create todo', async ({ page }) => {
      const templateName = 'Use Template Test ' + Date.now();
      const todoTitle = 'Template Task';

      // Create template
      await page.fill('input[placeholder*="Add a new todo"]', todoTitle);
      await helpers.saveTemplate(templateName);

      // Use template
      await helpers.useTemplate(templateName);

      // Todo should be created
      await expect(page.locator(`text=${todoTitle}`)).toBeVisible();
    });

    test('should use template from dropdown', async ({ page }) => {
      const templateName = 'Dropdown Template ' + Date.now();

      await page.fill('input[placeholder*="Add a new todo"]', 'Dropdown Task');
      await helpers.saveTemplate(templateName);

      // Close any open modals
      await page.keyboard.press('Escape');

      // Use from dropdown
      await helpers.useTemplate(templateName);

      // Todo should be created
      await expect(page.locator('text=Dropdown Task')).toBeVisible();
    });

    test('should create todo with template priority', async ({ page }) => {
      const templateName = 'Priority Use ' + Date.now();

      await page.fill('input[placeholder*="Add a new todo"]', 'High Task');
      await page.selectOption('select >> nth=0', 'high');
      await helpers.saveTemplate(templateName);

      // Use template
      await helpers.useTemplate(templateName);

      // Todo should have high priority
      await helpers.verifyPriorityBadge('High Task', 'High');
    });

    test('should create todo with template recurrence', async ({ page }) => {
      const templateName = 'Recurrence Use ' + Date.now();
      const dueDate = helpers.getSingaporeDateTime(60);

      await page.fill('input[placeholder*="Add a new todo"]', 'Weekly Task');
      await page.fill('input[type="datetime-local"]', dueDate);
      await page.check('input[type="checkbox"]:near(:text("Repeat"))');
      await page.selectOption('select:near(:text("Repeat"))', 'weekly');

      await helpers.saveTemplate(templateName);

      // Use template
      await helpers.useTemplate(templateName);

      // Todo should be recurring
      await helpers.verifyRecurringBadge('Weekly Task', 'weekly');
    });

    test('should show category in template dropdown', async ({ page }) => {
      const templateName = 'Category Dropdown ' + Date.now();
      const category = 'TestCat';

      await page.fill('input[placeholder*="Add a new todo"]', 'Task');
      await helpers.saveTemplate(templateName, undefined, category);

      // Check dropdown
      const templateSelect = page.locator('select:near(:text("Use Template"))');
      const options = await templateSelect.locator('option').allTextContents();

      // Should include category
      const hasCategory = options.some(opt => opt.includes(category));
      expect(hasCategory).toBeTruthy();
    });
  });

  test.describe('Managing Templates', () => {
    test('should delete template', async ({ page }) => {
      const templateName = 'Delete Template ' + Date.now();

      await page.fill('input[placeholder*="Add a new todo"]', 'Task');
      await helpers.saveTemplate(templateName);

      // Open templates
      await page.click('button:text("📋 Templates")');

      // Delete template
      const templateRow = page.locator(`text=${templateName}`).locator('..');
      await templateRow.locator('button:text("Delete")').click();

      // Confirm
      page.once('dialog', dialog => dialog.accept());

      await page.waitForTimeout(500);

      // Template should be gone
      await expect(page.locator(`text=${templateName}`)).not.toBeVisible();
    });

    test('should not affect existing todos when template deleted', async ({ page }) => {
      const templateName = 'Non-Affecting Delete ' + Date.now();
      const todoTitle = 'Independent Todo';

      // Create and use template
      await page.fill('input[placeholder*="Add a new todo"]', todoTitle);
      await helpers.saveTemplate(templateName);
      await helpers.useTemplate(templateName);

      // Todo exists
      await expect(page.locator(`text=${todoTitle}`)).toBeVisible();

      // Delete template
      await page.click('button:text("📋 Templates")');
      const templateRow = page.locator(`text=${templateName}`).locator('..');
      await templateRow.locator('button:text("Delete")').click();
      page.once('dialog', dialog => dialog.accept());

      await page.waitForTimeout(500);

      // Todo should still exist
      await expect(page.locator(`text=${todoTitle}`)).toBeVisible();
    });

    test('should view template details in modal', async ({ page }) => {
      const templateName = 'Detail Template ' + Date.now();
      const description = 'Detailed description';
      const category = 'ViewCat';

      await page.fill('input[placeholder*="Add a new todo"]', 'Detail Task');
      await page.selectOption('select >> nth=0', 'high');
      await helpers.saveTemplate(templateName, description, category);

      // Open templates modal
      await page.click('button:text("📋 Templates")');

      // Should show all details
      const templateRow = page.locator(`text=${templateName}`).locator('..');

      await expect(templateRow.locator(`text=${description}`)).toBeVisible();
      await expect(templateRow.locator(`text=${category}`)).toBeVisible();
      await expect(templateRow.locator('text=High')).toBeVisible();
    });

    test('should close templates modal', async ({ page }) => {
      await page.click('button:text("📋 Templates")');

      // Modal should be open
      await expect(page.locator('text=Templates')).toBeVisible();

      // Close
      await page.keyboard.press('Escape');

      await page.waitForTimeout(500);

      // Should be closed (text in button still visible but not modal content)
      const modalContent = page.locator('[role="dialog"]');
      if (await modalContent.count() > 0) {
        await expect(modalContent).not.toBeVisible();
      }
    });

    test('should list all templates', async ({ page }) => {
      const template1 = 'Template 1 ' + Date.now();
      const template2 = 'Template 2 ' + Date.now();
      const template3 = 'Template 3 ' + Date.now();

      // Create multiple templates
      await page.fill('input[placeholder*="Add a new todo"]', 'Task 1');
      await helpers.saveTemplate(template1);

      await page.fill('input[placeholder*="Add a new todo"]', 'Task 2');
      await helpers.saveTemplate(template2);

      await page.fill('input[placeholder*="Add a new todo"]', 'Task 3');
      await helpers.saveTemplate(template3);

      // Open templates modal
      await page.click('button:text("📋 Templates")');

      // All should be visible
      await expect(page.locator(`text=${template1}`)).toBeVisible();
      await expect(page.locator(`text=${template2}`)).toBeVisible();
      await expect(page.locator(`text=${template3}`)).toBeVisible();
    });
  });

  test.describe('Template Categories', () => {
    test('should display category badge', async ({ page }) => {
      const templateName = 'Badge Category ' + Date.now();
      const category = 'Work';

      await page.fill('input[placeholder*="Add a new todo"]', 'Task');
      await helpers.saveTemplate(templateName, undefined, category);

      await page.click('button:text("📋 Templates")');

      // Category should have badge styling
      const categoryElement = page.locator(`text=${category}`);
      await expect(categoryElement).toHaveClass(/rounded/);
    });

    test('should group templates by category visually', async ({ page }) => {
      const workTemplate = 'Work Template ' + Date.now();
      const personalTemplate = 'Personal Template ' + Date.now();

      await page.fill('input[placeholder*="Add a new todo"]', 'Work Task');
      await helpers.saveTemplate(workTemplate, undefined, 'Work');

      await page.fill('input[placeholder*="Add a new todo"]', 'Personal Task');
      await helpers.saveTemplate(personalTemplate, undefined, 'Personal');

      await page.click('button:text("📋 Templates")');

      // Both should be visible with their categories
      await expect(page.locator(`text=${workTemplate}`)).toBeVisible();
      await expect(page.locator(`text=${personalTemplate}`)).toBeVisible();
      await expect(page.locator('text=Work')).toBeVisible();
      await expect(page.locator('text=Personal')).toBeVisible();
    });
  });
});
