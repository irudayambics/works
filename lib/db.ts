import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';

import { fromUtcIso, SG_TZ } from './timezone';

const dbPath = process.env.DATA_DB_PATH ?? path.resolve(process.cwd(), 'todos.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

type TableColumnInfo = { name: string };

function listColumns(table: string): string[] {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as TableColumnInfo[];
    return rows.map((row) => row.name);
  } catch (error) {
    return [];
  }
}

function ensureColumn(table: string, column: string, definition: string) {
  const columns = listColumns(table);
  if (!columns.includes(column)) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
    } catch (error) {
      // Best-effort migration; ignore if column already exists via race condition.
    }
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    displayName TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS authenticators (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credentialId TEXT NOT NULL UNIQUE,
    publicKey TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    backedUp INTEGER NOT NULL DEFAULT 0,
    deviceType TEXT NOT NULL DEFAULT 'singleDevice',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_challenges (
    id TEXT PRIMARY KEY,
    userId TEXT,
    username TEXT,
    challenge TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('registration','authentication')),
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
    dueAt TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    isRecurring INTEGER NOT NULL DEFAULT 0,
    recurrencePattern TEXT,
    reminderMinutes INTEGER,
    lastNotificationSent TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    todoId TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    UNIQUE(userId, name)
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    todoId TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    tagId TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY(todoId, tagId)
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    payload TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    response TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(userId);
  CREATE INDEX IF NOT EXISTS idx_todos_dueAt ON todos(dueAt);
  CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
  CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
  CREATE INDEX IF NOT EXISTS idx_subtasks_todo ON subtasks(todoId);
  CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(userId);
  CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(userId);
`);

ensureColumn('todos', 'userId', "TEXT NOT NULL DEFAULT 'legacy-user'");
ensureColumn('todos', 'isRecurring', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('todos', 'recurrencePattern', 'TEXT');
ensureColumn('todos', 'reminderMinutes', 'INTEGER');
ensureColumn('todos', 'lastNotificationSent', 'TEXT');

const legacyTodosWithoutUser = db.prepare(`SELECT COUNT(*) as total FROM todos WHERE userId = 'legacy-user'`).get() as { total: number };
if (legacyTodosWithoutUser.total > 0) {
  const existingLegacyUser = db.prepare(`SELECT id FROM users WHERE id = 'legacy-user'`).get() as { id: string } | undefined;
  if (!existingLegacyUser) {
    const timestamp = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, username, displayName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`
    ).run('legacy-user', 'legacy', 'Legacy User', timestamp, timestamp);
  }
}

export type Priority = 'low' | 'medium' | 'high';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatorRecord {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  backedUp: boolean;
  deviceType: 'singleDevice' | 'multiDevice';
  createdAt: string;
  updatedAt: string;
}

export interface TodoRecord {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueAt: string | null;
  completed: 0 | 1;
  isRecurring: 0 | 1;
  recurrencePattern: RecurrencePattern | null;
  reminderMinutes: number | null;
  lastNotificationSent: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SubtaskRecord {
  id: string;
  todoId: string;
  title: string;
  completed: 0 | 1;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TagRecord {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  category: string | null;
  payload: string;
  createdAt: string;
  updatedAt: string;
}

export interface HolidayRecord {
  id: number;
  date: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthChallengeRecord {
  id: string;
  userId: string | null;
  username: string | null;
  challenge: string;
  type: 'registration' | 'authentication';
  createdAt: string;
  expiresAt: string;
}

export interface TodoWithRelations extends TodoRecord {
  subtasks: SubtaskRecord[];
  tags: TagRecord[];
}

function mapAuthenticator(row: any): AuthenticatorRecord {
  return {
    id: row.id,
    userId: row.userId,
    credentialId: row.credentialId,
    publicKey: row.publicKey,
    counter: Number(row.counter ?? 0),
    transports: row.transports ? JSON.parse(row.transports) : [],
    backedUp: Boolean(row.backedUp),
    deviceType: (row.deviceType ?? 'singleDevice') as 'singleDevice' | 'multiDevice',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const userDB = {
  getById(id: string): UserRecord | undefined {
    return db
      .prepare<[string], UserRecord>('SELECT * FROM users WHERE id = ?')
      .get(id);
  },

  findByUsername(username: string): UserRecord | undefined {
    return db
      .prepare<[string], UserRecord>('SELECT * FROM users WHERE username = ?')
      .get(username);
  },

  create(record: UserRecord): UserRecord {
    db.prepare(
      `INSERT INTO users (id, username, displayName, createdAt, updatedAt) VALUES (@id, @username, @displayName, @createdAt, @updatedAt)`
    ).run(record);
    return this.getById(record.id)!;
  },
};

export const authenticatorDB = {
  listByUser(userId: string): AuthenticatorRecord[] {
    const rows = db
      .prepare<[string], any>('SELECT * FROM authenticators WHERE userId = ? ORDER BY createdAt DESC')
      .all(userId);
    return rows.map(mapAuthenticator);
  },

  getByCredentialId(credentialId: string): AuthenticatorRecord | undefined {
    const row = db
      .prepare<[string], any>('SELECT * FROM authenticators WHERE credentialId = ?')
      .get(credentialId);
    return row ? mapAuthenticator(row) : undefined;
  },

  create(record: Omit<AuthenticatorRecord, 'transports' | 'backedUp' | 'counter'> & { transports?: string[]; backedUp?: boolean; counter?: number }): AuthenticatorRecord {
    const payload = {
      ...record,
      transports: JSON.stringify(record.transports ?? []),
      backedUp: record.backedUp ? 1 : 0,
      counter: record.counter ?? 0,
    };

    db.prepare(
      `INSERT INTO authenticators (id, userId, credentialId, publicKey, counter, transports, backedUp, deviceType, createdAt, updatedAt)
       VALUES (@id, @userId, @credentialId, @publicKey, @counter, @transports, @backedUp, @deviceType, @createdAt, @updatedAt)`
    ).run(payload);

    return this.getByCredentialId(record.credentialId)!;
  },

  updateCounter(credentialId: string, counter: number): void {
    db.prepare('UPDATE authenticators SET counter = ?, updatedAt = ? WHERE credentialId = ?')
      .run(counter, new Date().toISOString(), credentialId);
  },

  delete(id: string): void {
    db.prepare('DELETE FROM authenticators WHERE id = ?').run(id);
  },
};

function hydrateTodo(row: any): TodoRecord {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description ?? null,
    priority: row.priority,
    dueAt: row.dueAt ?? null,
    completed: Number(row.completed ?? 0) as 0 | 1,
    isRecurring: Number(row.isRecurring ?? 0) as 0 | 1,
    recurrencePattern: (row.recurrencePattern ?? null) as RecurrencePattern | null,
    reminderMinutes: row.reminderMinutes ?? null,
    lastNotificationSent: row.lastNotificationSent ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
}

export interface ListTodosParams {
  userId: string;
  includeCompleted: boolean;
  priority?: Priority;
  tagIds?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export const todoDB = {
  getById(id: string, userId: string): TodoWithRelations | undefined {
    const row = db
      .prepare<[string, string], any>(
        'SELECT * FROM todos WHERE id = ? AND userId = ? AND deletedAt IS NULL'
      )
      .get(id, userId);
    if (!row) return undefined;
    return {
      ...hydrateTodo(row),
      subtasks: subtaskDB.listForTodo(id),
      tags: tagDB.listByTodo(id),
    };
  },

  list(params: ListTodosParams): TodoWithRelations[] {
    const { userId, includeCompleted, priority, tagIds, search, limit = 100, offset = 0 } = params;
    const where: string[] = ['todos.deletedAt IS NULL', 'todos.userId = ?'];
    const bindings: Array<string | number> = [userId];

    if (!includeCompleted) {
      where.push('todos.completed = 0');
    }
    if (priority) {
      where.push('todos.priority = ?');
      bindings.push(priority);
    }
    if (search) {
      where.push('(LOWER(todos.title) LIKE ? OR LOWER(todos.description) LIKE ? OR EXISTS (SELECT 1 FROM tags t INNER JOIN todo_tags tt ON t.id = tt.tagId WHERE tt.todoId = todos.id AND LOWER(t.name) LIKE ?))');
      const term = `%${search.toLowerCase()}%`;
      bindings.push(term, term, term);
    }
    if (tagIds && tagIds.length > 0) {
      const placeholders = tagIds.map(() => '?').join(',');
      where.push(`todos.id IN (SELECT todoId FROM todo_tags WHERE tagId IN (${placeholders}) GROUP BY todoId HAVING COUNT(DISTINCT tagId) = ${tagIds.length})`);
      bindings.push(...tagIds);
    }

    const sql = `
      SELECT todos.*,
        CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END AS priorityOrder,
        CASE WHEN dueAt IS NULL THEN 1 ELSE 0 END AS dueNull
      FROM todos
      WHERE ${where.join(' AND ')}
      ORDER BY priorityOrder ASC, dueNull ASC, dueAt ASC, createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const queryArgs = [...bindings, limit, offset];
    const rows = (db.prepare<any>(sql) as any).all(...bindings, limit, offset);

    return rows.map((row: any) => ({
      ...hydrateTodo(row),
      subtasks: subtaskDB.listForTodo(row.id),
      tags: tagDB.listByTodo(row.id),
    }));
  },

  summary(userId: string): { high: number; medium: number; low: number } {
    const stmt = db.prepare<any>(
      `SELECT priority, COUNT(*) as total FROM todos WHERE deletedAt IS NULL AND userId = ? GROUP BY priority`
    );
    const rows = stmt.all(userId) as Array<{ priority: Priority; total: number }>;
    return rows.reduce(
      (acc, row) => ({
        ...acc,
        [row.priority]: row.total,
      }),
      { high: 0, medium: 0, low: 0 } as { high: number; medium: number; low: number }
    );
  },

  create(record: TodoRecord): TodoWithRelations {
    const payload = {
      ...record,
      description: record.description ?? null,
      dueAt: record.dueAt ?? null,
      recurrencePattern: record.recurrencePattern ?? null,
      reminderMinutes: record.reminderMinutes ?? null,
      lastNotificationSent: record.lastNotificationSent ?? null,
      deletedAt: record.deletedAt ?? null,
    };

    db.prepare(
      `INSERT INTO todos (id, userId, title, description, priority, dueAt, completed, isRecurring, recurrencePattern, reminderMinutes, lastNotificationSent, createdAt, updatedAt, deletedAt)
       VALUES (@id, @userId, @title, @description, @priority, @dueAt, @completed, @isRecurring, @recurrencePattern, @reminderMinutes, @lastNotificationSent, @createdAt, @updatedAt, @deletedAt)`
    ).run(payload);

    return this.getById(record.id, record.userId)!;
  },

  update(id: string, userId: string, updates: Partial<TodoRecord>): TodoWithRelations | undefined {
    const fields: string[] = [];
    const bindings: Array<string | number | null> = [];

    const entries: Array<[keyof TodoRecord, any]> = Object.entries(updates) as any;
    for (const [field, value] of entries) {
      if (field === 'id' || field === 'userId') continue;
      fields.push(`${field} = ?`);
      if (value === undefined) {
        bindings.push(null);
      } else if (field === 'description' || field === 'dueAt' || field === 'recurrencePattern' || field === 'lastNotificationSent') {
        bindings.push(value ?? null);
      } else {
        bindings.push(value);
      }
    }

    if (fields.length === 0) {
      return this.getById(id, userId);
    }

    const sql = `UPDATE todos SET ${fields.join(', ')} WHERE id = ? AND userId = ? AND deletedAt IS NULL`;
    db.prepare(sql).run(...bindings, id, userId);

    return this.getById(id, userId);
  },

  softDelete(id: string, userId: string, deletedAt: string): boolean {
    const result = db
      .prepare('UPDATE todos SET deletedAt = ?, updatedAt = ? WHERE id = ? AND userId = ? AND deletedAt IS NULL')
      .run(deletedAt, deletedAt, id, userId);
    return result.changes > 0;
  },

  purgeCompletedOlderThan(userId: string, iso: string): void {
    db.prepare('DELETE FROM todos WHERE userId = ? AND completed = 1 AND updatedAt < ?').run(userId, iso);
  },

  listDueForReminder(userId: string, now: DateTime): Array<TodoWithRelations> {
    const stmt = db.prepare<[string], any>(
      `SELECT * FROM todos
         WHERE deletedAt IS NULL
           AND reminderMinutes IS NOT NULL
           AND dueAt IS NOT NULL
           AND completed = 0
           AND userId = ?`
    );

    const rows = stmt.all(userId);
    const nowSg = now.setZone(SG_TZ);

    return rows
      .map((row: any) => ({
        ...hydrateTodo(row),
        subtasks: subtaskDB.listForTodo(row.id),
        tags: tagDB.listByTodo(row.id),
      }))
      .filter((todo) => {
        if (!todo.dueAt || todo.reminderMinutes == null) {
          return false;
        }

        const dueAt = fromUtcIso(todo.dueAt).setZone(SG_TZ);
        const reminderAt = dueAt.minus({ minutes: todo.reminderMinutes });

        if (reminderAt > nowSg) {
          return false;
        }

        if (todo.lastNotificationSent) {
          const lastSent = fromUtcIso(todo.lastNotificationSent).setZone(SG_TZ);
          if (lastSent >= reminderAt) {
            return false;
          }
        }

        return true;
      });
  },

  markNotified(id: string, sentAt: string): void {
    db.prepare('UPDATE todos SET lastNotificationSent = ?, updatedAt = ? WHERE id = ?')
      .run(sentAt, sentAt, id);
  },
};

export const subtaskDB = {
  listForTodo(todoId: string): SubtaskRecord[] {
    return db
      .prepare<[string], SubtaskRecord>(
        'SELECT * FROM subtasks WHERE todoId = ? ORDER BY position ASC, createdAt ASC'
      )
      .all(todoId);
  },

  create(record: SubtaskRecord): SubtaskRecord {
    db.prepare(
      `INSERT INTO subtasks (id, todoId, title, completed, position, createdAt, updatedAt)
       VALUES (@id, @todoId, @title, @completed, @position, @createdAt, @updatedAt)`
    ).run(record);
    return this.getById(record.id)!;
  },

  getById(id: string): SubtaskRecord | undefined {
    return db.prepare<[string], SubtaskRecord>('SELECT * FROM subtasks WHERE id = ?').get(id);
  },

  update(id: string, updates: Partial<SubtaskRecord>): SubtaskRecord | undefined {
    const fields: string[] = [];
    const bindings: Array<string | number> = [];
    const entries: Array<[keyof SubtaskRecord, any]> = Object.entries(updates) as any;
    for (const [field, value] of entries) {
      if (field === 'id') continue;
      fields.push(`${field} = ?`);
      bindings.push(value);
    }
    if (fields.length === 0) return this.getById(id);
    db.prepare(`UPDATE subtasks SET ${fields.join(', ')} WHERE id = ?`).run(...bindings, id);
    return this.getById(id);
  },

  delete(id: string): void {
    db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  },

  deleteByTodo(todoId: string): void {
    db.prepare('DELETE FROM subtasks WHERE todoId = ?').run(todoId);
  },
};

export const tagDB = {
  list(userId: string): TagRecord[] {
    return db
      .prepare<[string], any>('SELECT * FROM tags WHERE userId = ? ORDER BY name ASC')
      .all(userId)
      .map((row: any) => ({
        id: row.id,
        userId: row.userId,
        name: row.name,
        color: row.color,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  },

  listByTodo(todoId: string): TagRecord[] {
    return db
      .prepare<[string], any>(
        `SELECT tags.* FROM tags
         INNER JOIN todo_tags ON tags.id = todo_tags.tagId
         WHERE todo_tags.todoId = ?
         ORDER BY tags.name ASC`
      )
      .all(todoId)
      .map((row: any) => ({
        id: row.id,
        userId: row.userId,
        name: row.name,
        color: row.color,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  },

  getById(id: string, userId: string): TagRecord | undefined {
    const row = db
      .prepare<[string, string], any>('SELECT * FROM tags WHERE id = ? AND userId = ?')
      .get(id, userId);
    if (!row) return undefined;
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      color: row.color,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  create(record: TagRecord): TagRecord {
    db.prepare(
      `INSERT INTO tags (id, userId, name, color, createdAt, updatedAt) VALUES (@id, @userId, @name, @color, @createdAt, @updatedAt)`
    ).run(record);
    return this.getById(record.id, record.userId)!;
  },

  update(id: string, userId: string, updates: Partial<TagRecord>): TagRecord | undefined {
    const fields: string[] = [];
    const bindings: Array<string> = [];
    const entries = Object.entries(updates) as Array<[keyof TagRecord, any]>;
    for (const [field, value] of entries) {
      if (field === 'id' || field === 'userId') continue;
      fields.push(`${field} = ?`);
      bindings.push(value);
    }
    if (fields.length === 0) {
      return this.getById(id, userId);
    }
    db.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ? AND userId = ?`).run(
      ...bindings,
      id,
      userId
    );
    return this.getById(id, userId);
  },

  delete(id: string, userId: string): void {
    db.prepare('DELETE FROM tags WHERE id = ? AND userId = ?').run(id, userId);
  },
};

export const todoTagDB = {
  assign(todoId: string, tagId: string): void {
    db.prepare('INSERT OR IGNORE INTO todo_tags (todoId, tagId) VALUES (?, ?)').run(todoId, tagId);
  },

  revoke(todoId: string, tagId: string): void {
    db.prepare('DELETE FROM todo_tags WHERE todoId = ? AND tagId = ?').run(todoId, tagId);
  },

  replace(todoId: string, tagIds: string[]): void {
    const transaction = db.transaction((ids: string[]) => {
      db.prepare('DELETE FROM todo_tags WHERE todoId = ?').run(todoId);
      const stmt = db.prepare('INSERT OR IGNORE INTO todo_tags (todoId, tagId) VALUES (?, ?)');
      ids.forEach((id) => stmt.run(todoId, id));
    });
    transaction(tagIds);
  },
};

export const templateDB = {
  list(userId: string): TemplateRecord[] {
    return db
      .prepare<[string], any>('SELECT * FROM templates WHERE userId = ? ORDER BY name ASC')
      .all(userId)
      .map((row: any) => ({
        id: row.id,
        userId: row.userId,
        name: row.name,
        description: row.description ?? null,
        category: row.category ?? null,
        payload: row.payload,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  },

  getById(id: string, userId: string): TemplateRecord | undefined {
    const row = db
      .prepare<[string, string], any>('SELECT * FROM templates WHERE id = ? AND userId = ?')
      .get(id, userId);
    if (!row) return undefined;
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description ?? null,
      category: row.category ?? null,
      payload: row.payload,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  create(record: TemplateRecord): TemplateRecord {
    db.prepare(
      `INSERT INTO templates (id, userId, name, description, category, payload, createdAt, updatedAt)
       VALUES (@id, @userId, @name, @description, @category, @payload, @createdAt, @updatedAt)`
    ).run(record);
    return this.getById(record.id, record.userId)!;
  },

  update(id: string, userId: string, updates: Partial<TemplateRecord>): TemplateRecord | undefined {
    const fields: string[] = [];
    const bindings: string[] = [];
    const entries = Object.entries(updates) as Array<[keyof TemplateRecord, any]>;
    for (const [field, value] of entries) {
      if (field === 'id' || field === 'userId') continue;
      fields.push(`${field} = ?`);
      bindings.push(value ?? null);
    }
    if (fields.length === 0) return this.getById(id, userId);
    db.prepare(`UPDATE templates SET ${fields.join(', ')} WHERE id = ? AND userId = ?`).run(
      ...bindings,
      id,
      userId
    );
    return this.getById(id, userId);
  },

  delete(id: string, userId: string): void {
    db.prepare('DELETE FROM templates WHERE id = ? AND userId = ?').run(id, userId);
  },
};

export const holidayDB = {
  list(): HolidayRecord[] {
    return db
      .prepare('SELECT * FROM holidays ORDER BY date ASC')
      .all() as HolidayRecord[];
  },

  upsertMany(records: Array<Omit<HolidayRecord, 'id'>>): void {
    const transaction = db.transaction((rows: Array<Omit<HolidayRecord, 'id'>>) => {
      const stmt = db.prepare(
        `INSERT INTO holidays (date, name, createdAt, updatedAt)
         VALUES (@date, @name, @createdAt, @updatedAt)
         ON CONFLICT(date) DO UPDATE SET name = excluded.name, updatedAt = excluded.updatedAt`
      );
      rows.forEach((row) => stmt.run(row));
    });
    transaction(records);
  },
};

export const idempotencyDB = {
  find(key: string): string | undefined {
    return db
      .prepare<[string], { response: string }>('SELECT response FROM idempotency_keys WHERE key = ?')
      .get(key)?.response;
  },

  save(key: string, response: unknown, createdAt: string): void {
    db.prepare(
      'INSERT OR REPLACE INTO idempotency_keys (key, response, createdAt) VALUES (?, ?, ?);'
    ).run(key, JSON.stringify(response), createdAt);
  },
};

export const authChallengeDB = {
  create(record: AuthChallengeRecord): AuthChallengeRecord {
    db.prepare(
      `INSERT INTO auth_challenges (id, userId, username, challenge, type, createdAt, expiresAt)
       VALUES (@id, @userId, @username, @challenge, @type, @createdAt, @expiresAt)`
    ).run(record);
    return record;
  },

  consume(challenge: string, type: 'registration' | 'authentication'): AuthChallengeRecord | undefined {
    const nowIso = new Date().toISOString();
    const row = db
      .prepare<[string, string, string], any>(
        'SELECT * FROM auth_challenges WHERE challenge = ? AND type = ? AND datetime(expiresAt) > datetime(?)'
      )
      .get(challenge, type, nowIso);
    if (!row) {
      return undefined;
    }
    db.prepare('DELETE FROM auth_challenges WHERE id = ?').run(row.id);
    return {
      id: row.id,
      userId: row.userId ?? null,
      username: row.username ?? null,
      challenge: row.challenge,
      type: row.type,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  },
};

