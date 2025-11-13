import Database from 'better-sqlite3';
import path from 'path';
import { getSingaporeNow } from './timezone';

const dbPath = path.join(process.cwd(), 'todos.db');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS authenticators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    credential_public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    credential_device_type TEXT,
    credential_backed_up INTEGER DEFAULT 0,
    transports TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    due_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    is_recurring BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    title_template TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    due_date_offset_minutes INTEGER,
    reminder_minutes INTEGER,
    is_recurring BOOLEAN DEFAULT 0,
    recurrence_pattern TEXT,
    subtasks_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (todo_id, tag_id),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  )
`);

// Add columns to existing tables if they don't exist
try {
  db.exec(`ALTER TABLE todos ADD COLUMN due_date TEXT`);
} catch (error) {
  // Column already exists, ignore error
}

try {
  db.exec(`ALTER TABLE todos ADD COLUMN user_id INTEGER`);
} catch (error) {
  // Column already exists, ignore error
}

try {
  db.exec(`ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium'`);
} catch (error) {
  // Column already exists, ignore error
}

try {
  db.exec(`ALTER TABLE todos ADD COLUMN is_recurring BOOLEAN DEFAULT 0`);
} catch (error) {
  // Column already exists, ignore error
}

try {
  db.exec(`ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT`);
} catch (error) {
  // Column already exists, ignore error
}

try {
  db.exec(`ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER`);
} catch (error) {
  // Column already exists, ignore error
}

try {
  db.exec(`ALTER TABLE todos ADD COLUMN last_notification_sent TEXT`);
} catch (error) {
  // Column already exists, ignore error
}

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  due_date?: string;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  reminder_minutes?: number;
  last_notification_sent?: string;
  created_at: string;
}

export const todoDB = {
  getAll: (userId: number): Todo[] => {
    const stmt = db.prepare(`
      SELECT * FROM todos
      WHERE user_id = ?
      ORDER BY
        CASE priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 2
        END ASC,
        due_date ASC,
        created_at DESC
    `);
    return stmt.all(userId) as Todo[];
  },

  getById: (id: number, userId: number): Todo | undefined => {
    const stmt = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?');
    return stmt.get(id, userId) as Todo | undefined;
  },

  create: (userId: number, title: string, dueDate?: string, priority: Priority = 'medium', isRecurring: boolean = false, recurrencePattern?: RecurrencePattern, reminderMinutes?: number): Todo => {
    const stmt = db.prepare('INSERT INTO todos (user_id, title, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const result = stmt.run(userId, title, dueDate || null, priority, isRecurring ? 1 : 0, recurrencePattern || null, reminderMinutes || null);
    return todoDB.getById(result.lastInsertRowid as number, userId)!;
  },

  update: (id: number, userId: number, title: string, completed: boolean, dueDate?: string, priority: Priority = 'medium', isRecurring: boolean = false, recurrencePattern?: RecurrencePattern, reminderMinutes?: number): Todo | undefined => {
    const stmt = db.prepare('UPDATE todos SET title = ?, completed = ?, due_date = ?, priority = ?, is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ? WHERE id = ? AND user_id = ?');
    stmt.run(title, completed ? 1 : 0, dueDate || null, priority, isRecurring ? 1 : 0, recurrencePattern || null, reminderMinutes || null, id, userId);
    return todoDB.getById(id, userId);
  },

  delete: (id: number, userId: number): boolean => {
    const stmt = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, userId);
    return result.changes > 0;
  },

  toggleComplete: (id: number, userId: number): Todo | undefined => {
    const stmt = db.prepare('UPDATE todos SET completed = NOT completed WHERE id = ? AND user_id = ?');
    stmt.run(id, userId);
    return todoDB.getById(id, userId);
  },

  calculateNextDueDate: (currentDueDate: string, pattern: RecurrencePattern): string => {
    const date = new Date(currentDueDate);

    switch (pattern) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }

    // Format as YYYY-MM-DDTHH:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  },

  createNextRecurrence: (userId: number, todo: Todo): Todo | null => {
    if (!todo.is_recurring || !todo.recurrence_pattern || !todo.due_date) {
      return null;
    }

    const nextDueDate = todoDB.calculateNextDueDate(todo.due_date, todo.recurrence_pattern);

    return todoDB.create(
      userId,
      todo.title,
      nextDueDate,
      todo.priority,
      true,
      todo.recurrence_pattern,
      todo.reminder_minutes
    );
  },

  getTodosNeedingNotification: (userId: number): Todo[] => {
    const nowSG = getSingaporeNow();
    const now = nowSG.toISOString();
    const stmt = db.prepare(`
      SELECT * FROM todos
      WHERE user_id = ?
        AND completed = 0
        AND due_date IS NOT NULL
        AND reminder_minutes IS NOT NULL
        AND (last_notification_sent IS NULL OR last_notification_sent < datetime('now', '-1 hour'))
      ORDER BY due_date ASC
    `);
    const todos = stmt.all(userId) as Todo[];

    // Filter to only include todos where the reminder time has passed (Singapore time)
    return todos.filter(todo => {
      if (!todo.due_date || !todo.reminder_minutes) return false;

      const dueDate = new Date(todo.due_date);
      const reminderTime = new Date(dueDate.getTime() - todo.reminder_minutes * 60 * 1000);
      const currentTime = getSingaporeNow();

      // Check if current time is past the reminder time but before the due date
      return currentTime >= reminderTime && currentTime <= dueDate;
    });
  },

  updateNotificationSent: (id: number, userId: number): void => {
    const stmt = db.prepare('UPDATE todos SET last_notification_sent = datetime("now") WHERE id = ? AND user_id = ?');
    stmt.run(id, userId);
  }
};

export interface Holiday {
  id: number;
  name: string;
  date: string;
  description?: string;
  is_recurring: boolean;
  created_at: string;
}

export const holidayDB = {
  getAll: (): Holiday[] => {
    const stmt = db.prepare('SELECT * FROM holidays ORDER BY date ASC');
    return stmt.all() as Holiday[];
  },

  getById: (id: number): Holiday | undefined => {
    const stmt = db.prepare('SELECT * FROM holidays WHERE id = ?');
    return stmt.get(id) as Holiday | undefined;
  },

  getByDateRange: (startDate: string, endDate: string): Holiday[] => {
    const stmt = db.prepare('SELECT * FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date ASC');
    return stmt.all(startDate, endDate) as Holiday[];
  },

  getByMonth: (year: number, month: number): Holiday[] => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    return holidayDB.getByDateRange(startDate, endDate);
  },

  create: (name: string, date: string, description?: string, isRecurring: boolean = false): Holiday => {
    const stmt = db.prepare('INSERT INTO holidays (name, date, description, is_recurring) VALUES (?, ?, ?, ?)');
    const result = stmt.run(name, date, description || null, isRecurring ? 1 : 0);
    return holidayDB.getById(result.lastInsertRowid as number)!;
  },

  update: (id: number, name: string, date: string, description?: string, isRecurring: boolean = false): Holiday | undefined => {
    const stmt = db.prepare('UPDATE holidays SET name = ?, date = ?, description = ?, is_recurring = ? WHERE id = ?');
    stmt.run(name, date, description || null, isRecurring ? 1 : 0, id);
    return holidayDB.getById(id);
  },

  delete: (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM holidays WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
};

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: string;
  counter: number;
  credential_device_type?: string;
  credential_backed_up: boolean;
  transports?: string;
  created_at: string;
}

export const userDB = {
  findByUsername: (username: string): User | undefined => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | undefined;
  },

  findById: (id: number): User | undefined => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  },

  create: (username: string): User => {
    const stmt = db.prepare('INSERT INTO users (username) VALUES (?)');
    const result = stmt.run(username);
    return userDB.findById(result.lastInsertRowid as number)!;
  }
};

export const authenticatorDB = {
  findByCredentialId: (credentialId: string): Authenticator | undefined => {
    const stmt = db.prepare('SELECT * FROM authenticators WHERE credential_id = ?');
    return stmt.get(credentialId) as Authenticator | undefined;
  },

  findByUserId: (userId: number): Authenticator[] => {
    const stmt = db.prepare('SELECT * FROM authenticators WHERE user_id = ?');
    return stmt.all(userId) as Authenticator[];
  },

  create: (
    userId: number,
    credentialId: string,
    credentialPublicKey: string,
    counter: number,
    credentialDeviceType?: string,
    credentialBackedUp?: boolean,
    transports?: string[]
  ): Authenticator => {
    const stmt = db.prepare(
      'INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, credential_device_type, credential_backed_up, transports) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      userId,
      credentialId,
      credentialPublicKey,
      counter,
      credentialDeviceType || null,
      credentialBackedUp ? 1 : 0,
      transports ? JSON.stringify(transports) : null
    );
    return authenticatorDB.findByCredentialId(credentialId)!;
  },

  updateCounter: (credentialId: string, newCounter: number): void => {
    const stmt = db.prepare('UPDATE authenticators SET counter = ? WHERE credential_id = ?');
    stmt.run(newCounter, credentialId);
  }
};

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export const subtaskDB = {
  getByTodoId: (todoId: number): Subtask[] => {
    const stmt = db.prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, created_at ASC');
    return stmt.all(todoId) as Subtask[];
  },

  getById: (id: number): Subtask | undefined => {
    const stmt = db.prepare('SELECT * FROM subtasks WHERE id = ?');
    return stmt.get(id) as Subtask | undefined;
  },

  create: (todoId: number, title: string, position?: number): Subtask => {
    // If no position specified, put it at the end
    if (position === undefined) {
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM subtasks WHERE todo_id = ?');
      const result = countStmt.get(todoId) as { count: number };
      position = result.count;
    }

    const stmt = db.prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)');
    const result = stmt.run(todoId, title, position);
    return subtaskDB.getById(result.lastInsertRowid as number)!;
  },

  update: (id: number, title: string, completed: boolean): Subtask | undefined => {
    const stmt = db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?');
    stmt.run(title, completed ? 1 : 0, id);
    return subtaskDB.getById(id);
  },

  toggleComplete: (id: number): Subtask | undefined => {
    const stmt = db.prepare('UPDATE subtasks SET completed = NOT completed WHERE id = ?');
    stmt.run(id);
    return subtaskDB.getById(id);
  },

  delete: (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM subtasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  getProgress: (todoId: number): { total: number; completed: number; percentage: number } => {
    const stmt = db.prepare('SELECT COUNT(*) as total, SUM(completed) as completed FROM subtasks WHERE todo_id = ?');
    const result = stmt.get(todoId) as { total: number; completed: number | null };

    const total = result.total || 0;
    const completed = result.completed || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, percentage };
  }
};

export interface SubtaskTemplate {
  title: string;
  position: number;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  category?: string;
  title_template: string;
  priority: Priority;
  due_date_offset_minutes?: number;
  reminder_minutes?: number;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  subtasks_json?: string;
  created_at: string;
}

export const templateDB = {
  getAll: (userId: number): Template[] => {
    const stmt = db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY category ASC, name ASC');
    return stmt.all(userId) as Template[];
  },

  getById: (id: number, userId: number): Template | undefined => {
    const stmt = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?');
    return stmt.get(id, userId) as Template | undefined;
  },

  getByCategory: (userId: number, category: string): Template[] => {
    const stmt = db.prepare('SELECT * FROM templates WHERE user_id = ? AND category = ? ORDER BY name ASC');
    return stmt.all(userId, category) as Template[];
  },

  create: (
    userId: number,
    name: string,
    titleTemplate: string,
    priority: Priority = 'medium',
    description?: string,
    category?: string,
    dueDateOffsetMinutes?: number,
    reminderMinutes?: number,
    isRecurring: boolean = false,
    recurrencePattern?: RecurrencePattern,
    subtasks?: SubtaskTemplate[]
  ): Template => {
    const stmt = db.prepare(
      'INSERT INTO templates (user_id, name, description, category, title_template, priority, due_date_offset_minutes, reminder_minutes, is_recurring, recurrence_pattern, subtasks_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      userId,
      name,
      description || null,
      category || null,
      titleTemplate,
      priority,
      dueDateOffsetMinutes || null,
      reminderMinutes || null,
      isRecurring ? 1 : 0,
      recurrencePattern || null,
      subtasks ? JSON.stringify(subtasks) : null
    );
    return templateDB.getById(result.lastInsertRowid as number, userId)!;
  },

  update: (
    id: number,
    userId: number,
    name: string,
    titleTemplate: string,
    priority: Priority = 'medium',
    description?: string,
    category?: string,
    dueDateOffsetMinutes?: number,
    reminderMinutes?: number,
    isRecurring: boolean = false,
    recurrencePattern?: RecurrencePattern,
    subtasks?: SubtaskTemplate[]
  ): Template | undefined => {
    const stmt = db.prepare(
      'UPDATE templates SET name = ?, description = ?, category = ?, title_template = ?, priority = ?, due_date_offset_minutes = ?, reminder_minutes = ?, is_recurring = ?, recurrence_pattern = ?, subtasks_json = ? WHERE id = ? AND user_id = ?'
    );
    stmt.run(
      name,
      description || null,
      category || null,
      titleTemplate,
      priority,
      dueDateOffsetMinutes || null,
      reminderMinutes || null,
      isRecurring ? 1 : 0,
      recurrencePattern || null,
      subtasks ? JSON.stringify(subtasks) : null,
      id,
      userId
    );
    return templateDB.getById(id, userId);
  },

  delete: (id: number, userId: number): boolean => {
    const stmt = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, userId);
    return result.changes > 0;
  },

  createTodoFromTemplate: (userId: number, template: Template): Todo => {
    // Calculate due date if offset is specified (Singapore time)
    let dueDate: string | undefined = undefined;
    if (template.due_date_offset_minutes) {
      const date = getSingaporeNow();
      date.setMinutes(date.getMinutes() + template.due_date_offset_minutes);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      dueDate = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // Create the todo
    const todo = todoDB.create(
      userId,
      template.title_template,
      dueDate,
      template.priority,
      template.is_recurring,
      template.recurrence_pattern,
      template.reminder_minutes
    );

    // Create subtasks if template has them
    if (template.subtasks_json) {
      try {
        const subtasks = JSON.parse(template.subtasks_json) as SubtaskTemplate[];
        subtasks.forEach((subtask) => {
          subtaskDB.create(todo.id, subtask.title, subtask.position);
        });
      } catch (error) {
        console.error('Failed to parse subtasks JSON:', error);
      }
    }

    return todo;
  }
};

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export const tagDB = {
  getAll: (userId: number): Tag[] => {
    const stmt = db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC');
    return stmt.all(userId) as Tag[];
  },

  getById: (id: number, userId: number): Tag | undefined => {
    const stmt = db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?');
    return stmt.get(id, userId) as Tag | undefined;
  },

  getByName: (name: string, userId: number): Tag | undefined => {
    const stmt = db.prepare('SELECT * FROM tags WHERE name = ? AND user_id = ?');
    return stmt.get(name, userId) as Tag | undefined;
  },

  create: (userId: number, name: string, color: string = '#3B82F6'): Tag => {
    const stmt = db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)');
    const result = stmt.run(userId, name.trim(), color);
    return tagDB.getById(result.lastInsertRowid as number, userId)!;
  },

  update: (id: number, userId: number, name: string, color: string): Tag | undefined => {
    const stmt = db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?');
    stmt.run(name.trim(), color, id, userId);
    return tagDB.getById(id, userId);
  },

  delete: (id: number, userId: number): boolean => {
    const stmt = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, userId);
    return result.changes > 0;
  },

  getTagsForTodo: (todoId: number): Tag[] => {
    const stmt = db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN todo_tags tt ON t.id = tt.tag_id
      WHERE tt.todo_id = ?
      ORDER BY t.name ASC
    `);
    return stmt.all(todoId) as Tag[];
  },

  addTagToTodo: (todoId: number, tagId: number): void => {
    const stmt = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
    stmt.run(todoId, tagId);
  },

  removeTagFromTodo: (todoId: number, tagId: number): void => {
    const stmt = db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?');
    stmt.run(todoId, tagId);
  },

  setTagsForTodo: (todoId: number, tagIds: number[]): void => {
    // Remove all existing tags
    const deleteStmt = db.prepare('DELETE FROM todo_tags WHERE todo_id = ?');
    deleteStmt.run(todoId);

    // Add new tags
    if (tagIds.length > 0) {
      const insertStmt = db.prepare('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
      tagIds.forEach(tagId => {
        insertStmt.run(todoId, tagId);
      });
    }
  }
};

export default db;
