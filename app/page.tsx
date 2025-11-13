'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import clsx from 'clsx';

import { useNotifications } from '@/lib/hooks/useNotifications';
import { useSession } from '@/lib/hooks/useSession';
import { createId } from '@/lib/id';
import {
  formatSingaporeDate,
  fromUtcIso,
  nowSg,
  parseSg,
  SG_TZ,
  toUtcIso,
} from '@/lib/timezone';

type Priority = 'high' | 'medium' | 'low';
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

type ApiTag = {
  id: string;
  name: string;
  color: string;
};

type ApiSubtask = {
  id: string;
  todoId: string;
  title: string;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

type ApiTodo = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueAt: string | null;
  completed: boolean;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | null;
  reminderMinutes: number | null;
  lastNotificationSent: string | null;
  createdAt: string;
  updatedAt: string;
  tags: ApiTag[];
  subtasks: ApiSubtask[];
};

type TemplatePayload = {
  title: string;
  description?: string | null;
  priority: Priority;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern | null;
  reminderMinutes?: number | null;
  dueOffsetMinutes?: number | null;
  subtasks?: Array<{ title: string; position?: number }>;
  tagIds?: string[];
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  payload: TemplatePayload;
};

type ToastTone = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type TodoFormState = {
  title: string;
  description: string;
  priority: Priority;
  dueAt: string;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | '';
  reminderMinutes: string;
  tagIds: string[];
  subtasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    position: number;
    isNew?: boolean;
  }>;
};

const reminderOptions: Array<{ value: string; label: string }> = [
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440', label: '1 day before' },
  { value: '2880', label: '2 days before' },
  { value: '10080', label: '1 week before' },
];

const recurrenceOptions: Array<{ value: RecurrencePattern; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const priorityRank: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const priorityBadge: Record<Priority, string> = {
  high: 'border border-red-500/40 bg-red-500/10 text-red-300',
  medium: 'border border-amber-500/40 bg-amber-500/10 text-amber-200',
  low: 'border border-slate-500/40 bg-slate-500/10 text-slate-300',
};

function toFormDateTime(iso: string | null) {
  if (!iso) return '';
  return fromUtcIso(iso).setZone(SG_TZ).toFormat("yyyy-LL-dd'T'HH:mm");
}

function ReminderBadge({ minutes }: { minutes: number }) {
  const label = reminderOptions.find((option) => Number(option.value) === minutes)?.label;
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200">
      <span aria-hidden>🔔</span>
      {label}
    </span>
  );
}

function RecurringBadge({ pattern }: { pattern: RecurrencePattern }) {
  const label = recurrenceOptions.find((option) => option.value === pattern)?.label ?? pattern;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-200">
      <span aria-hidden>🔄</span>
      {label}
    </span>
  );
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const barClass = percent === 100 ? 'bg-emerald-500' : 'bg-sky-500';
  return (
    <div className="space-y-1 text-xs">
      <div className="h-2 w-full rounded-full bg-slate-800">
        <div
          className={clsx('h-2 rounded-full transition-all duration-300', barClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-slate-400">
        {completed}/{total} completed ({percent}%)
      </span>
    </div>
  );
}

function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  width = 'max-w-3xl',
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/80" onClick={onClose} />
      <div className={clsx('relative z-10 w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl', width)}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-600 hover:bg-slate-800"
            aria-label="Close modal"
          >
            Close
          </button>
        </div>
        <div className="mt-4 max-h-[70vh] overflow-y-auto pr-2 text-sm text-slate-200">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: sessionLoading } = useSession();
  const {
    permission,
    isEnabled,
    isMuted,
    requestPermission,
    toggleMute,
    checkNotifications,
  } = useNotifications();

  const [todos, setTodos] = useState<ApiTodo[]>([]);
  const [tags, setTags] = useState<ApiTag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [isLoadingTodos, setIsLoadingTodos] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [showTodoModal, setShowTodoModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<ApiTodo | null>(null);
  const [todoForm, setTodoForm] = useState<TodoFormState | null>(null);
  const [isSavingTodo, setIsSavingTodo] = useState(false);

  const [showTagsModal, setShowTagsModal] = useState(false);
  const [tagForm, setTagForm] = useState<{ id?: string; name: string; color: string } | null>(null);
  const [isSavingTag, setIsSavingTag] = useState(false);

  const [showTemplateUseModal, setShowTemplateUseModal] = useState(false);
  const [showTemplateSaveModal, setShowTemplateSaveModal] = useState(false);
  const [templateSaveForm, setTemplateSaveForm] = useState({
    name: '',
    description: '',
    category: '',
  });
  const [templateUseState, setTemplateUseState] = useState({
    templateId: '',
    titleOverride: '',
    descriptionOverride: '',
    dueOffsetMinutes: '',
  });
  const [isProcessingTemplate, setIsProcessingTemplate] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone) => {
    const id = createId();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const fetchTags = useCallback(async () => {
    setIsLoadingTags(true);
    try {
      const response = await fetch('/api/tags', { cache: 'no-store' });
      if (!response.ok) return;
      const json = await response.json();
      if (!json.ok) return;
      setTags(json.data as ApiTag[]);
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await fetch('/api/templates', { cache: 'no-store' });
      if (!response.ok) return;
      const json = await response.json();
      if (!json.ok) return;
      setTemplates(json.data as Template[]);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  const fetchTodos = useCallback(async () => {
    setIsLoadingTodos(true);
    try {
      const params = new URLSearchParams();
      params.set('includeCompleted', 'true');
      params.set('limit', '200');
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (selectedTagIds.length > 0) params.set('tags', selectedTagIds.join(','));
      if (debouncedSearch) params.set('search', debouncedSearch);

      const response = await fetch(`/api/todos?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const json = await response.json();
      if (!json.ok) return;
      const data = json.data as ApiTodo[];
      setTodos(
        data.map((todo) => ({
          ...todo,
          completed: Boolean(todo.completed),
          isRecurring: Boolean(todo.isRecurring),
          subtasks: todo.subtasks.map((subtask) => ({
            ...subtask,
            completed: Boolean(subtask.completed),
          })),
        }))
      );
    } finally {
      setIsLoadingTodos(false);
    }
  }, [debouncedSearch, priorityFilter, selectedTagIds]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) return;
    fetchTags();
    fetchTemplates();
  }, [fetchTags, fetchTemplates, sessionLoading, user]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) return;
    fetchTodos();
  }, [fetchTodos, sessionLoading, user]);

  const categorizedTodos = useMemo(() => {
    const now = nowSg();
    const overdue: ApiTodo[] = [];
    const active: ApiTodo[] = [];
    const completed: ApiTodo[] = [];

    todos.forEach((todo) => {
      if (todo.completed) {
        completed.push(todo);
        return;
      }
      if (todo.dueAt) {
        const due = fromUtcIso(todo.dueAt).setZone(SG_TZ);
        if (due < now) {
          overdue.push(todo);
          return;
        }
      }
      active.push(todo);
    });

    const sortFn = (a: ApiTodo, b: ApiTodo) => {
      const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const aDue = a.dueAt ? fromUtcIso(a.dueAt).toMillis() : Number.POSITIVE_INFINITY;
      const bDue = b.dueAt ? fromUtcIso(b.dueAt).toMillis() : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
      return fromUtcIso(a.createdAt).toMillis() - fromUtcIso(b.createdAt).toMillis();
    };

    return {
      overdue: [...overdue].sort(sortFn),
      active: [...active].sort(sortFn),
      completed: [...completed].sort((a, b) =>
        fromUtcIso(b.updatedAt).toMillis() - fromUtcIso(a.updatedAt).toMillis()
      ),
    };
  }, [todos]);

  const resetTodoForm = useCallback((): TodoFormState => ({
    title: '',
    description: '',
    priority: 'medium',
    dueAt: '',
    isRecurring: false,
    recurrencePattern: '',
    reminderMinutes: '',
    tagIds: [],
    subtasks: [],
  }), []);

  const openCreateModal = () => {
    setEditingTodo(null);
    setTodoForm(resetTodoForm());
    setShowTodoModal(true);
  };

  const openEditModal = (todo: ApiTodo) => {
    setEditingTodo(todo);
    setTodoForm({
      title: todo.title,
      description: todo.description ?? '',
      priority: todo.priority,
      dueAt: toFormDateTime(todo.dueAt),
      isRecurring: todo.isRecurring,
      recurrencePattern: todo.recurrencePattern ?? '',
      reminderMinutes: todo.reminderMinutes != null ? String(todo.reminderMinutes) : '',
      tagIds: todo.tags.map((tag) => tag.id),
      subtasks: todo.subtasks
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((subtask) => ({ ...subtask })),
    });
    setShowTodoModal(true);
  };

  const closeTodoModal = () => {
    setShowTodoModal(false);
    setEditingTodo(null);
    setTodoForm(null);
  };

  const handleTodoFormChange = <K extends keyof TodoFormState>(key: K, value: TodoFormState[K]) => {
    setTodoForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const upsertTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!todoForm) return;
    if (todoForm.title.trim().length === 0) {
      showToast('Title is required', 'error');
      return;
    }

    let dueAtPayload: string | null | undefined = undefined;
    if (todoForm.dueAt) {
      const parsed = parseSg(todoForm.dueAt);
      if (!parsed.isValid) {
        showToast('Enter a valid Singapore date/time', 'error');
        return;
      }
      if (parsed <= nowSg().plus({ minutes: 1 })) {
        showToast('Due date must be at least 1 minute in the future', 'error');
        return;
      }
      dueAtPayload = todoForm.dueAt;
    } else if (todoForm.dueAt === '') {
      dueAtPayload = null;
    }

    if (todoForm.isRecurring && !todoForm.recurrencePattern) {
      showToast('Recurring todos need a pattern', 'error');
      return;
    }

    if (todoForm.reminderMinutes && !todoForm.dueAt) {
      showToast('Reminders require a due date', 'error');
      return;
    }

    setIsSavingTodo(true);
    try {
      const payload: Record<string, unknown> = {
        title: todoForm.title.trim(),
        description: todoForm.description.trim() || undefined,
        priority: todoForm.priority,
        isRecurring: todoForm.isRecurring,
        recurrencePattern: todoForm.isRecurring ? todoForm.recurrencePattern || undefined : undefined,
        reminderMinutes: todoForm.reminderMinutes ? Number(todoForm.reminderMinutes) : undefined,
        tags: todoForm.tagIds,
      };
      if (dueAtPayload !== undefined) payload.dueAt = dueAtPayload;

      if (!editingTodo) {
        payload.subtasks = todoForm.subtasks.map((subtask, index) => ({
          title: subtask.title.trim(),
          position: index,
        }));
        const optimisticId = createId();
        setTodos((prev) => [
          {
            id: optimisticId,
            title: todoForm.title.trim(),
            description: todoForm.description.trim() || null,
            priority: todoForm.priority,
            dueAt: dueAtPayload ? toUtcIso(parseSg(todoForm.dueAt)) : null,
            completed: false,
            isRecurring: todoForm.isRecurring,
            recurrencePattern: todoForm.isRecurring ? (todoForm.recurrencePattern as RecurrencePattern | null) : null,
            reminderMinutes: todoForm.reminderMinutes ? Number(todoForm.reminderMinutes) : null,
            lastNotificationSent: null,
            createdAt: toUtcIso(nowSg()),
            updatedAt: toUtcIso(nowSg()),
            tags: tags.filter((tag) => todoForm.tagIds.includes(tag.id)),
            subtasks: todoForm.subtasks.map((subtask, index) => ({
              id: `${optimisticId}-subtask-${index}`,
              todoId: optimisticId,
              title: subtask.title,
              completed: false,
              position: index,
              createdAt: toUtcIso(nowSg()),
              updatedAt: toUtcIso(nowSg()),
            })),
          },
          ...prev,
        ]);

        const response = await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': createId() },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          showToast('Failed to create todo', 'error');
          await fetchTodos();
          return;
        }
        const json = await response.json();
        if (!json.ok) {
          showToast(json.error?.message ?? 'Failed to create todo', 'error');
          await fetchTodos();
          return;
        }
        showToast('Todo created', 'success');
      } else {
        const response = await fetch(`/api/todos/${editingTodo.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          showToast('Failed to update todo', 'error');
          return;
        }
        const json = await response.json();
        if (!json.ok) {
          showToast(json.error?.message ?? 'Failed to update todo', 'error');
          return;
        }
        showToast('Todo updated', 'success');
      }

      await fetchTodos();
      fetchTemplates();
      closeTodoModal();
    } finally {
      setIsSavingTodo(false);
    }
  };

  const toggleTodoCompletion = async (todo: ApiTodo, completed: boolean) => {
    setTodos((prev) =>
      prev.map((item) => (item.id === todo.id ? { ...item, completed } : item))
    );
    const response = await fetch(`/api/todos/${todo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    if (!response.ok) {
      showToast('Failed to update todo', 'error');
    }
    await fetchTodos();
  };

  const deleteTodo = async (todoId: string) => {
    const confirmed = window.confirm('Delete this todo? This cannot be undone.');
    if (!confirmed) return;
    setTodos((prev) => prev.filter((todo) => todo.id !== todoId));
    const response = await fetch(`/api/todos/${todoId}`, { method: 'DELETE' });
    if (!response.ok) {
      showToast('Failed to delete todo', 'error');
    } else {
      showToast('Todo deleted', 'info');
    }
    await fetchTodos();
  };

  const addSubtask = async (todo: ApiTodo, title: string) => {
    if (!title.trim()) return;
    const response = await fetch(`/api/todos/${todo.id}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    });
    if (!response.ok) {
      showToast('Failed to add subtask', 'error');
      return;
    }
    await fetchTodos();
  };

  const updateSubtask = async (subtaskId: string, updates: Partial<{ title: string; completed: boolean }>) => {
    const response = await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      showToast('Failed to update subtask', 'error');
    }
    await fetchTodos();
  };

  const deleteSubtask = async (subtaskId: string) => {
    const response = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
    if (!response.ok) {
      showToast('Failed to delete subtask', 'error');
    }
    await fetchTodos();
  };

  const openTagsModal = () => {
    setTagForm({ name: '', color: '#38bdf8' });
    setShowTagsModal(true);
  };

  const saveTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tagForm) return;
    if (tagForm.name.trim().length === 0) {
      showToast('Tag name is required', 'error');
      return;
    }
    setIsSavingTag(true);
    try {
      const payload = {
        name: tagForm.name.trim(),
        color: tagForm.color.toLowerCase(),
      };
      if (!tagForm.id) {
        const response = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          showToast('Failed to create tag', 'error');
          return;
        }
        showToast('Tag created', 'success');
      } else {
        const response = await fetch(`/api/tags/${tagForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          showToast('Failed to update tag', 'error');
          return;
        }
        showToast('Tag updated', 'success');
      }
      await fetchTags();
      fetchTodos();
      setTagForm({ name: '', color: '#38bdf8' });
    } finally {
      setIsSavingTag(false);
    }
  };

  const removeTag = async (tagId: string) => {
    const confirmed = window.confirm('Delete this tag?');
    if (!confirmed) return;
    await fetch(`/api/tags/${tagId}`, { method: 'DELETE' });
    await fetchTags();
    fetchTodos();
  };

  const openTemplateUseModal = () => {
    setTemplateUseState({ templateId: '', titleOverride: '', descriptionOverride: '', dueOffsetMinutes: '' });
    setShowTemplateUseModal(true);
  };

  const openTemplateSaveModal = (todo: ApiTodo) => {
    setEditingTodo(todo);
    setTemplateSaveForm({ name: '', description: '', category: '' });
    setShowTemplateSaveModal(true);
  };

  const saveTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTodo) return;
    if (!templateSaveForm.name.trim()) {
      showToast('Template name required', 'error');
      return;
    }
    setIsProcessingTemplate(true);
    try {
      const payload = {
        name: templateSaveForm.name.trim(),
        description: templateSaveForm.description.trim() || undefined,
        category: templateSaveForm.category.trim() || undefined,
        payload: {
          title: editingTodo.title,
          description: editingTodo.description ?? null,
          priority: editingTodo.priority,
          isRecurring: editingTodo.isRecurring,
          recurrencePattern: editingTodo.recurrencePattern,
          reminderMinutes: editingTodo.reminderMinutes,
          dueOffsetMinutes: null,
          subtasks: editingTodo.subtasks
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((subtask) => ({ title: subtask.title, position: subtask.position })),
          tagIds: editingTodo.tags.map((tag) => tag.id),
        } satisfies TemplatePayload,
      };
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        showToast('Failed to save template', 'error');
        return;
      }
      showToast('Template saved', 'success');
      fetchTemplates();
      setShowTemplateSaveModal(false);
    } finally {
      setIsProcessingTemplate(false);
    }
  };

  const useTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!templateUseState.templateId) {
      showToast('Select a template', 'error');
      return;
    }
    setIsProcessingTemplate(true);
    try {
      const payload: Record<string, unknown> = {};
      if (templateUseState.titleOverride.trim()) payload.titleOverride = templateUseState.titleOverride.trim();
      if (templateUseState.descriptionOverride.trim()) payload.descriptionOverride = templateUseState.descriptionOverride.trim();
      if (templateUseState.dueOffsetMinutes.trim()) {
        payload.dueOffsetMinutes = Number(templateUseState.dueOffsetMinutes);
      }
      const response = await fetch(`/api/templates/${templateUseState.templateId}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        showToast('Failed to use template', 'error');
        return;
      }
      showToast('Todo created from template', 'success');
      setShowTemplateUseModal(false);
      fetchTodos();
    } finally {
      setIsProcessingTemplate(false);
    }
  };

  const exportTodos = async () => {
    const response = await fetch('/api/todos/export');
    if (!response.ok) {
      showToast('Export failed', 'error');
      return;
    }
    const json = await response.json();
    if (!json.ok) {
      showToast(json.error?.message ?? 'Export failed', 'error');
      return;
    }
    const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `todos-export-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Export ready', 'success');
  };

  const importTodos = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const response = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        showToast('Import failed', 'error');
        return;
      }
      const json = await response.json();
      if (!json.ok) {
        showToast(json.error?.message ?? 'Import failed', 'error');
        return;
      }
      showToast(`Imported ${json.data.imported} todos`, 'success');
      fetchTodos();
      fetchTags();
    } catch (error) {
      showToast('Could not read file', 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const activeFilters = useMemo(() => {
    const filters: string[] = [];
    if (priorityFilter !== 'all') filters.push(`Priority: ${priorityFilter}`);
    if (selectedTagIds.length > 0) {
      const tagNames = tags
        .filter((tag) => selectedTagIds.includes(tag.id))
        .map((tag) => `#${tag.name}`);
      if (tagNames.length > 0) filters.push(`Tags: ${tagNames.join(', ')}`);
    }
    if (debouncedSearch) filters.push(`Search: "${debouncedSearch}"`);
    return filters;
  }, [debouncedSearch, priorityFilter, selectedTagIds, tags]);

  if (sessionLoading || !user) {
    return (
      <div className="mt-20 text-center text-slate-400">
        <p>Preparing your workspace…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-sky-400"
          >
            + New Todo
          </button>
          <button
            type="button"
            onClick={openTagsModal}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
          >
            Manage Tags
          </button>
          <button
            type="button"
            onClick={openTemplateUseModal}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
          >
            Use Template
          </button>
          <button
            type="button"
            onClick={exportTodos}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
          >
            Import JSON
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {permission !== 'granted' ? (
              <button
                type="button"
                onClick={requestPermission}
                className="rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-sky-200 hover:bg-sky-500/20"
              >
                Enable Notifications
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-sky-200 hover:bg-sky-500/20"
              >
                {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              </button>
            )}
            {isEnabled && (
              <button
                type="button"
                onClick={checkNotifications}
                className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-slate-600 hover:bg-slate-800"
              >
                Check Now
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[2fr,1fr]">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search todos or #tags"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as 'all' | Priority)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSelectedTagIds([]);
                setPriorityFilter('all');
                setSearchInput('');
              }}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
            >
              Clear Filters
            </button>
          </div>
        </div>
        {selectedTagIds.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags
              .filter((tag) => selectedTagIds.includes(tag.id))
              .map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id))
                  }
                  className="flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                  <span aria-hidden>×</span>
                </button>
              ))}
          </div>
        )}
        {activeFilters.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">Active filters: {activeFilters.join(' · ')}</p>
        )}
      </section>

      <section className="space-y-8">
        {[
          { key: 'overdue', label: 'Overdue', data: categorizedTodos.overdue },
          { key: 'active', label: 'Active', data: categorizedTodos.active },
          { key: 'completed', label: 'Completed', data: categorizedTodos.completed },
        ].map((section) => (
          <div key={section.key} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                {section.label} ({section.data.length})
              </h2>
            </div>
            {isLoadingTodos ? (
              <div className="mt-6 space-y-3">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-800/60" />
                ))}
              </div>
            ) : section.data.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
                Nothing here yet.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {section.data.map((todo) => {
                  const completedSubtasks = todo.subtasks.filter((sub) => sub.completed).length;
                  const dueLabel = todo.dueAt
                    ? formatSingaporeDate(fromUtcIso(todo.dueAt).setZone(SG_TZ), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : 'No due date';
                  return (
                    <article
                      key={todo.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg transition hover:border-sky-500/40"
                    >
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={(event) => toggleTodoCompletion(todo, event.target.checked)}
                            className="mt-1 h-5 w-5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40"
                            aria-label="Toggle completion"
                          />
                          <div>
                            <h3 className="text-base font-semibold text-slate-100">
                              {todo.title}
                            </h3>
                            {todo.description && (
                              <p className="mt-1 text-sm text-slate-400">{todo.description}</p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                              <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5', priorityBadge[todo.priority])}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                                <span className="capitalize">{todo.priority}</span>
                              </span>
                              <span className="rounded-full border border-slate-700 px-2 py-0.5">{dueLabel}</span>
                              {todo.isRecurring && todo.recurrencePattern && (
                                <RecurringBadge pattern={todo.recurrencePattern} />
                              )}
                              {todo.reminderMinutes != null && (
                                <ReminderBadge minutes={todo.reminderMinutes} />
                              )}
                            </div>
                            {todo.tags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                {todo.tags.map((tag) => (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() =>
                                      setSelectedTagIds((prev) =>
                                        prev.includes(tag.id) ? prev : [...prev, tag.id]
                                      )
                                    }
                                    className="flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-slate-600"
                                  >
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: tag.color }}
                                    />
                                    #{tag.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-auto flex flex-col items-end gap-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(todo)}
                              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-600 hover:bg-slate-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openTemplateSaveModal(todo)}
                              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-600 hover:bg-slate-800"
                            >
                              Save Template
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTodo(todo.id)}
                              className="rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-200 hover:bg-red-500/10"
                            >
                              Delete
                            </button>
                          </div>
                          <ProgressBar completed={completedSubtasks} total={todo.subtasks.length} />
                        </div>
                      </div>

                      <details className="mt-4">
                        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                          Subtasks ({completedSubtasks}/{todo.subtasks.length})
                        </summary>
                        <div className="mt-3 space-y-3 text-sm">
                          {todo.subtasks.length === 0 ? (
                            <p className="text-slate-500">No subtasks yet.</p>
                          ) : (
                            todo.subtasks
                              .slice()
                              .sort((a, b) => a.position - b.position)
                              .map((subtask) => (
                                <div key={subtask.id} className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={subtask.completed}
                                    onChange={(event) =>
                                      updateSubtask(subtask.id, { completed: event.target.checked })
                                    }
                                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40"
                                  />
                                  <input
                                    type="text"
                                    defaultValue={subtask.title}
                                    onBlur={(event) => {
                                      const value = event.target.value.trim();
                                      if (value && value !== subtask.title) {
                                        updateSubtask(subtask.id, { title: value });
                                      }
                                    }}
                                    className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => deleteSubtask(subtask.id)}
                                    className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-200 hover:bg-red-500/10"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))
                          )}
                          <form
                            className="flex items-center gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const form = event.currentTarget;
                              const input = form.elements.namedItem('new-subtask') as HTMLInputElement;
                              const title = input.value.trim();
                              if (title) addSubtask(todo, title);
                              input.value = '';
                            }}
                          >
                            <input
                              name="new-subtask"
                              placeholder="New subtask"
                              className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                            />
                            <button
                              type="submit"
                              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-600 hover:bg-slate-800"
                            >
                              Add
                            </button>
                          </form>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={importTodos}
      />

      <Modal
        title={editingTodo ? 'Edit todo' : 'Create todo'}
        open={showTodoModal && !!todoForm}
        onClose={closeTodoModal}
        footer={
          <>
            <button
              type="button"
              onClick={closeTodoModal}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="todo-form"
              disabled={isSavingTodo}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingTodo ? 'Saving…' : 'Save todo'}
            </button>
          </>
        }
      >
        {todoForm && (
          <form id="todo-form" className="grid gap-4" onSubmit={upsertTodo}>
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide">Title</label>
              <input
                value={todoForm.title}
                onChange={(event) => handleTodoFormChange('title', event.target.value)}
                maxLength={200}
                required
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide">Description</label>
              <textarea
                value={todoForm.description}
                onChange={(event) => handleTodoFormChange('description', event.target.value)}
                maxLength={2000}
                rows={3}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide">Priority</label>
                <select
                  value={todoForm.priority}
                  onChange={(event) => handleTodoFormChange('priority', event.target.value as Priority)}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide">Due date (SG)</label>
                <input
                  type="datetime-local"
                  value={todoForm.dueAt}
                  onChange={(event) => handleTodoFormChange('dueAt', event.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <input
                  id="todo-repeat"
                  type="checkbox"
                  checked={todoForm.isRecurring}
                  onChange={(event) => handleTodoFormChange('isRecurring', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500/40"
                />
                <label htmlFor="todo-repeat" className="text-sm text-slate-200">
                  Repeat
                </label>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide">Repeat pattern</label>
                <select
                  value={todoForm.recurrencePattern}
                  onChange={(event) =>
                    handleTodoFormChange(
                      'recurrencePattern',
                      event.target.value as RecurrencePattern | ''
                    )
                  }
                  disabled={!todoForm.isRecurring}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select pattern</option>
                  {recurrenceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide">Reminder</label>
              <select
                value={todoForm.reminderMinutes}
                onChange={(event) => handleTodoFormChange('reminderMinutes', event.target.value)}
                disabled={!todoForm.dueAt}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">No reminder</option>
                {reminderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.length === 0 && (
                  <p className="text-xs text-slate-500">No tags yet. Create some in Manage Tags.</p>
                )}
                {tags.map((tag) => {
                  const selected = todoForm.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        handleTodoFormChange(
                          'tagIds',
                          selected
                            ? todoForm.tagIds.filter((id) => id !== tag.id)
                            : [...todoForm.tagIds, tag.id]
                        )
                      }
                      className={clsx(
                        'flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition',
                        selected
                          ? 'border-sky-500 bg-sky-500/20 text-sky-100'
                          : 'border-slate-700 text-slate-200 hover:border-slate-600'
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      #{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide">Subtasks</label>
              <div className="space-y-2">
                {todoForm.subtasks.map((subtask, index) => (
                  <div key={subtask.id} className="flex items-center gap-2">
                    <input
                      value={subtask.title}
                      onChange={(event) => {
                        const value = event.target.value;
                        setTodoForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                subtasks: prev.subtasks.map((item) =>
                                  item.id === subtask.id ? { ...item, title: value } : item
                                ),
                              }
                            : prev
                        );
                      }}
                      className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setTodoForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                subtasks: prev.subtasks.filter((item) => item.id !== subtask.id),
                              }
                            : prev
                        )
                      }
                      className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-200 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setTodoForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            subtasks: [
                              ...prev.subtasks,
                              {
                                id: createId(),
                                title: '',
                                completed: false,
                                position: prev.subtasks.length,
                                isNew: true,
                              },
                            ],
                          }
                        : prev
                    )
                  }
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
                >
                  + Add subtask
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        title="Manage Tags"
        open={showTagsModal}
        onClose={() => setShowTagsModal(false)}
        width="max-w-xl"
        footer={null}
      >
        <form className="grid gap-3" onSubmit={saveTag}>
          <input
            type="hidden"
            value={tagForm?.id ?? ''}
            readOnly
          />
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Name</label>
            <input
              value={tagForm?.name ?? ''}
              onChange={(event) =>
                setTagForm((prev) => ({
                  id: prev?.id,
                  name: event.target.value,
                  color: prev?.color ?? '#38bdf8',
                }))
              }
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Color</label>
            <input
              type="color"
              value={tagForm?.color ?? '#38bdf8'}
              onChange={(event) =>
                setTagForm((prev) => ({
                  id: prev?.id,
                  name: prev?.name ?? '',
                  color: event.target.value,
                }))
              }
              className="h-10 w-20 rounded-md border border-slate-700 bg-slate-950"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSavingTag}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {tagForm?.id ? 'Update tag' : 'Create tag'}
            </button>
            {tagForm?.id && (
              <button
                type="button"
                onClick={() => setTagForm({ name: '', color: '#38bdf8' })}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
              >
                Reset
              </button>
            )}
          </div>
        </form>
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Existing tags</h3>
          {isLoadingTags ? (
            <p className="text-sm text-slate-500">Loading tags…</p>
          ) : tags.length === 0 ? (
            <p className="text-sm text-slate-500">No tags yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tags.map((tag) => (
                <li key={tag.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>#{tag.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTagForm({ id: tag.id, name: tag.name, color: tag.color })}
                      className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-600 hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTag(tag.id)}
                      className="rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-200 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        title="Use template"
        open={showTemplateUseModal}
        onClose={() => setShowTemplateUseModal(false)}
        width="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowTemplateUseModal(false)}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover-border-slate-600 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="use-template-form"
              disabled={isProcessingTemplate}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isProcessingTemplate ? 'Applying…' : 'Create todo'}
            </button>
          </>
        }
      >
        <form id="use-template-form" className="grid gap-4" onSubmit={useTemplate}>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Template</label>
            <select
              value={templateUseState.templateId}
              onChange={(event) =>
                setTemplateUseState((prev) => ({ ...prev, templateId: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.category ? ` (${template.category})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Title override</label>
            <input
              value={templateUseState.titleOverride}
              onChange={(event) =>
                setTemplateUseState((prev) => ({ ...prev, titleOverride: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Description override</label>
            <textarea
              value={templateUseState.descriptionOverride}
              onChange={(event) =>
                setTemplateUseState((prev) => ({ ...prev, descriptionOverride: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Due offset (minutes)</label>
            <input
              value={templateUseState.dueOffsetMinutes}
              onChange={(event) =>
                setTemplateUseState((prev) => ({ ...prev, dueOffsetMinutes: event.target.value }))
              }
              placeholder="e.g. 60 for one hour from now"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Details</label>
            {isLoadingTemplates ? (
              <p className="text-sm text-slate-500">Loading templates…</p>
            ) : templateUseState.templateId ? (
              (() => {
                const template = templates.find((item) => item.id === templateUseState.templateId);
                if (!template) return null;
                return (
                  <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                    <p><strong>Name:</strong> {template.name}</p>
                    {template.category && <p><strong>Category:</strong> {template.category}</p>}
                    {template.description && <p><strong>Description:</strong> {template.description}</p>}
                    <p><strong>Priority:</strong> {template.payload.priority}</p>
                    {template.payload.recurrencePattern && (
                      <p><strong>Pattern:</strong> {template.payload.recurrencePattern}</p>
                    )}
                    {template.payload.reminderMinutes != null && (
                      <p><strong>Reminder:</strong> {template.payload.reminderMinutes} minutes before</p>
                    )}
                    {template.payload.tagIds && template.payload.tagIds.length > 0 && (
                      <p>
                        <strong>Tags:</strong> {template.payload.tagIds.length}
                      </p>
                    )}
                  </div>
                );
              })()
            ) : (
              <p className="text-sm text-slate-500">Select a template to preview details.</p>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        title="Save as template"
        open={showTemplateSaveModal && !!editingTodo}
        onClose={() => setShowTemplateSaveModal(false)}
        width="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowTemplateSaveModal(false)}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover-border-slate-600 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="save-template-form"
              disabled={isProcessingTemplate}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isProcessingTemplate ? 'Saving…' : 'Save template'}
            </button>
          </>
        }
      >
        <form id="save-template-form" className="grid gap-4" onSubmit={saveTemplate}>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Name</label>
            <input
              value={templateSaveForm.name}
              onChange={(event) =>
                setTemplateSaveForm((prev) => ({ ...prev, name: event.target.value }))
              }
              required
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Description</label>
            <textarea
              value={templateSaveForm.description}
              onChange={(event) =>
                setTemplateSaveForm((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={3}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Category</label>
            <input
              value={templateSaveForm.category}
              onChange={(event) =>
                setTemplateSaveForm((prev) => ({ ...prev, category: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus-border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
        </form>
      </Modal>

      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              'rounded-md border px-4 py-3 text-sm shadow-lg backdrop-blur',
              toast.tone === 'success' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
              toast.tone === 'error' && 'border-red-500/40 bg-red-500/10 text-red-200',
              toast.tone === 'info' && 'border-sky-500/40 bg-sky-500/10 text-sky-200'
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
