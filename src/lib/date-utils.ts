export enum TimeDisplayMode {
  TIME = 'time',
  DATE = 'date',
  DATETIME = 'datetime',
  RELATIVE = 'relative',
}

export interface DateDisplayOptions {
  mode?: TimeDisplayMode;
  showTime?: boolean;
  showDate?: boolean;
  format?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function formatDate(
  dateStr: string,
  options: DateDisplayOptions | TimeDisplayMode = TimeDisplayMode.DATETIME
): string {
  try {
    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const opts = typeof options === 'string' 
      ? { mode: options as TimeDisplayMode }
      : options;

    const { mode = TimeDisplayMode.DATETIME, showTime = true, showDate = true } = opts;

    switch (mode) {
      case TimeDisplayMode.TIME:
        return formatTime(date);
      
      case TimeDisplayMode.DATE:
        return formatDateOnly(date);
      
      case TimeDisplayMode.DATETIME:
        return formatDateTime(date, showDate, showTime);
      
      case TimeDisplayMode.RELATIVE:
        return formatRelativeTime(date);
      
      default:
        return formatDateTime(date, showDate, showTime);
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateOnly(date: Date): string {
  const day = date.getDate();
  const month = MONTHS_SHORT[date.getMonth()];
  const year = date.getFullYear();
  
  const suffix = getDaySuffix(day);
  
  return `${month} ${day}${suffix}, ${year}`;
}

function formatDateTime(date: Date, showDate: boolean = true, showTime: boolean = true): string {
  if (!showDate && !showTime) return '';
  
  const datePart = showDate ? formatDateOnly(date) : '';
  const timePart = showTime ? formatTime(date) : '';
  
  if (showDate && showTime) {
    return `${datePart} at ${timePart}`;
  }
  
  return showDate ? datePart : timePart;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return formatDateOnly(date);
  }
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function formatMonthYear(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  } catch (error) {
    console.error('Error formatting month/year:', error);
    return dateStr;
  }
}

export function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting short date:', error);
    return dateStr;
  }
}

export function isValidDate(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}