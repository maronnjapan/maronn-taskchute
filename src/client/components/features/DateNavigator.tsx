import { useTaskStore } from '../../stores/task-store';
import { Button } from '../ui/Button';
import { addDaysToDateString, getTodayString } from '../../../shared/utils/index';

export function DateNavigator() {
  const { selectedDate, setSelectedDate } = useTaskStore();

  const goToToday = () => setSelectedDate(getTodayString());
  const goToPrevDay = () => setSelectedDate(addDaysToDateString(selectedDate, -1));
  const goToNextDay = () => setSelectedDate(addDaysToDateString(selectedDate, 1));

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const isToday = selectedDate === getTodayString();

  // Format date for display
  const displayDate = new Date(selectedDate).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={goToPrevDay} aria-label="Previous day">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Button>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          className="sr-only"
          id="date-picker"
        />
        <label
          htmlFor="date-picker"
          className="cursor-pointer text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
        >
          {displayDate}
        </label>
      </div>

      <Button variant="ghost" size="sm" onClick={goToNextDay} aria-label="Next day">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>

      {!isToday && (
        <Button variant="secondary" size="sm" onClick={goToToday}>
          今日
        </Button>
      )}
    </div>
  );
}
