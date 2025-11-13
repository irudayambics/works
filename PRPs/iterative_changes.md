# Iterative Changes

## 00-core-prp.md
- Documented expanded environment variable set (auth cookies, reminder polling, export/import quotas) and required `.env.example` maintenance.
- Added one-minute Singapore-time buffer requirement for due-date validation, cascade expectations for dependent tables, and detailed testing mandates (feature-specific Playwright specs, SG timezone config, three green CI runs).
- Updated performance, accessibility, and browser-support budgets to mirror evaluation checklist, and appended changelog entry describing these adjustments.

## 01-todo-crud-operations.md
- Tightened due date validation to enforce the 1-minute SG future buffer and reflected the rule in acceptance criteria and E2E coverage.
- Clarified delete behavior must cascade to subordinate resources (subtasks, tags, reminders, recurrence instances) within the same transaction.

## 03-recurring-todos.md
- Required recurrence start dates to be at least one minute in the future, updated helper snippet, validation rules, and test expectations accordingly.

## 04-reminders-notifications.md
- Documented reminder-specific environment configuration, reinforced due-date buffer before scheduling, and ensured scheduled reminders cannot be inserted in the past.
- Added acceptance/test coverage for the one-minute guardrail and refreshed timezone helper usage to align with core guidance.

## 05-subtasks-progress.md
- Replaced ad-hoc timezone snippet with canonical `nowSg`/`toUtcIso` example covering completion timestamps.

## 06-tag-system.md
- Updated timezone guidance to rely on core helpers for timestamp maintenance instead of placeholder utilities.

## 07-template-system.md
- Rewrote timezone handling section to use shared helpers, restored structured acceptance/testing sections after cleanup, and ensured due date offsets leverage SG-aware conversion.

## 09-export-import.md
- Added environment configuration guidance for export/import rate limits and storage paths, aligning documentation with new core environment requirements.
