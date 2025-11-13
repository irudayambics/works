'use client';

import { useEffect, useCallback, useState } from 'react';
import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isMuted, setIsMuted] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

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

      const data = await response.json();
      const todos = data.todos || [];

      for (const todo of todos) {
        const dueDate = new Date(todo.due_date);
        const now = getSingaporeNow();
        const timeDiff = dueDate.getTime() - now.getTime();
        const minutesLeft = Math.floor(timeDiff / 60000);

        let body = `Due: ${formatSingaporeDate(dueDate, {})}`;
        if (minutesLeft > 0) {
          body = `Due in ${minutesLeft} minutes`;
        } else if (minutesLeft === 0) {
          body = 'Due now!';
        }

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
    const interval = setInterval(checkNotifications, 60000);

    return () => clearInterval(interval);
  }, [isEnabled, checkNotifications]);

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
