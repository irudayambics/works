import { NextRequest, NextResponse } from 'next/server';
import { todoDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getSingaporeNow } from '@/lib/timezone';

// GET export todos
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const todos = todoDB.getAll(session.userId);

    if (format === 'csv') {
      // Generate CSV
      const headers = ['ID', 'Title', 'Completed', 'Priority', 'Due Date', 'Created At'];
      const csvRows = [headers.join(',')];

      todos.forEach(todo => {
        const row = [
          todo.id,
          `"${todo.title.replace(/"/g, '""')}"`, // Escape quotes in title
          todo.completed ? 'true' : 'false',
          todo.priority,
          todo.due_date || '',
          todo.created_at
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');

      const nowSG = getSingaporeNow();
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="todos-${nowSG.toISOString().split('T')[0]}.csv"`
        }
      });
    } else {
      // Generate JSON
      const nowSG = getSingaporeNow();
      const exportData = {
        exportDate: nowSG.toISOString(),
        version: '1.0',
        todos: todos.map(todo => ({
          title: todo.title,
          completed: todo.completed,
          priority: todo.priority,
          due_date: todo.due_date,
          created_at: todo.created_at
        }))
      };

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="todos-${nowSG.toISOString().split('T')[0]}.json"`
        }
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export todos' }, { status: 500 });
  }
}
