import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DATA_DB_PATH ?? path.resolve(process.cwd(), 'data/app.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
    dueAt TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deletedAt TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_todos_dueAt ON todos(dueAt);
  CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
  CREATE INDEX IF NOT EXISTS idx_todos_priority_status ON todos(priority, completed, deletedAt);

  CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    response TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

export type Priority = 'low' | 'medium' | 'high';

export interface TodoRecord {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueAt: string | null;
  completed: 0 | 1;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ListTodosParams {
  includeCompleted: boolean;
  priority?: Priority;
  limit: number;
  offset: number;
}

export const todoDB = {
  getById(id: string): TodoRecord | undefined {
    const stmt = db.prepare<[string], TodoRecord>('SELECT * FROM todos WHERE id = ? AND deletedAt IS NULL');
    return stmt.get(id);
  },

  list(params: ListTodosParams): TodoRecord[] {
    const { includeCompleted, priority, limit, offset } = params;
    const conditions = ['deletedAt IS NULL'];
    const bindings: (string | number | null)[] = [];

    if (!includeCompleted) {
      conditions.push('completed = 0');
    }

    if (priority) {
      conditions.push('priority = ?');
      bindings.push(priority);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT *,
        CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END as priorityOrder,
        CASE WHEN dueAt IS NULL THEN 1 ELSE 0 END as dueNull
      FROM todos
      ${whereClause}
      ORDER BY priorityOrder ASC, dueNull ASC, dueAt ASC, createdAt DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const stmt = db.prepare<unknown[], TodoRecord & { priorityOrder: number; dueNull: number }>(sql);
    const rows = stmt.all(...bindings, limit, offset) as Array<
      TodoRecord & { priorityOrder: number; dueNull: number }
    >;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      priority: row.priority,
      dueAt: row.dueAt ?? null,
      completed: (row.completed ?? 0) as 0 | 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt ?? null,
    }));
  },

  count(params: { includeCompleted: boolean; priority?: Priority }): number {
    const conditions = ['deletedAt IS NULL'];
    const bindings: (string | number)[] = [];

    if (!params.includeCompleted) {
      conditions.push('completed = 0');
    }

    if (params.priority) {
      conditions.push('priority = ?');
      bindings.push(params.priority);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = db.prepare<unknown[], { total: number }>(
      `SELECT COUNT(*) as total FROM todos ${whereClause}`
    );
    return stmt.get(...bindings)?.total ?? 0;
  },

  create(record: Omit<TodoRecord, 'deletedAt'> & { deletedAt?: string | null }): TodoRecord {
    const stmt = db.prepare<Required<Omit<TodoRecord, 'deletedAt'>> & { deletedAt: string | null }>(
      `INSERT INTO todos (id, title, description, priority, dueAt, completed, createdAt, updatedAt, deletedAt)
       VALUES (@id, @title, @description, @priority, @dueAt, @completed, @createdAt, @updatedAt, @deletedAt)`
    );

    stmt.run({
      ...record,
      description: record.description ?? null,
      dueAt: record.dueAt ?? null,
      deletedAt: record.deletedAt ?? null,
    });

    return this.getById(record.id)!;
  },

  update(
    id: string,
    updates: Partial<Omit<TodoRecord, 'id' | 'createdAt'>> & { updatedAt: string }
  ): TodoRecord | undefined {
    const fields: string[] = [];
    const bindings: (string | number | null)[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      bindings.push(updates.title);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      bindings.push(updates.description ?? null);
    }

    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      bindings.push(updates.priority);
    }

    if (updates.dueAt !== undefined) {
      fields.push('dueAt = ?');
      bindings.push(updates.dueAt ?? null);
    }

    if (updates.completed !== undefined) {
      fields.push('completed = ?');
      bindings.push(updates.completed);
    }

    if (updates.deletedAt !== undefined) {
      fields.push('deletedAt = ?');
      bindings.push(updates.deletedAt ?? null);
    }

    fields.push('updatedAt = ?');
    bindings.push(updates.updatedAt);

    const sql = `UPDATE todos SET ${fields.join(', ')} WHERE id = ? AND deletedAt IS NULL`;
    const stmt = db.prepare(sql);
    stmt.run(...bindings, id);

    return this.getById(id);
  },

  softDelete(id: string, deletedAt: string): boolean {
    const stmt = db.prepare('UPDATE todos SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL');
    const result = stmt.run(deletedAt, deletedAt, id);
    return result.changes > 0;
  },

  summary(): { high: number; medium: number; low: number } {
    const stmt = db.prepare<unknown[], { priority: Priority; total: number }>(
      `SELECT priority, COUNT(*) as total FROM todos WHERE deletedAt IS NULL GROUP BY priority`
    );
    const rows = stmt.all() as Array<{ priority: Priority; total: number }>;
    const summary: { high: number; medium: number; low: number } = { high: 0, medium: 0, low: 0 };
    rows.forEach((row) => {
      summary[row.priority] = row.total;
    });
    return summary;
  },
};

export const idempotencyDB = {
  find(key: string): string | undefined {
    const stmt = db.prepare<[string], { response: string }>(
      'SELECT response FROM idempotency_keys WHERE key = ?'
    );
    return stmt.get(key)?.response;
  },

  save(key: string, response: unknown, createdAt: string): void {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO idempotency_keys (key, response, createdAt) VALUES (?, ?, ?);'
    );
    stmt.run(key, JSON.stringify(response), createdAt);
  },
};
