'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSingaporeNow } from '@/lib/timezone';

interface Holiday {
  id: number;
  name: string;
  date: string;
  description?: string;
  is_recurring: boolean;
  created_at: string;
}

export default function CalendarPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [currentDate, setCurrentDate] = useState(getSingaporeNow());
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    description: '',
    isRecurring: false
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    fetchHolidays();
  }, [year, month]);

  const fetchHolidays = async () => {
    try {
      const res = await fetch(`/api/holidays?year=${year}&month=${month}`);
      const data = await res.json();
      setHolidays(data);
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const handleAddHoliday = (day: number) => {
    const selectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setFormData({ name: '', date: selectedDate, description: '', isRecurring: false });
    setEditingHoliday(null);
    setShowModal(true);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setFormData({
      name: holiday.name,
      date: holiday.date,
      description: holiday.description || '',
      isRecurring: holiday.is_recurring
    });
    setEditingHoliday(holiday);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingHoliday) {
        await fetch(`/api/holidays/${editingHoliday.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch('/api/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      setShowModal(false);
      fetchHolidays();
    } catch (error) {
      console.error('Failed to save holiday:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    try {
      await fetch(`/api/holidays/${id}`, { method: 'DELETE' });
      fetchHolidays();
    } catch (error) {
      console.error('Failed to delete holiday:', error);
    }
  };

  const getHolidaysForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidays.filter(h => h.date === dateStr);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Back to Todos
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              Holiday Calendar
            </h1>
            <div className="w-24"></div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handlePrevMonth}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              ← Prev
            </button>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
              {monthName} {year}
            </h2>
            <button
              onClick={handleNextMonth}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Next →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-gray-600 dark:text-gray-400 py-2">
                {day}
              </div>
            ))}

            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-24 bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayHolidays = getHolidaysForDay(day);
              const todaySG = getSingaporeNow();
              const isToday = todaySG.getDate() === day &&
                             todaySG.getMonth() === month - 1 &&
                             todaySG.getFullYear() === year;

              return (
                <div
                  key={day}
                  className={`min-h-24 p-2 border rounded-lg ${
                    isToday
                      ? 'bg-blue-100 dark:bg-blue-900 border-blue-500'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                  } hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer`}
                  onClick={() => handleAddHoliday(day)}
                >
                  <div className="font-semibold text-gray-800 dark:text-white mb-1">{day}</div>
                  <div className="space-y-1">
                    {dayHolidays.map(holiday => (
                      <div
                        key={holiday.id}
                        className="text-xs bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-100 px-1 py-0.5 rounded cursor-pointer hover:bg-red-300 dark:hover:bg-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditHoliday(holiday);
                        }}
                      >
                        {holiday.name}
                        {holiday.is_recurring && ' 🔄'}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    rows={3}
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Recurring holiday
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  {editingHoliday ? 'Update' : 'Add'}
                </button>
                {editingHoliday && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(editingHoliday.id);
                      setShowModal(false);
                    }}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
