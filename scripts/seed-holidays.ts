import { holidayDB } from '../lib/db';

const singaporeHolidays = [
  // 2025 Singapore Public Holidays
  { name: "New Year's Day", date: "2025-01-01", description: "First day of the year", isRecurring: true },
  { name: "Chinese New Year", date: "2025-01-29", description: "First day of Chinese New Year", isRecurring: false },
  { name: "Chinese New Year", date: "2025-01-30", description: "Second day of Chinese New Year", isRecurring: false },
  { name: "Good Friday", date: "2025-04-18", description: "Christian holiday commemorating the crucifixion of Jesus", isRecurring: false },
  { name: "Hari Raya Puasa", date: "2025-03-31", description: "Muslim festival marking the end of Ramadan", isRecurring: false },
  { name: "Labour Day", date: "2025-05-01", description: "International Workers' Day", isRecurring: true },
  { name: "Vesak Day", date: "2025-05-12", description: "Buddhist festival celebrating Buddha's birthday", isRecurring: false },
  { name: "Hari Raya Haji", date: "2025-06-07", description: "Muslim festival of sacrifice", isRecurring: false },
  { name: "National Day", date: "2025-08-09", description: "Singapore's Independence Day", isRecurring: true },
  { name: "Deepavali", date: "2025-10-20", description: "Hindu festival of lights", isRecurring: false },
  { name: "Christmas Day", date: "2025-12-25", description: "Christian holiday celebrating the birth of Jesus", isRecurring: true },

  // 2026 Singapore Public Holidays
  { name: "New Year's Day", date: "2026-01-01", description: "First day of the year", isRecurring: true },
  { name: "Chinese New Year", date: "2026-02-17", description: "First day of Chinese New Year", isRecurring: false },
  { name: "Chinese New Year", date: "2026-02-18", description: "Second day of Chinese New Year", isRecurring: false },
  { name: "Good Friday", date: "2026-04-03", description: "Christian holiday commemorating the crucifixion of Jesus", isRecurring: false },
  { name: "Hari Raya Puasa", date: "2026-03-20", description: "Muslim festival marking the end of Ramadan", isRecurring: false },
  { name: "Labour Day", date: "2026-05-01", description: "International Workers' Day", isRecurring: true },
  { name: "Vesak Day", date: "2026-05-01", description: "Buddhist festival celebrating Buddha's birthday", isRecurring: false },
  { name: "Hari Raya Haji", date: "2026-05-28", description: "Muslim festival of sacrifice", isRecurring: false },
  { name: "National Day", date: "2026-08-09", description: "Singapore's Independence Day", isRecurring: true },
  { name: "National Day (Observed)", date: "2026-08-10", description: "Singapore's Independence Day observed on Monday", isRecurring: false },
  { name: "Deepavali", date: "2026-11-08", description: "Hindu festival of lights", isRecurring: false },
  { name: "Christmas Day", date: "2026-12-25", description: "Christian holiday celebrating the birth of Jesus", isRecurring: true },
];

async function seedHolidays() {
  console.log('Starting to seed Singapore holidays...');

  let count = 0;
  for (const holiday of singaporeHolidays) {
    try {
      holidayDB.create(holiday.name, holiday.date, holiday.description, holiday.isRecurring);
      count++;
      console.log(`Added: ${holiday.name} on ${holiday.date}`);
    } catch (error) {
      console.error(`Failed to add ${holiday.name}:`, error);
    }
  }

  console.log(`\nSuccessfully seeded ${count} holidays!`);
}

seedHolidays();
