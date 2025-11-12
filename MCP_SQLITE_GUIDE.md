# SQLite MCP Server Configuration Guide

This guide explains how to use the SQLite MCP (Model Context Protocol) server to interact with the todo.db database through Claude Code.

## What is MCP?

Model Context Protocol (MCP) allows Claude Code to connect to external data sources and tools. The SQLite MCP server enables Claude to directly query and interact with your SQLite database.

## Configuration

The MCP server has been configured in `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "todo-app-sqlite": {
      "command": "node",
      "args": [
        "/home/kenneth/.nvm/versions/node/v22.14.0/lib/node_modules/mcp-sqlite/mcp-sqlite-server.js",
        "/home/kenneth/Projects/web-test-demo/todo-app/todos.db"
      ]
    }
  }
}
```

## Restart Required

**Important**: You need to restart Claude Code for the MCP server configuration to take effect.

1. Close Claude Code completely
2. Reopen Claude Code
3. The MCP server will automatically connect to your database

## Available Database Operations

Once connected, you can ask Claude Code to perform various database operations:

### 1. Database Information

**Get database info:**
```
Show me information about the todo database
```

**List all tables:**
```
What tables are in the database?
```

**Get table schema:**
```
Show me the schema for the todos table
```

### 2. Query Data

**Read records:**
```
Show me all incomplete todos
```

```
Get all high priority todos with their tags
```

```
Show me todos created in the last 7 days
```

### 3. Create Records

**Add new data:**
```
Create a new todo: "Review MCP documentation" with high priority
```

```
Add a new tag called "urgent" with red color
```

### 4. Update Records

**Modify existing data:**
```
Mark todo #5 as completed
```

```
Change the priority of todo #3 to high
```

### 5. Delete Records

**Remove data:**
```
Delete all completed todos older than 30 days
```

### 6. Custom SQL Queries

**Execute custom SQL:**
```
Run a SQL query to count todos by priority
```

```
Show me the SQL to find all users who haven't logged in this month
```

## Database Schema

### Main Tables

1. **users** - User accounts with WebAuthn credentials
2. **authenticators** - WebAuthn authenticator data
3. **todos** - Todo items with priority, dates, and recurrence
4. **subtasks** - Subtasks belonging to todos
5. **tags** - Custom tags for organizing todos
6. **todo_tags** - Many-to-many relationship between todos and tags
7. **templates** - Todo templates for quick creation
8. **holidays** - Public holiday calendar

## Example Queries

### Find Overdue Todos
```sql
SELECT id, title, due_date, priority
FROM todos
WHERE completed = 0
  AND due_date < datetime('now')
ORDER BY due_date ASC;
```

### Get User's Todo Statistics
```sql
SELECT
  user_id,
  COUNT(*) as total_todos,
  SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_count,
  SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending_count
FROM todos
GROUP BY user_id;
```

### Find Todos with Tags
```sql
SELECT
  t.id,
  t.title,
  t.priority,
  GROUP_CONCAT(tag.name) as tags
FROM todos t
LEFT JOIN todo_tags tt ON t.id = tt.todo_id
LEFT JOIN tags tag ON tt.tag_id = tag.id
GROUP BY t.id;
```

## Security Notes

- The MCP server has direct access to your SQLite database
- Be cautious when asking Claude to modify or delete data
- Always review SQL queries before execution
- Consider backing up your database regularly

## Troubleshooting

### MCP Server Not Connecting

1. **Check configuration file exists:**
   ```bash
   ls -la ~/.claude/mcp.json
   ```

2. **Verify database path:**
   ```bash
   ls -la /home/kenneth/Projects/web-test-demo/todo-app/todos.db
   ```

3. **Check MCP server installation:**
   ```bash
   npm list -g mcp-sqlite
   ```

4. **Restart Claude Code:**
   - Close all Claude Code windows
   - Reopen and check for MCP connection

### Database Locked Error

If you get a "database is locked" error:
- Stop the Next.js development server (it may have the database open)
- Close any other applications accessing the database
- Try the query again

### Permission Errors

Ensure you have read/write permissions:
```bash
chmod 644 /home/kenneth/Projects/web-test-demo/todo-app/todos.db
```

## Benefits of Using MCP

1. **Direct Database Access**: Query the database without writing code
2. **Data Analysis**: Ask complex analytical questions about your data
3. **Schema Exploration**: Understand your database structure
4. **Rapid Prototyping**: Test queries before implementing them in code
5. **Debugging**: Investigate data issues quickly

## Example Use Cases

### Development
- "Show me all todos for user ID 1"
- "What's the schema of the authenticators table?"
- "Count how many recurring todos we have"

### Data Analysis
- "Which priority level has the most todos?"
- "What percentage of todos have subtasks?"
- "Show me todos completion rate by month"

### Debugging
- "Are there any todos with invalid due dates?"
- "Show me users without any authenticators"
- "Find duplicate tag names"

## Advanced Features

### Parameterized Queries
The MCP server supports parameterized queries to prevent SQL injection:

```
Run a query to find todos where priority = ? and user_id = ? with values ["high", 1]
```

### Transaction Support
For multiple operations, you can request transactional behavior:

```
Create a new todo and add 3 subtasks to it, all in a transaction
```

## Resources

- [MCP SQLite Server Documentation](https://github.com/jparkerweb/mcp-sqlite)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your Claude Code version supports MCP
3. Ensure the mcp-sqlite package is properly installed
4. Review Claude Code logs for error messages

---

**Pro Tip**: Start simple! Try "Show me all tables in the database" to verify the connection is working before running complex queries.
