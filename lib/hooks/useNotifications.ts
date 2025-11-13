'use client';

import { useEffect, useCallback, useState } from 'react';

import { formatSingaporeDate, getSingaporeNow, toSg } from '@/lib/timezone';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isMuted, setIsMuted] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const pollSecondsRaw = Number.parseInt(
    process.env.NEXT_PUBLIC_NOTIFICATIONS_POLL_INTERVAL_SECONDS ?? '30',
    10
  );
  const pollSeconds = Number.isFinite(pollSecondsRaw) && pollSecondsRaw > 0 ? pollSecondsRaw : 30;
  const pollIntervalMs = Math.max(10, pollSeconds) * 1000;

  // Toggle mute state
  const toggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    localStorage.setItem('notificationsMuted', JSON.stringify(newMutedState));
    setIsEnabled(permission === 'granted' && !newMutedState);
  }, [isMuted, permission]);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      const mutedState = isMuted;
      setIsEnabled(result === 'granted' && !mutedState);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isMuted]);

  // Show a browser notification
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return null;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    try {
      return new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }, []);

  // Check for todos that need notifications
  const checkNotifications = useCallback(async () => {
    if (!isEnabled) return;

    try {
      const response = await fetch('/api/notifications/check');
      if (!response.ok) return;

      const json = await response.json();
      if (!json.ok) return;

      const todos = (json.data?.todos ?? []) as Array<{
        id: string;
        title: string;
        dueAt: string | null;
        reminderMinutes: number | null;
        remindAt: string | null;
      }>;

      for (const todo of todos) {
        if (!todo.dueAt) continue;

        const dueDate = toSg(todo.dueAt);
        const now = getSingaporeNow();
        const remindAt = todo.remindAt ? toSg(todo.remindAt) : dueDate;
        const diff = dueDate.toMillis() - now.toMillis();
        const minutesLeft = Math.floor(diff / 60000);

        let body = `Due: ${formatSingaporeDate(dueDate)}`;
        if (minutesLeft > 0) body = `Due in ${minutesLeft} minutes`;
        if (minutesLeft === 0) body = 'Due now!';

        const notification = showNotification(`📋 ${todo.title}`, {
          body,
          tag: `todo-${todo.id}`,
          requireInteraction: true,
          data: { todoId: todo.id },
        });

        if (notification) {
          // Mark as sent
          await fetch('/api/notifications/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ todoId: todo.id }),
          });

          // Click handler to focus the window
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        }
      }
    } catch (error) {
      console.error('Error checking notifications:', error);
    }
  }, [isEnabled, showNotification]);

  // Initialize permission state and load muted preference
  useEffect(() => {
    if ('Notification' in window) {
      const perm = Notification.permission;
      setPermission(perm);

      // Load muted state from localStorage
      const storedMuted = localStorage.getItem('notificationsMuted');
      const mutedState = storedMuted ? JSON.parse(storedMuted) : false;
      setIsMuted(mutedState);

      // Only enable if permission granted AND not muted
      setIsEnabled(perm === 'granted' && !mutedState);
    }
  }, []);

  // Set up periodic checking
  useEffect(() => {
    if (!isEnabled) return;

    // Check immediately
    checkNotifications();

    // Then check every minute
    const interval = setInterval(checkNotifications, pollIntervalMs);

    return () => clearInterval(interval);
  }, [isEnabled, checkNotifications, pollIntervalMs]);

  return {
    permission,
    isEnabled,
    isMuted,
    requestPermission,
    toggleMute,
    showNotification,
    checkNotifications,
  };
}
