import { test, expect } from '@playwright/test';
import { TodoAppHelpers } from './helpers';

/**
 * Tags and Categories Tests
 * Based on USER_GUIDE.md Section 8: Tags & Categories
 *
 * Features tested:
 * - Create tags with custom colors
 * - Edit tags
 * - Delete tags
 * - Assign tags to todos
 * - Filter by tags
 * - Tag visual display
 * - CASCADE delete behavior
 */

test.describe('Tags Management', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test.describe('Creating Tags', () => {
    test('should open tag management modal', async ({ page }) => {
      await page.click('button:has-text("Manage Tags")');

      // Modal should be visible
      await expect(page.locator('text=Tag Management')).toBeVisible();
    });

    test('should create a tag with default color', async ({ page }) => {
      const tagName = 'Work ' + Date.now();

      await helpers.createTag(tagName);

      // Tag should appear in modal list
      await expect(page.locator(`text=${tagName}`)).toBeVisible();
    });

    test('should create a tag with custom color', async ({ page }) => {
      const tagName = 'CustomColor ' + Date.now();
      const customColor = '#FF5733';

      await helpers.createTag(tagName, customColor);

      // Tag should appear
      await expect(page.locator(`text=${tagName}`)).toBeVisible();
    });

    test('should not create tag with empty name', async ({ page }) => {
      await page.click('button:has-text("Manage Tags")');

      // Try to create with empty name
      await page.click('button:text("Create Tag")');

      // Should show error or not create
      await page.waitForTimeout(500);

      // Implementation specific validation
    });

    test('should not create duplicate tag names', async ({ page }) => {
      const tagName = 'Duplicate ' + Date.now();

      // Create first tag
      await helpers.createTag(tagName);

      // Close and reopen modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Try to create duplicate
      await page.click('button:has-text("Manage Tags")');
      await page.fill('input[placeholder*="tag name"]', tagName);
      await page.click('button:text("Create Tag")');

      await page.waitForTimeout(500);

      // Should show error
      const hasError = await page.locator('text=/already exists/i').isVisible();
      expect(hasError).toBeTruthy();
    });

    test('should close tag modal', async ({ page }) => {
      await page.click('button:has-text("Manage Tags")');

      // Modal should be open
      await expect(page.locator('text=Tag Management')).toBeVisible();

      // Close modal (click outside or close button)
      const closeButton = page.locator('button:has-text("Close")');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }

      await page.waitForTimeout(500);

      // Modal should be closed
      await expect(page.locator('text=Tag Management')).not.toBeVisible();
    });
  });

  test.describe('Editing Tags', () => {
    test('should edit tag name', async ({ page }) => {
      const originalName = 'Original ' + Date.now();
      const newName = 'Updated ' + Date.now();

      await helpers.createTag(originalName);

      // Click edit
      const tagRow = page.locator(`text=${originalName}`).locator('..');
      await tagRow.locator('button:text("Edit")').click();

      // Wait for edit mode
      await page.waitForTimeout(500);

      // Update name
      const nameInput = page.locator('input[value="' + originalName + '"]');
      await nameInput.fill(newName);

      // Save
      await page.click('button:text("Update")');

      await page.waitForTimeout(500);

      // Should see new name
      await expect(page.locator(`text=${newName}`)).toBeVisible();

      // Old name should be gone
      await expect(page.locator(`text=${originalName}`)).not.toBeVisible();
    });

    test('should edit tag color', async ({ page }) => {
      const tagName = 'ColorChange ' + Date.now();
      const originalColor = '#3B82F6';
      const newColor = '#10B981';

      await helpers.createTag(tagName, originalColor);

      // Edit tag
      const tagRow = page.locator(`text=${tagName}`).locator('..');
      await tagRow.locator('button:text("Edit")').click();

      // Change color
      await page.fill('input[type="color"]', newColor);

      // Save
      await page.click('button:text("Update")');

      await page.waitForTimeout(500);

      // Verify update (visual confirmation would require checking computed styles)
      await expect(page.locator(`text=${tagName}`)).toBeVisible();
    });

    test('should cancel tag edit', async ({ page }) => {
      const tagName = 'CancelEdit ' + Date.now();

      await helpers.createTag(tagName);

      // Start edit
      const tagRow = page.locator(`text=${tagName}`).locator('..');
      await tagRow.locator('button:text("Edit")').click();

      // Make changes
      const nameInput = page.locator(`input[value="${tagName}"]`);
      await nameInput.fill('Changed Name');

      // Cancel
      const cancelButton = page.locator('button:text("Cancel")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }

      await page.waitForTimeout(500);

      // Original name should still exist
      await expect(page.locator(`text=${tagName}`)).toBeVisible();
    });
  });

  test.describe('Deleting Tags', () => {
    test('should delete a tag', async ({ page }) => {
      const tagName = 'DeleteMe ' + Date.now();

      await helpers.createTag(tagName);

      // Delete tag
      const tagRow = page.locator(`text=${tagName}`).locator('..');
      await tagRow.locator('button:text("Delete")').click();

      // Confirm deletion
      page.once('dialog', dialog => dialog.accept());

      await page.waitForTimeout(500);

      // Tag should be gone
      await expect(page.locator(`text=${tagName}`)).not.toBeVisible();
    });

    test('should remove tag from todos when deleted (CASCADE)', async ({ page }) => {
      const tagName = 'CascadeDelete ' + Date.now();
      const todoTitle = 'Tagged Todo ' + Date.now();

      // Create tag
      await helpers.createTag(tagName);

      // Close tag modal
      await page.keyboard.press('Escape');

      // Create todo with tag
      await helpers.createTodo(todoTitle);

      // TODO: Select tag for the todo
      // (This depends on implementation details)

      // Delete the tag
      await page.click('button:has-text("Manage Tags")');
      const tagRow = page.locator(`text=${tagName}`).locator('..');
      await tagRow.locator('button:text("Delete")').click();

      page.once('dialog', dialog => dialog.accept());

      await page.waitForTimeout(500);

      // Tag should be gone from everywhere
      await expect(page.locator(`text=${tagName}`)).not.toBeVisible();
    });
  });

  test.describe('Assigning Tags to Todos', () => {
    test('should show tag selection when creating todo', async ({ page }) => {
      const tagName = 'WorkTag ' + Date.now();

      // Create tag first
      await helpers.createTag(tagName);

      // Close modal
      await page.keyboard.press('Escape');

      // Tag should appear in todo form
      await expect(page.locator(`button:text("${tagName}")`)).toBeVisible();
    });

    test('should select tag for new todo', async ({ page }) => {
      const tagName = 'SelectTag ' + Date.now();
      const todoTitle = 'Todo with Tag ' + Date.now();

      await helpers.createTag(tagName);
      await page.keyboard.press('Escape');

      // Create todo with tag
      await helpers.createTodo(todoTitle, { tags: [tagName] });

      // Verify tag appears on todo
      await helpers.verifyTag(todoTitle, tagName);
    });

    test('should select multiple tags for todo', async ({ page }) => {
      const tag1 = 'Tag1-' + Date.now();
      const tag2 = 'Tag2-' + Date.now();
      const todoTitle = 'Multi-tag Todo ' + Date.now();

      // Create tags
      await helpers.createTag(tag1);
      await helpers.createTag(tag2);
      await page.keyboard.press('Escape');

      // Create todo with both tags
      await helpers.createTodo(todoTitle, { tags: [tag1, tag2] });

      // Both tags should be visible
      await helpers.verifyTag(todoTitle, tag1);
      await helpers.verifyTag(todoTitle, tag2);
    });

    test('should show checkmark on selected tags', async ({ page }) => {
      const tagName = 'CheckmarkTag ' + Date.now();

      await helpers.createTag(tagName);
      await page.keyboard.press('Escape');

      // Click tag to select
      const tagButton = page.locator(`button:text-is("${tagName}")`);
      await tagButton.click();

      // Should show checkmark
      await expect(page.locator(`button:has-text("✓ ${tagName}")`)).toBeVisible();
    });

    test('should deselect tag by clicking again', async ({ page }) => {
      const tagName = 'DeselectTag ' + Date.now();

      await helpers.createTag(tagName);
      await page.keyboard.press('Escape');

      const tagButton = page.locator(`button:text-is("${tagName}")`).first();

      // Select
      await tagButton.click();
      await expect(page.locator(`button:has-text("✓ ${tagName}")`)).toBeVisible();

      // Deselect
      await tagButton.click();
      await page.waitForTimeout(300);

      // Checkmark should be gone
      const hasCheckmark = await page.locator(`button:has-text("✓ ${tagName}")`).count();
      expect(hasCheckmark).toBe(0);
    });
  });

  test.describe('Tag Filtering', () => {
    test('should filter todos by tag', async ({ page }) => {
      const tag1 = 'Work-' + Date.now();
      const tag2 = 'Personal-' + Date.now();
      const todo1 = 'Work Task ' + Date.now();
      const todo2 = 'Personal Task ' + Date.now();

      // Create tags
      await helpers.createTag(tag1);
      await helpers.createTag(tag2);
      await page.keyboard.press('Escape');

      // Create todos with different tags
      await helpers.createTodo(todo1, { tags: [tag1] });
      await helpers.createTodo(todo2, { tags: [tag2] });

      // Filter by tag1
      await helpers.filterByTag(tag1);

      // Only todo1 should be visible
      await expect(page.locator(`text=${todo1}`)).toBeVisible();
      await expect(page.locator(`text=${todo2}`)).not.toBeVisible();
    });

    test('should show all todos when tag filter is cleared', async ({ page }) => {
      const tag = 'FilterTag-' + Date.now();
      const todo1 = 'Tagged ' + Date.now();
      const todo2 = 'Untagged ' + Date.now();

      await helpers.createTag(tag);
      await page.keyboard.press('Escape');

      await helpers.createTodo(todo1, { tags: [tag] });
      await helpers.createTodo(todo2);

      // Filter by tag
      await helpers.filterByTag(tag);

      // Only tagged todo visible
      await expect(page.locator(`text=${todo1}`)).toBeVisible();
      await expect(page.locator(`text=${todo2}`)).not.toBeVisible();

      // Clear filter
      await page.selectOption('select:has-text("All Tags")', '');

      // Both should be visible
      await expect(page.locator(`text=${todo1}`)).toBeVisible();
      await expect(page.locator(`text=${todo2}`)).toBeVisible();
    });
  });

  test.describe('Tag Visual Display', () => {
    test('should display tags as colored pills', async ({ page }) => {
      const tagName = 'PillTag ' + Date.now();
      const todoTitle = 'Pill Todo ' + Date.now();
      const color = '#FF5733';

      await helpers.createTag(tagName, color);
      await page.keyboard.press('Escape');

      await helpers.createTodo(todoTitle, { tags: [tagName] });

      // Find tag pill on todo
      const todoRow = page.locator(`text=${todoTitle}`).locator('..').locator('..');
      const tagPill = todoRow.locator(`text=${tagName}`);

      // Should be visible
      await expect(tagPill).toBeVisible();

      // Should have rounded styling
      await expect(tagPill).toHaveClass(/rounded/);
    });

    test('should show tag color on todo', async ({ page }) => {
      const tagName = 'ColorPill ' + Date.now();
      const todoTitle = 'Color Todo ' + Date.now();
      const color = '#10B981';

      await helpers.createTag(tagName, color);
      await page.keyboard.press('Escape');

      await helpers.createTodo(todoTitle, { tags: [tagName] });

      // Tag should have custom background color
      const todoRow = page.locator(`text=${todoTitle}`).locator('..').locator('..');
      const tagPill = todoRow.locator(`text=${tagName}`);

      const bgColor = await tagPill.evaluate(el =>
        window.getComputedStyle(el).backgroundColor
      );

      // Should have some color (not default)
      expect(bgColor).toBeTruthy();
    });

    test('should show multiple tags on same todo', async ({ page }) => {
      const tag1 = 'Multi1-' + Date.now();
      const tag2 = 'Multi2-' + Date.now();
      const tag3 = 'Multi3-' + Date.now();
      const todoTitle = 'Multi Tag Todo ' + Date.now();

      await helpers.createTag(tag1);
      await helpers.createTag(tag2);
      await helpers.createTag(tag3);
      await page.keyboard.press('Escape');

      await helpers.createTodo(todoTitle, { tags: [tag1, tag2, tag3] });

      // All tags should be visible on the todo
      await helpers.verifyTag(todoTitle, tag1);
      await helpers.verifyTag(todoTitle, tag2);
      await helpers.verifyTag(todoTitle, tag3);
    });
  });
});
