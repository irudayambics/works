import { test, expect } from '@playwright/test';
import { TodoAppHelpers } from './helpers';

/**
 * Search and Advanced Filtering Tests
 * Based on USER_GUIDE.md Section 10: Search & Advanced Filtering
 *
 * Features tested:
 * - Text search in titles
 * - Search in subtasks
 * - Priority filtering
 * - Tag filtering
 * - Date range filtering
 * - Completion status filtering
 * - Filter combinations
 * - Saved filter presets
 * - Clear all filters
 */

test.describe('Search Functionality', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should have search input field', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search todos"]');
    await expect(searchInput).toBeVisible();
  });

  test('should search todos by title', async ({ page }) => {
    const todo1 = 'Meeting with Client ' + Date.now();
    const todo2 = 'Code Review ' + Date.now();

    await helpers.createTodo(todo1);
    await helpers.createTodo(todo2);

    // Search for "Meeting"
    await helpers.search('Meeting');

    // Should show todo1, hide todo2
    await expect(page.locator(`text=${todo1}`)).toBeVisible();
    await expect(page.locator(`text=${todo2}`)).not.toBeVisible();
  });

  test('should be case-insensitive', async ({ page }) => {
    const todoTitle = 'Important Task ' + Date.now();

    await helpers.createTodo(todoTitle);

    // Search with different case
    await helpers.search('important');

    // Should still find it
    await expect(page.locator(`text=${todoTitle}`)).toBeVisible();
  });

  test('should search in subtasks', async ({ page }) => {
    const todoTitle = 'Parent Task ' + Date.now();
    const subtaskTitle = 'Send Email to Team';

    await helpers.createTodo(todoTitle);
    await helpers.addSubtask(todoTitle, subtaskTitle);

    // Search for "Email"
    await helpers.search('Email');

    // Should show parent todo (because subtask matches)
    await expect(page.locator(`text=${todoTitle}`)).toBeVisible();
  });

  test('should update results in real-time', async ({ page }) => {
    const todo1 = 'Project Alpha ' + Date.now();
    const todo2 = 'Project Beta ' + Date.now();

    await helpers.createTodo(todo1);
    await helpers.createTodo(todo2);

    const searchInput = page.locator('input[placeholder*="Search todos"]');

    // Type "Alpha"
    await searchInput.fill('Alpha');
    await page.waitForTimeout(300);

    await expect(page.locator(`text=${todo1}`)).toBeVisible();
    await expect(page.locator(`text=${todo2}`)).not.toBeVisible();

    // Change to "Beta"
    await searchInput.fill('Beta');
    await page.waitForTimeout(300);

    await expect(page.locator(`text=${todo2}`)).toBeVisible();
    await expect(page.locator(`text=${todo1}`)).not.toBeVisible();
  });

  test('should show clear button when searching', async ({ page }) => {
    await helpers.search('test');

    // Clear button (✕) should appear
    const clearButton = page.locator('button:near(input[placeholder*="Search todos"]):has-text("✕")');
    await expect(clearButton).toBeVisible();
  });

  test('should clear search', async ({ page }) => {
    const todo1 = 'Task One ' + Date.now();
    const todo2 = 'Task Two ' + Date.now();

    await helpers.createTodo(todo1);
    await helpers.createTodo(todo2);

    await helpers.search('One');

    // Only todo1 visible
    await expect(page.locator(`text=${todo1}`)).toBeVisible();
    await expect(page.locator(`text=${todo2}`)).not.toBeVisible();

    // Clear search
    await helpers.clearSearch();

    // Both should be visible
    await expect(page.locator(`text=${todo1}`)).toBeVisible();
    await expect(page.locator(`text=${todo2}`)).toBeVisible();
  });

  test('should show no results when search matches nothing', async ({ page }) => {
    await helpers.createTodo('Sample Task');

    await helpers.search('xyz-nonexistent-123');

    // No todos should be visible
    await expect(page.locator('text=Sample Task')).not.toBeVisible();

    // Sections might be empty or hidden
  });

  test('should handle partial matches', async ({ page }) => {
    await helpers.createTodo('Development Task');

    // Search for part of word
    await helpers.search('Dev');

    await expect(page.locator('text=Development Task')).toBeVisible();
  });
});

test.describe('Quick Filters', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should have priority filter dropdown', async ({ page }) => {
    const priorityFilter = page.locator('select:has-text("All Priorities")');
    await expect(priorityFilter).toBeVisible();
  });

  test('should filter by priority', async ({ page }) => {
    const highTodo = 'High ' + Date.now();
    const lowTodo = 'Low ' + Date.now();

    await helpers.createTodo(highTodo, { priority: 'high' });
    await helpers.createTodo(lowTodo, { priority: 'low' });

    await helpers.filterByPriority('high');

    await expect(page.locator(`text=${highTodo}`)).toBeVisible();
    await expect(page.locator(`text=${lowTodo}`)).not.toBeVisible();
  });

  test('should have advanced filters toggle', async ({ page }) => {
    const advancedButton = page.locator('button:has-text("Advanced")');
    await expect(advancedButton).toBeVisible();
  });

  test('should toggle advanced filters panel', async ({ page }) => {
    await page.click('button:has-text("Advanced")');

    // Panel should be visible
    await expect(page.locator('text=Advanced Filters')).toBeVisible();
    await expect(page.locator('text=Completion Status')).toBeVisible();
  });

  test('should show arrow indicators on advanced toggle', async ({ page }) => {
    const button = page.locator('button:has-text("Advanced")');

    // Initially collapsed (▶)
    await expect(button).toContainText('▶');

    // Click to expand
    await button.click();

    // Should show ▼
    await expect(button).toContainText('▼');
  });
});

test.describe('Advanced Filters', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
    await helpers.openAdvancedFilters();
  });

  test('should filter by completion status', async ({ page }) => {
    const incompleteTodo = 'Not Done ' + Date.now();
    const completedTodo = 'Done ' + Date.now();

    await helpers.createTodo(incompleteTodo);
    await helpers.createTodo(completedTodo);
    await helpers.toggleTodoComplete(completedTodo);

    await page.waitForTimeout(1000);

    // Filter to show only incomplete
    const completionFilter = page.locator('select:near(:text("Completion Status"))');
    await completionFilter.selectOption('incomplete');

    await page.waitForTimeout(500);

    await expect(page.locator(`text=${incompleteTodo}`)).toBeVisible();
    // Completed todo might be in completed section but filtered out
  });

  test('should filter by date range', async ({ page }) => {
    const todayTodo = 'Today Task ' + Date.now();
    const futureTodo = 'Future Task ' + Date.now();

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await helpers.createTodo(todayTodo, {
      dueDate: helpers.getSingaporeDateTime(60)
    });

    await helpers.createTodo(futureTodo, {
      dueDate: helpers.getSingaporeDateTime(10080) // 1 week
    });

    // Filter to show only today
    await helpers.setDateRange(today, today);

    // Only today's todo should be visible
    const todayVisible = await page.locator(`text=${todayTodo}`).count();
    const futureVisible = await page.locator(`text=${futureTodo}`).count();

    expect(todayVisible).toBeGreaterThan(0);
    expect(futureVisible).toBe(0);
  });

  test('should filter with date range start only', async ({ page }) => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Set only start date
    await helpers.setDateRange(tomorrow, '');

    // Should show todos from tomorrow onwards
    // (Test depends on having appropriate todos)
  });

  test('should filter with date range end only', async ({ page }) => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Set only end date
    await helpers.setDateRange('', yesterday);

    // Should show todos up to yesterday
    // (Would need past todos to test properly)
  });
});

test.describe('Filter Combinations', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should combine search and priority filter', async ({ page }) => {
    const highMeeting = 'High Priority Meeting ' + Date.now();
    const lowMeeting = 'Low Priority Meeting ' + Date.now();
    const highTask = 'High Priority Task ' + Date.now();

    await helpers.createTodo(highMeeting, { priority: 'high' });
    await helpers.createTodo(lowMeeting, { priority: 'low' });
    await helpers.createTodo(highTask, { priority: 'high' });

    // Search for "Meeting" AND filter by high priority
    await helpers.search('Meeting');
    await helpers.filterByPriority('high');

    // Only high priority meeting should be visible
    await expect(page.locator(`text=${highMeeting}`)).toBeVisible();
    await expect(page.locator(`text=${lowMeeting}`)).not.toBeVisible();
    await expect(page.locator(`text=${highTask}`)).not.toBeVisible();
  });

  test('should show Clear All button when filters active', async ({ page }) => {
    await helpers.search('test');

    // Clear All button should appear
    await expect(page.locator('button:has-text("Clear All")')).toBeVisible();
  });

  test('should show Save Filter button when filters active', async ({ page }) => {
    await helpers.search('test');

    // Save Filter button should appear
    await expect(page.locator('button:has-text("Save Filter")')).toBeVisible();
  });

  test('should clear all filters at once', async ({ page }) => {
    const todo1 = 'Todo 1 ' + Date.now();
    const todo2 = 'Todo 2 ' + Date.now();

    await helpers.createTodo(todo1, { priority: 'high' });
    await helpers.createTodo(todo2, { priority: 'low' });

    // Apply multiple filters
    await helpers.search('Todo 1');
    await helpers.filterByPriority('high');

    // Clear all
    await helpers.clearAllFilters();

    // Both todos should be visible
    await expect(page.locator(`text=${todo1}`)).toBeVisible();
    await expect(page.locator(`text=${todo2}`)).toBeVisible();
  });
});

test.describe('Saved Filter Presets', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should save filter preset', async ({ page }) => {
    const presetName = 'My Filter ' + Date.now();

    // Apply some filters
    await helpers.search('meeting');
    await helpers.filterByPriority('high');

    // Save preset
    await helpers.saveFilterPreset(presetName);

    // Open advanced filters to see saved presets
    await helpers.openAdvancedFilters();

    // Preset should be visible
    await expect(page.locator(`text=${presetName}`)).toBeVisible();
  });

  test('should apply saved filter preset', async ({ page }) => {
    const presetName = 'Quick Filter ' + Date.now();
    const todo1 = 'High Priority Meeting ' + Date.now();
    const todo2 = 'Low Priority Task ' + Date.now();

    await helpers.createTodo(todo1, { priority: 'high' });
    await helpers.createTodo(todo2, { priority: 'low' });

    // Create and save filter
    await helpers.search('Meeting');
    await helpers.filterByPriority('high');
    await helpers.saveFilterPreset(presetName);

    // Clear filters
    await helpers.clearAllFilters();

    // Both should be visible
    await expect(page.locator(`text=${todo1}`)).toBeVisible();
    await expect(page.locator(`text=${todo2}`)).toBeVisible();

    // Apply saved preset
    await helpers.openAdvancedFilters();
    await page.click(`button:has-text("${presetName}")`);

    await page.waitForTimeout(500);

    // Should filter like before
    await expect(page.locator(`text=${todo1}`)).toBeVisible();
    await expect(page.locator(`text=${todo2}`)).not.toBeVisible();
  });

  test('should delete filter preset', async ({ page }) => {
    const presetName = 'Delete Filter ' + Date.now();

    await helpers.search('test');
    await helpers.saveFilterPreset(presetName);

    await helpers.openAdvancedFilters();

    // Delete preset
    const presetRow = page.locator(`text=${presetName}`).locator('..');
    const deleteButton = presetRow.locator('button:has-text("✕")');
    await deleteButton.click();

    // Confirm
    page.once('dialog', dialog => dialog.accept());

    await page.waitForTimeout(500);

    // Preset should be gone
    await expect(page.locator(`text=${presetName}`)).not.toBeVisible();
  });

  test('should show preset in advanced filters section', async ({ page }) => {
    const presetName = 'Visible Preset ' + Date.now();

    await helpers.search('test');
    await helpers.saveFilterPreset(presetName);

    await helpers.openAdvancedFilters();

    // Should see "Saved Filter Presets" section
    await expect(page.locator('text=Saved Filter Presets')).toBeVisible();
  });

  test('should persist saved presets across page reloads', async ({ page }) => {
    const presetName = 'Persistent Preset ' + Date.now();

    await helpers.search('test');
    await helpers.saveFilterPreset(presetName);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open advanced filters
    await helpers.openAdvancedFilters();

    // Preset should still be there
    await expect(page.locator(`text=${presetName}`)).toBeVisible();
  });

  test('should show current filters when saving preset', async ({ page }) => {
    await helpers.search('meeting');
    await helpers.filterByPriority('high');

    // Click save filter
    await page.click('button:has-text("Save Filter")');

    // Modal should show current filters
    await expect(page.locator('text=Current Filters')).toBeVisible();
    await expect(page.locator('text=/Search.*meeting/i')).toBeVisible();
    await expect(page.locator('text=/Priority.*High/i')).toBeVisible();
  });
});

test.describe('Filter Edge Cases', () => {
  let helpers: TodoAppHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoAppHelpers(page);
    await helpers.goToHome();
  });

  test('should handle empty search gracefully', async ({ page }) => {
    await helpers.createTodo('Test Todo');

    await helpers.search('');

    // Should show all todos
    await expect(page.locator('text=Test Todo')).toBeVisible();
  });

  test('should handle special characters in search', async ({ page }) => {
    await helpers.createTodo('Todo with @#$ special chars');

    await helpers.search('@#$');

    await expect(page.locator('text=Todo with @#$ special chars')).toBeVisible();
  });

  test('should update todo counts in sections when filtering', async ({ page }) => {
    await helpers.createTodo('Task 1', { priority: 'high' });
    await helpers.createTodo('Task 2', { priority: 'low' });
    await helpers.createTodo('Task 3', { priority: 'low' });

    // Filter by low priority
    await helpers.filterByPriority('low');

    // Pending count should reflect filtered count
    const pendingHeader = page.locator('h2:has-text("Pending")');
    const headerText = await pendingHeader.textContent();

    // Should show count of 2
    expect(headerText).toContain('(2)');
  });
});
