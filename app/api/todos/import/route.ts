import { NextRequest, NextResponse } from 'next/server';
import { todoDB, Priority } from '@/lib/db';
import { getSession } from '@/lib/auth';

interface ImportTodo {
  title: string;
  completed?: boolean;
  priority?: Priority;
  due_date?: string;
  created_at?: string;
}

interface ImportData {
  todos: ImportTodo[];
  version?: string;
  exportDate?: string;
}

// POST import todos
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const data = await request.json() as ImportData;

    if (!data.todos || !Array.isArray(data.todos)) {
      return NextResponse.json({ error: 'Invalid import format. Expected { todos: [...] }' }, { status: 400 });
    }

    const imported = [];
    const errors = [];

    for (let i = 0; i < data.todos.length; i++) {
      const todo = data.todos[i];

      // Validate todo
      if (!todo.title || typeof todo.title !== 'string' || todo.title.trim() === '') {
        errors.push(`Todo ${i + 1}: Title is required`);
        continue;
      }

      // Validate priority if provided
      if (todo.priority && !['high', 'medium', 'low'].includes(todo.priority)) {
        errors.push(`Todo ${i + 1}: Invalid priority "${todo.priority}"`);
        continue;
      }

      // Validate due date if provided
      if (todo.due_date && typeof todo.due_date === 'string') {
        const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
        if (!dateTimeRegex.test(todo.due_date)) {
          errors.push(`Todo ${i + 1}: Invalid due date format`);
          continue;
        }
      }

      try {
        // Create the todo
        const created = todoDB.create(
          session.userId,
          todo.title.trim(),
          todo.due_date || undefined,
          todo.priority || 'medium'
        );

        // If it was marked as completed in the import, update it
        if (todo.completed) {
          todoDB.update(
            created.id,
            session.userId,
            created.title,
            true,
            created.due_date,
            created.priority
          );
        }

        imported.push(created);
      } catch (error) {
        errors.push(`Todo ${i + 1}: Failed to import - ${error}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: imported.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${imported.length} todo(s)${errors.length > 0 ? `, ${errors.length} error(s)` : ''}`
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Failed to import todos. Please check the file format.' }, { status: 500 });
  }
}
