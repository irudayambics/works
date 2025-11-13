'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone';

type Priority = 'high' | 'medium' | 'low';
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

interface SubtaskTemplate {
  title: string;
  position: number;
}

interface Template {
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

interface SubtaskProgress {
  total: number;
  completed: number;
  percentage: number;
}

interface Todo {
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
  subtasks?: Subtask[];
  progress?: SubtaskProgress;
  tags?: Tag[];
}

export default function Home() {
  const { permission, isEnabled, isMuted, requestPermission, toggleMute } = useNotifications();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newRecurrencePattern, setNewRecurrencePattern] = useState<RecurrencePattern>('weekly');
  const [newReminderMinutes, setNewReminderMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [minDateTime, setMinDateTime] = useState('');
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurrencePattern, setEditRecurrencePattern] = useState<RecurrencePattern>('weekly');
  const [editReminderMinutes, setEditReminderMinutes] = useState<number | null>(null);
  const [username, setUsername] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [expandedTodos, setExpandedTodos] = useState<Set<number>>(new Set());
  const [newSubtaskText, setNewSubtaskText] = useState<{ [todoId: number]: string }>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [editSelectedTags, setEditSelectedTags] = useState<number[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagFilter, setTagFilter] = useState<number | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [completionFilter, setCompletionFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [savedFilters, setSavedFilters] = useState<Array<{name: string, filters: any}>>([]);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [filterPresetName, setFilterPresetName] = useState('');

  useEffect(() => {
    fetchUser();
    fetchTodos();
    fetchTemplates();
    fetchTags();
    loadSavedFilters();
    // Set minimum datetime to current Singapore time
    const nowSG = getSingaporeNow();
    nowSG.setMinutes(nowSG.getMinutes() + 1); // Add 1 minute buffer
    const formatted = nowSG.toISOString().slice(0, 16);
    setMinDateTime(formatted);
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUsername(data.user.username);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(`/api/todos/export?format=${format}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `todos-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export todos');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();

      if (res.ok) {
        alert(result.message);
        await fetchTodos();
      } else {
        alert(result.error || 'Failed to import todos');
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import todos. Please check the file format.');
    }

    // Reset file input
    event.target.value = '';
  };

  const fetchTodos = async () => {
    try {
      const res = await fetch('/api/todos');
      const data = await res.json();
      setTodos(data);
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      setTags(data);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const toggleTagSelection = (tagId: number) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const toggleEditTagSelection = (tagId: number) => {
    setEditSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const setTodoTags = async (todoId: number, tagIds: number[]) => {
    try {
      await fetch(`/api/todos/${todoId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds }),
      });
    } catch (error) {
      console.error('Failed to set tags:', error);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) {
      alert('Tag name is required');
      return;
    }

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor
        }),
      });

      if (res.ok) {
        await fetchTags();
        setNewTagName('');
        setNewTagColor('#3B82F6');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create tag');
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
      alert('Failed to create tag');
    }
  };

  const openEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const closeEditTag = () => {
    setEditingTag(null);
    setEditTagName('');
    setEditTagColor('');
  };

  const updateTag = async () => {
    if (!editingTag || !editTagName.trim()) {
      alert('Tag name is required');
      return;
    }

    try {
      const res = await fetch(`/api/tags/${editingTag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTagName.trim(),
          color: editTagColor
        }),
      });

      if (res.ok) {
        await fetchTags();
        await fetchTodos(); // Refresh todos to show updated tag names/colors
        closeEditTag();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update tag');
      }
    } catch (error) {
      console.error('Failed to update tag:', error);
      alert('Failed to update tag');
    }
  };

  const deleteTag = async (tagId: number) => {
    if (!confirm('Are you sure you want to delete this tag? It will be removed from all todos.')) {
      return;
    }

    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchTags();
        await fetchTodos(); // Refresh todos to remove deleted tag
        // Clear filter if we deleted the filtered tag
        if (tagFilter === tagId) {
          setTagFilter(null);
        }
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete tag');
      }
    } catch (error) {
      console.error('Failed to delete tag:', error);
      alert('Failed to delete tag');
    }
  };

  // Saved Filter Functions
  const loadSavedFilters = () => {
    try {
      const saved = localStorage.getItem('todoFilters');
      if (saved) {
        setSavedFilters(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load saved filters:', error);
    }
  };

  const saveCurrentFilter = () => {
    if (!filterPresetName.trim()) {
      alert('Please enter a name for this filter preset');
      return;
    }

    const newFilter = {
      name: filterPresetName.trim(),
      filters: {
        searchQuery,
        priorityFilter,
        tagFilter,
        dateRangeStart,
        dateRangeEnd,
        completionFilter
      }
    };

    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('todoFilters', JSON.stringify(updated));
    setFilterPresetName('');
    setShowSaveFilterModal(false);
  };

  const applyFilterPreset = (preset: any) => {
    setSearchQuery(preset.filters.searchQuery || '');
    setPriorityFilter(preset.filters.priorityFilter || 'all');
    setTagFilter(preset.filters.tagFilter || null);
    setDateRangeStart(preset.filters.dateRangeStart || '');
    setDateRangeEnd(preset.filters.dateRangeEnd || '');
    setCompletionFilter(preset.filters.completionFilter || 'all');
  };

  const deleteFilterPreset = (index: number) => {
    if (!confirm('Are you sure you want to delete this filter preset?')) {
      return;
    }
    const updated = savedFilters.filter((_, i) => i !== index);
    setSavedFilters(updated);
    localStorage.setItem('todoFilters', JSON.stringify(updated));
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setPriorityFilter('all');
    setTagFilter(null);
    setDateRangeStart('');
    setDateRangeEnd('');
    setCompletionFilter('all');
  };

  const hasActiveFilters = () => {
    return searchQuery !== '' ||
           priorityFilter !== 'all' ||
           tagFilter !== null ||
           dateRangeStart !== '' ||
           dateRangeEnd !== '' ||
           completionFilter !== 'all';
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim()) {
      alert('Template name is required');
      return;
    }

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim() || undefined,
          category: templateCategory.trim() || undefined,
          titleTemplate: newTodo.trim(),
          priority: newPriority,
          dueDateOffsetMinutes: newDueDate ? undefined : undefined, // Can be enhanced later
          reminderMinutes: newReminderMinutes || undefined,
          isRecurring: newIsRecurring,
          recurrencePattern: newIsRecurring ? newRecurrencePattern : undefined,
          subtasks: [] // Can be enhanced later to include subtasks
        }),
      });

      if (res.ok) {
        await fetchTemplates();
        setShowSaveTemplateModal(false);
        setTemplateName('');
        setTemplateDescription('');
        setTemplateCategory('');
        alert('Template saved successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    }
  };

  const useTemplate = async (templateId: number) => {
    try {
      const res = await fetch(`/api/templates/${templateId}/use`, {
        method: 'POST',
      });

      if (res.ok) {
        await fetchTodos();
        alert('Todo created from template!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create todo from template');
      }
    } catch (error) {
      console.error('Failed to use template:', error);
      alert('Failed to use template');
    }
  };

  const deleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchTemplates();
        alert('Template deleted successfully');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete template');
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    }
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTodo,
          dueDate: newDueDate || undefined,
          priority: newPriority,
          isRecurring: newIsRecurring,
          recurrencePattern: newIsRecurring ? newRecurrencePattern : undefined,
          reminderMinutes: newReminderMinutes || undefined
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to add todo');
        setLoading(false);
        return;
      }

      const todo = await res.json();

      // Set tags if any are selected
      if (selectedTags.length > 0) {
        await setTodoTags(todo.id, selectedTags);
      }

      // Refetch todos to get the updated list with tags
      await fetchTodos();

      setNewTodo('');
      setNewDueDate('');
      setNewPriority('medium');
      setNewIsRecurring(false);
      setNewRecurrencePattern('weekly');
      setNewReminderMinutes(null);
      setSelectedTags([]);
    } catch (error) {
      console.error('Failed to add todo:', error);
      alert('Failed to add todo');
    } finally {
      setLoading(false);
    }
  };

  const toggleTodo = async (id: number) => {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
      });
      const data = await res.json();

      // Update the toggled todo and add the next recurrence if created
      let updatedTodos = todos.map(todo => todo.id === id ? data.todo : todo);
      if (data.nextTodo) {
        updatedTodos = [...updatedTodos, data.nextTodo];
      }

      setTodos(updatedTodos);
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  };

  const deleteTodo = async (id: number) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });
      setTodos(todos.filter(todo => todo.id !== id));
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const toggleSubtaskExpansion = async (todoId: number) => {
    const newExpanded = new Set(expandedTodos);
    if (newExpanded.has(todoId)) {
      newExpanded.delete(todoId);
    } else {
      newExpanded.add(todoId);
      // Load subtasks if not already loaded
      await loadSubtasks(todoId);
    }
    setExpandedTodos(newExpanded);
  };

  const loadSubtasks = async (todoId: number) => {
    try {
      const res = await fetch(`/api/todos/${todoId}/subtasks`);
      const data = await res.json();

      setTodos(todos.map(todo =>
        todo.id === todoId
          ? { ...todo, subtasks: data.subtasks, progress: data.progress }
          : todo
      ));
    } catch (error) {
      console.error('Failed to load subtasks:', error);
    }
  };

  const addSubtask = async (todoId: number) => {
    const title = newSubtaskText[todoId]?.trim();
    if (!title) return;

    try {
      const res = await fetch(`/api/todos/${todoId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      const data = await res.json();

      setTodos(todos.map(todo =>
        todo.id === todoId
          ? { ...todo, subtasks: [...(todo.subtasks || []), data.subtask], progress: data.progress }
          : todo
      ));

      setNewSubtaskText({ ...newSubtaskText, [todoId]: '' });
    } catch (error) {
      console.error('Failed to add subtask:', error);
    }
  };

  const toggleSubtask = async (subtaskId: number, todoId: number) => {
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'PATCH',
      });

      const data = await res.json();

      setTodos(todos.map(todo =>
        todo.id === todoId
          ? {
              ...todo,
              subtasks: todo.subtasks?.map(st =>
                st.id === subtaskId ? data.subtask : st
              ),
              progress: data.progress
            }
          : todo
      ));
    } catch (error) {
      console.error('Failed to toggle subtask:', error);
    }
  };

  const deleteSubtask = async (subtaskId: number, todoId: number) => {
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      setTodos(todos.map(todo =>
        todo.id === todoId
          ? {
              ...todo,
              subtasks: todo.subtasks?.filter(st => st.id !== subtaskId),
              progress: data.progress
            }
          : todo
      ));
    } catch (error) {
      console.error('Failed to delete subtask:', error);
    }
  };

  const openEditModal = (todo: Todo) => {
    setEditingTodo(todo);
    setEditTitle(todo.title);
    setEditDueDate(todo.due_date || '');
    setEditPriority(todo.priority);
    setEditIsRecurring(todo.is_recurring);
    setEditRecurrencePattern(todo.recurrence_pattern || 'weekly');
    setEditReminderMinutes(todo.reminder_minutes || null);
    setEditSelectedTags(todo.tags?.map(t => t.id) || []);
  };

  const closeEditModal = () => {
    setEditingTodo(null);
    setEditTitle('');
    setEditDueDate('');
    setEditPriority('medium');
    setEditIsRecurring(false);
    setEditRecurrencePattern('weekly');
    setEditReminderMinutes(null);
    setEditSelectedTags([]);
  };

  const updateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTodo || !editTitle.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/todos/${editingTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          completed: editingTodo.completed,
          dueDate: editDueDate || null,
          priority: editPriority,
          isRecurring: editIsRecurring,
          recurrencePattern: editIsRecurring ? editRecurrencePattern : undefined,
          reminderMinutes: editReminderMinutes || undefined
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to update todo');
        setLoading(false);
        return;
      }

      const updatedTodo = await res.json();

      // Set tags
      await setTodoTags(editingTodo.id, editSelectedTags);

      // Refetch todos to get the updated list with tags
      await fetchTodos();

      closeEditModal();
    } catch (error) {
      console.error('Failed to update todo:', error);
      alert('Failed to update todo');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    const nowSG = getSingaporeNow();
    const dueDateTime = new Date(dueDate);
    return dueDateTime < nowSG;
  };

  const getDateDisplay = (dueDate?: string) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const nowSG = getSingaporeNow();
    const diffTime = date.getTime() - nowSG.getTime();
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const formatDateTime = (d: Date) => {
      return formatSingaporeDate(d, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };

    if (diffMinutes < 0) {
      const absDiffMinutes = Math.abs(diffMinutes);
      const absDiffHours = Math.abs(diffHours);
      const absDiffDays = Math.abs(diffDays);

      if (absDiffDays > 0) {
        return { text: `${absDiffDays} day${absDiffDays > 1 ? 's' : ''} overdue`, color: 'text-red-600 dark:text-red-400' };
      } else if (absDiffHours > 0) {
        return { text: `${absDiffHours} hour${absDiffHours > 1 ? 's' : ''} overdue`, color: 'text-red-600 dark:text-red-400' };
      } else {
        return { text: `${absDiffMinutes} minute${absDiffMinutes > 1 ? 's' : ''} overdue`, color: 'text-red-600 dark:text-red-400' };
      }
    } else if (diffHours < 1) {
      return { text: `Due in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`, color: 'text-red-600 dark:text-red-400' };
    } else if (diffHours < 24) {
      return { text: `Due in ${diffHours} hour${diffHours !== 1 ? 's' : ''} (${formatDateTime(date)})`, color: 'text-orange-600 dark:text-orange-400' };
    } else if (diffDays < 7) {
      return { text: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''} (${formatDateTime(date)})`, color: 'text-yellow-600 dark:text-yellow-400' };
    } else {
      return { text: formatDateTime(date), color: 'text-blue-600 dark:text-blue-400' };
    }
  };

  const getPriorityBadge = (priority: Priority) => {
    const styles = {
      high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700',
      low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700'
    };

    const labels = {
      high: 'High',
      medium: 'Medium',
      low: 'Low'
    };

    return {
      style: styles[priority],
      label: labels[priority]
    };
  };

  const getReminderLabel = (minutes?: number) => {
    if (!minutes) return null;

    if (minutes < 60) {
      return `${minutes}m`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours}h`;
    } else if (minutes < 10080) {
      const days = Math.floor(minutes / 1440);
      return `${days}d`;
    } else {
      const weeks = Math.floor(minutes / 10080);
      return `${weeks}w`;
    }
  };

  // Categorize todos with comprehensive filtering
  let filteredTodos = todos;

  // Apply search filter (searches in title and subtasks)
  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    filteredTodos = filteredTodos.filter(todo => {
      // Search in title
      const titleMatch = todo.title.toLowerCase().includes(query);

      // Search in subtasks
      const subtaskMatch = todo.subtasks?.some(subtask =>
        subtask.title.toLowerCase().includes(query)
      ) || false;

      return titleMatch || subtaskMatch;
    });
  }

  // Apply priority filter
  if (priorityFilter !== 'all') {
    filteredTodos = filteredTodos.filter(t => t.priority === priorityFilter);
  }

  // Apply tag filter
  if (tagFilter !== null) {
    filteredTodos = filteredTodos.filter(t =>
      t.tags?.some(tag => tag.id === tagFilter)
    );
  }

  // Apply completion status filter
  if (completionFilter === 'completed') {
    filteredTodos = filteredTodos.filter(t => t.completed);
  } else if (completionFilter === 'incomplete') {
    filteredTodos = filteredTodos.filter(t => !t.completed);
  }

  // Apply date range filter
  if (dateRangeStart || dateRangeEnd) {
    filteredTodos = filteredTodos.filter(t => {
      if (!t.due_date) return false;

      const todoDate = new Date(t.due_date);
      const startDate = dateRangeStart ? new Date(dateRangeStart) : null;
      const endDate = dateRangeEnd ? new Date(dateRangeEnd) : null;

      if (startDate && todoDate < startDate) return false;
      if (endDate && todoDate > endDate) return false;

      return true;
    });
  }

  const incompleteTodos = filteredTodos.filter(t => !t.completed);
  const overdueTodos = incompleteTodos.filter(t => isOverdue(t.due_date));
  const pendingTodos = incompleteTodos.filter(t => !isOverdue(t.due_date));
  const completedTodos = filteredTodos.filter(t => t.completed);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <main className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                Todo App
              </h1>
              {username && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Welcome, {username}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {/* Export/Import Dropdown Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                  title="Export and Import"
                >
                  <span>⋮</span> Data
                </button>
                {showExportMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-20">
                      <button
                        onClick={() => {
                          handleExport('json');
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-t-lg transition-colors"
                      >
                        Export JSON
                      </button>
                      <button
                        onClick={() => {
                          handleExport('csv');
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        Export CSV
                      </button>
                      <label className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-lg cursor-pointer block transition-colors">
                        Import JSON
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            handleImport(e);
                            setShowExportMenu(false);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>

              {/* Primary action buttons */}
              <Link
                href="/calendar"
                className="px-3 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Calendar
              </Link>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-3 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
              >
                📋 Templates
              </button>

              {/* Notification status */}
              {permission !== 'granted' && (
                <button
                  onClick={requestPermission}
                  className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
                  title="Enable browser notifications for reminders"
                >
                  🔔
                </button>
              )}
              {permission === 'granted' && !isMuted && (
                <button
                  onClick={toggleMute}
                  className="px-3 py-2 text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                  title="Notifications enabled - Click to mute"
                >
                  🔔
                </button>
              )}
              {permission === 'granted' && isMuted && (
                <button
                  onClick={toggleMute}
                  className="px-3 py-2 text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                  title="Notifications muted - Click to unmute"
                >
                  🔕
                </button>
              )}

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>

          <form onSubmit={addTodo} className="mb-6">
            <div className="flex gap-2 flex-col">
              <div className="flex gap-2 flex-col sm:flex-row">
                <input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  placeholder="Add a new todo..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={loading}
                />
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as Priority)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={loading}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <input
                  type="datetime-local"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  min={minDateTime}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex gap-3 items-center flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsRecurring}
                    onChange={(e) => setNewIsRecurring(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Repeat</span>
                </label>
                {newIsRecurring && (
                  <select
                    value={newRecurrencePattern}
                    onChange={(e) => setNewRecurrencePattern(e.target.value as RecurrencePattern)}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={loading}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Reminder:</span>
                  <select
                    value={newReminderMinutes === null ? '' : newReminderMinutes}
                    onChange={(e) => setNewReminderMinutes(e.target.value === '' ? null : Number(e.target.value))}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={loading || !newDueDate}
                  >
                    <option value="">None</option>
                    <option value="15">15 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                    <option value="120">2 hours before</option>
                    <option value="1440">1 day before</option>
                    <option value="2880">2 days before</option>
                    <option value="10080">1 week before</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Use Template:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        useTemplate(Number(e.target.value));
                        e.target.value = '';
                      }
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={loading}
                  >
                    <option value="">Select a template...</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} {template.category ? `(${template.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {newTodo.trim() && (
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateModal(true)}
                    className="px-3 py-1 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                    disabled={loading}
                  >
                    💾 Save as Template
                  </button>
                )}
              </div>
              {tags.length > 0 && (
                <div className="flex gap-2 items-start flex-wrap">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-1">Tags:</span>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTagSelection(tag.id)}
                        className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                          selectedTags.includes(tag.id)
                            ? 'text-white border-transparent'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                        style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                        disabled={loading}
                      >
                        {selectedTags.includes(tag.id) ? '✓ ' : ''}{tag.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowTagModal(true)}
                      className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      disabled={loading}
                    >
                      + Manage Tags
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Search & Filters */}
          <div className="mb-6 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search todos and subtasks..."
                className="w-full px-4 py-3 pl-10 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 px-2 py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Filters Row */}
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'all' | Priority)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>

              {tags.length > 0 && (
                <select
                  value={tagFilter === null ? '' : tagFilter}
                  onChange={(e) => setTagFilter(e.target.value === '' ? null : Number(e.target.value))}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">All Tags</option>
                  {tags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  showAdvancedFilters
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {showAdvancedFilters ? '▼' : '▶'} Advanced
              </button>

              {hasActiveFilters() && (
                <>
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowSaveFilterModal(true)}
                    className="px-3 py-2 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    💾 Save Filter
                  </button>
                </>
              )}
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Advanced Filters</h3>

                {/* Completion Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Completion Status
                  </label>
                  <select
                    value={completionFilter}
                    onChange={(e) => setCompletionFilter(e.target.value as 'all' | 'completed' | 'incomplete')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="all">All Todos</option>
                    <option value="incomplete">Incomplete Only</option>
                    <option value="completed">Completed Only</option>
                  </select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Due Date From
                    </label>
                    <input
                      type="date"
                      value={dateRangeStart}
                      onChange={(e) => setDateRangeStart(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Due Date To
                    </label>
                    <input
                      type="date"
                      value={dateRangeEnd}
                      onChange={(e) => setDateRangeEnd(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Saved Filter Presets */}
                {savedFilters.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Saved Filter Presets
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {savedFilters.map((preset, index) => (
                        <div key={index} className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full text-sm">
                          <button
                            onClick={() => applyFilterPreset(preset)}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => deleteFilterPreset(index)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Overdue Section */}
          {overdueTodos.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                Overdue ({overdueTodos.length})
              </h2>
              <div className="space-y-2">
                {overdueTodos.map((todo) => (
                  <div key={todo.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-3 p-4">
                      <input
                        type="checkbox"
                        checked={!!todo.completed}
                        onChange={() => toggleTodo(todo.id)}
                        className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-800 dark:text-white">
                            {todo.title}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getPriorityBadge(todo.priority).style}`}>
                            {getPriorityBadge(todo.priority).label}
                          </span>
                          {todo.is_recurring && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-300 dark:border-purple-700 rounded-full font-semibold" title={`Repeats ${todo.recurrence_pattern}`}>
                              🔄 {todo.recurrence_pattern}
                            </span>
                          )}
                          {todo.reminder_minutes && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-full font-semibold" title={`Reminder set`}>
                              🔔 {getReminderLabel(todo.reminder_minutes)}
                            </span>
                          )}
                          {todo.tags && todo.tags.length > 0 && todo.tags.map(tag => (
                            <span
                              key={tag.id}
                              className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                              style={{ backgroundColor: tag.color }}
                              title={tag.name}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                        {todo.due_date && (
                          <span className={`text-sm font-medium ${getDateDisplay(todo.due_date)?.color}`}>
                            {getDateDisplay(todo.due_date)?.text}
                          </span>
                        )}
                        {todo.progress && todo.progress.total > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                              <span>{todo.progress.completed}/{todo.progress.total} subtasks</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all"
                                style={{ width: `${todo.progress.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleSubtaskExpansion(todo.id)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                      >
                        {expandedTodos.has(todo.id) ? '▼' : '▶'} Subtasks
                      </button>
                      <button
                        onClick={() => openEditModal(todo)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                      >
                        Delete
                      </button>
                    </div>

                    {expandedTodos.has(todo.id) && (
                      <div className="px-4 pb-4 border-t border-red-200 dark:border-red-800 mt-2 pt-3">
                        <div className="space-y-2">
                          {todo.subtasks?.map((subtask) => (
                            <div key={subtask.id} className="flex items-center gap-2 text-sm pl-4">
                              <input
                                type="checkbox"
                                checked={subtask.completed}
                                onChange={() => toggleSubtask(subtask.id, todo.id)}
                                className="w-4 h-4 text-blue-500 rounded"
                              />
                              <span className={subtask.completed ? 'line-through text-gray-500' : 'text-gray-700 dark:text-gray-300'}>
                                {subtask.title}
                              </span>
                              <button
                                onClick={() => deleteSubtask(subtask.id, todo.id)}
                                className="ml-auto text-red-500 hover:text-red-700 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3 pl-4">
                          <input
                            type="text"
                            value={newSubtaskText[todo.id] || ''}
                            onChange={(e) => setNewSubtaskText({ ...newSubtaskText, [todo.id]: e.target.value })}
                            onKeyPress={(e) => e.key === 'Enter' && addSubtask(todo.id)}
                            placeholder="Add subtask..."
                            className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <button
                            onClick={() => addSubtask(todo.id)}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Section */}
          {pendingTodos.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-3">
                Pending ({pendingTodos.length})
              </h2>
              <div className="space-y-2">
                {pendingTodos.map((todo) => (
                  <div key={todo.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <div className="flex items-center gap-3 p-4">
                      <input
                        type="checkbox"
                        checked={!!todo.completed}
                        onChange={() => toggleTodo(todo.id)}
                        className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-800 dark:text-white">
                            {todo.title}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getPriorityBadge(todo.priority).style}`}>
                            {getPriorityBadge(todo.priority).label}
                          </span>
                          {todo.is_recurring && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-300 dark:border-purple-700 rounded-full font-semibold" title={`Repeats ${todo.recurrence_pattern}`}>
                              🔄 {todo.recurrence_pattern}
                            </span>
                          )}
                          {todo.reminder_minutes && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-full font-semibold" title={`Reminder set`}>
                              🔔 {getReminderLabel(todo.reminder_minutes)}
                            </span>
                          )}
                          {todo.tags && todo.tags.length > 0 && todo.tags.map(tag => (
                            <span
                              key={tag.id}
                              className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                              style={{ backgroundColor: tag.color }}
                              title={tag.name}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                        {todo.due_date && (
                          <span className={`text-sm font-medium ${getDateDisplay(todo.due_date)?.color}`}>
                            {getDateDisplay(todo.due_date)?.text}
                          </span>
                        )}
                        {todo.progress && todo.progress.total > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                              <span>{todo.progress.completed}/{todo.progress.total} subtasks</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all"
                                style={{ width: `${todo.progress.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleSubtaskExpansion(todo.id)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                      >
                        {expandedTodos.has(todo.id) ? '▼' : '▶'} Subtasks
                      </button>
                      <button
                        onClick={() => openEditModal(todo)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                      >
                        Delete
                      </button>
                    </div>

                    {expandedTodos.has(todo.id) && (
                      <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600 mt-2 pt-3">
                        <div className="space-y-2">
                          {todo.subtasks?.map((subtask) => (
                            <div key={subtask.id} className="flex items-center gap-2 text-sm pl-4">
                              <input
                                type="checkbox"
                                checked={subtask.completed}
                                onChange={() => toggleSubtask(subtask.id, todo.id)}
                                className="w-4 h-4 text-blue-500 rounded"
                              />
                              <span className={subtask.completed ? 'line-through text-gray-500' : 'text-gray-700 dark:text-gray-300'}>
                                {subtask.title}
                              </span>
                              <button
                                onClick={() => deleteSubtask(subtask.id, todo.id)}
                                className="ml-auto text-red-500 hover:text-red-700 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3 pl-4">
                          <input
                            type="text"
                            value={newSubtaskText[todo.id] || ''}
                            onChange={(e) => setNewSubtaskText({ ...newSubtaskText, [todo.id]: e.target.value })}
                            onKeyPress={(e) => e.key === 'Enter' && addSubtask(todo.id)}
                            placeholder="Add subtask..."
                            className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <button
                            onClick={() => addSubtask(todo.id)}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Section */}
          {completedTodos.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-green-600 dark:text-green-400 mb-3">
                Completed ({completedTodos.length})
              </h2>
              <div className="space-y-2">
                {completedTodos.map((todo) => (
                  <div key={todo.id} className="bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3 p-4">
                      <input
                        type="checkbox"
                        checked={!!todo.completed}
                        onChange={() => toggleTodo(todo.id)}
                        className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="line-through text-gray-400 dark:text-gray-500">
                            {todo.title}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border opacity-60 ${getPriorityBadge(todo.priority).style}`}>
                            {getPriorityBadge(todo.priority).label}
                          </span>
                          {todo.is_recurring && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-300 dark:border-purple-700 rounded-full font-semibold opacity-60" title={`Repeats ${todo.recurrence_pattern}`}>
                              🔄 {todo.recurrence_pattern}
                            </span>
                          )}
                          {todo.reminder_minutes && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-full font-semibold opacity-60" title={`Reminder set`}>
                              🔔 {getReminderLabel(todo.reminder_minutes)}
                            </span>
                          )}
                          {todo.tags && todo.tags.length > 0 && todo.tags.map(tag => (
                            <span
                              key={tag.id}
                              className="text-xs px-2 py-0.5 rounded-full text-white font-medium opacity-60"
                              style={{ backgroundColor: tag.color }}
                              title={tag.name}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                        {todo.due_date && (
                          <span className="text-sm text-gray-400 dark:text-gray-500">
                            {formatSingaporeDate(new Date(todo.due_date), {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </span>
                        )}
                        {todo.progress && todo.progress.total > 0 && (
                          <div className="mt-2 opacity-60">
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                              <span>{todo.progress.completed}/{todo.progress.total} subtasks</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-green-500 dark:bg-green-400 h-2 rounded-full transition-all"
                                style={{ width: `${todo.progress.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleSubtaskExpansion(todo.id)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                      >
                        {expandedTodos.has(todo.id) ? '▼' : '▶'} Subtasks
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                      >
                        Delete
                      </button>
                    </div>

                    {expandedTodos.has(todo.id) && (
                      <div className="px-4 pb-4 border-t border-green-200 dark:border-green-800 mt-2 pt-3 opacity-80">
                        <div className="space-y-2">
                          {todo.subtasks?.map((subtask) => (
                            <div key={subtask.id} className="flex items-center gap-2 text-sm pl-4">
                              <input
                                type="checkbox"
                                checked={subtask.completed}
                                onChange={() => toggleSubtask(subtask.id, todo.id)}
                                className="w-4 h-4 text-blue-500 rounded"
                              />
                              <span className={subtask.completed ? 'line-through text-gray-500' : 'text-gray-700 dark:text-gray-300'}>
                                {subtask.title}
                              </span>
                              <button
                                onClick={() => deleteSubtask(subtask.id, todo.id)}
                                className="ml-auto text-red-500 hover:text-red-700 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {todos.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No todos yet. Add one above!
            </p>
          )}

          {todos.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-around text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{overdueTodos.length}</div>
                  <div className="text-gray-600 dark:text-gray-400">Overdue</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{pendingTodos.length}</div>
                  <div className="text-gray-600 dark:text-gray-400">Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completedTodos.length}</div>
                  <div className="text-gray-600 dark:text-gray-400">Completed</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {editingTodo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              Edit Todo
            </h3>
            <form onSubmit={updateTodo}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={loading}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    min={minDateTime}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={loading}
                  />
                </div>
                <div>
                  <div className="flex gap-3 items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editIsRecurring}
                        onChange={(e) => setEditIsRecurring(e.target.checked)}
                        disabled={loading}
                        className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Repeat</span>
                    </label>
                    {editIsRecurring && (
                      <select
                        value={editRecurrencePattern}
                        onChange={(e) => setEditRecurrencePattern(e.target.value as RecurrencePattern)}
                        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        disabled={loading}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reminder
                  </label>
                  <select
                    value={editReminderMinutes === null ? '' : editReminderMinutes}
                    onChange={(e) => setEditReminderMinutes(e.target.value === '' ? null : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={loading || !editDueDate}
                  >
                    <option value="">None</option>
                    <option value="15">15 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                    <option value="120">2 hours before</option>
                    <option value="1440">1 day before</option>
                    <option value="2880">2 days before</option>
                    <option value="10080">1 week before</option>
                  </select>
                </div>
                {tags.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {tags.map(tag => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleEditTagSelection(tag.id)}
                          className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                            editSelectedTags.includes(tag.id)
                              ? 'text-white border-transparent'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                          }`}
                          style={editSelectedTags.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                          disabled={loading}
                        >
                          {editSelectedTags.includes(tag.id) ? '✓ ' : ''}{tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Management Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                My Templates
              </h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {templates.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                No templates yet. Create a todo and save it as a template!
              </p>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 dark:text-white">
                          {template.name}
                        </h4>
                        {template.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {template.description}
                          </p>
                        )}
                      </div>
                      {template.category && (
                        <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                          {template.category}
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <p>
                        <strong>Title:</strong> {template.title_template}
                      </p>
                      <p>
                        <strong>Priority:</strong>{' '}
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getPriorityBadge(template.priority).style}`}>
                          {getPriorityBadge(template.priority).label}
                        </span>
                      </p>
                      {template.is_recurring && template.recurrence_pattern && (
                        <p>
                          <strong>Recurrence:</strong> {template.recurrence_pattern}
                        </p>
                      )}
                      {template.reminder_minutes && (
                        <p>
                          <strong>Reminder:</strong> {getReminderLabel(template.reminder_minutes)}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          useTemplate(template.id);
                          setShowTemplateModal(false);
                        }}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Use Template
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              Save as Template
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Weekly Meeting"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Brief description of the template"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category (optional)
                </label>
                <input
                  type="text"
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                  placeholder="e.g., Work, Personal, Health"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <p className="font-medium mb-1">Template will save:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Title: {newTodo || '(empty)'}</li>
                  <li>Priority: {newPriority}</li>
                  {newIsRecurring && <li>Recurrence: {newRecurrencePattern}</li>}
                  {newReminderMinutes && <li>Reminder: {getReminderLabel(newReminderMinutes)}</li>}
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveAsTemplate}
                disabled={!templateName.trim()}
                className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Template
              </button>
              <button
                onClick={() => {
                  setShowSaveTemplateModal(false);
                  setTemplateName('');
                  setTemplateDescription('');
                  setTemplateCategory('');
                }}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Management Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                Manage Tags
              </h3>
              <button
                onClick={() => setShowTagModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Create New Tag */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Create New Tag
              </h4>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createTag()}
                    placeholder="e.g., Work, Personal, Urgent"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-20 h-10 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                  />
                </div>
                <button
                  onClick={createTag}
                  disabled={!newTagName.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create
                </button>
              </div>
            </div>

            {/* Existing Tags */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Your Tags ({tags.length})
              </h4>
              {tags.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-center py-8 text-sm">
                  No tags yet. Create your first tag above!
                </p>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      {editingTag?.id === tag.id ? (
                        <>
                          <input
                            type="color"
                            value={editTagColor}
                            onChange={(e) => setEditTagColor(e.target.value)}
                            className="w-10 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={editTagName}
                            onChange={(e) => setEditTagName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && updateTag()}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <button
                            onClick={updateTag}
                            className="px-3 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={closeEditTag}
                            className="px-3 py-2 text-sm bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <div
                            className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600"
                            style={{ backgroundColor: tag.color }}
                          ></div>
                          <span
                            className="flex-1 px-3 py-2 rounded-full text-sm font-medium text-white"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                          </span>
                          <button
                            onClick={() => openEditTag(tag)}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteTag(tag.id)}
                            className="px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowTagModal(false)}
                className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Filter Preset Modal */}
      {showSaveFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                Save Filter Preset
              </h3>
              <button
                onClick={() => {
                  setShowSaveFilterModal(false);
                  setFilterPresetName('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preset Name
              </label>
              <input
                type="text"
                value={filterPresetName}
                onChange={(e) => setFilterPresetName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && saveCurrentFilter()}
                placeholder="e.g., High Priority This Week"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Filters:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {searchQuery && <li>• Search: "{searchQuery}"</li>}
                {priorityFilter !== 'all' && <li>• Priority: {priorityFilter}</li>}
                {tagFilter !== null && <li>• Tag: {tags.find(t => t.id === tagFilter)?.name}</li>}
                {completionFilter !== 'all' && <li>• Status: {completionFilter}</li>}
                {dateRangeStart && <li>• From: {dateRangeStart}</li>}
                {dateRangeEnd && <li>• To: {dateRangeEnd}</li>}
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveCurrentFilter}
                disabled={!filterPresetName.trim()}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Preset
              </button>
              <button
                onClick={() => {
                  setShowSaveFilterModal(false);
                  setFilterPresetName('');
                }}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
