// API Configuration
export const API_CONFIG = {
  BASE_URL: 'http://localhost:5055',
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  DEFAULT_RETRIES: 3,
  DEFAULT_RETRY_DELAY: 1000, // 1 second
} as const;

// Mock Data Configuration
export const MOCK_CONFIG = {
  TOTAL_ITEMS: 8016,
  DEFAULT_LIMIT: 200,
  INDEXING_PROGRESS_STEP: 100,
  INDEXING_PROGRESS_RANDOM_MAX: 200,
  INDEXING_INTERVAL: 500, // milliseconds
} as const;

// UI Breakpoints
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

// Timeline Configuration
export const TIMELINE_CONFIG = {
  DEFAULT_COLUMNS: 3,
  MIN_COLUMNS: 1,
  MAX_COLUMNS: 8,
  COLUMN_BREAKPOINTS: [
    { width: 0, columns: 1 },
    { width: 640, columns: 2 },
    { width: 768, columns: 3 },
    { width: 1024, columns: 4 },
    { width: 1280, columns: 5 },
    { width: 1536, columns: 6 },
  ],
  SCROLL_THRESHOLD: 100,
} as const;

// Memory Viewer Configuration
export const VIEWER_CONFIG = {
  AUTO_HIDE_DELAY: 3000, // milliseconds
  TOAST_DURATION: 3000, // milliseconds
  MAX_TAG_LENGTH: 50,
  MIN_TAG_LENGTH: 1,
} as const;

// Date/Time Configuration
export const DATE_CONFIG = {
  ON_THIS_DAY_WINDOW: 3, // days
  RECENT_RECAP_DAYS: 7, // days
  RELATIVE_TIME_THRESHOLDS: {
    JUST_NOW: 1, // minute
    MINUTES: 60, // minutes
    HOURS: 24, // hours
    DAYS: 7, // days
  },
} as const;

// Animation Configuration
export const ANIMATION_CONFIG = {
  DURATION: {
    FAST: 150,
    NORMAL: 200,
    SLOW: 300,
    EXTRA_SLOW: 500,
  },
  EASING: {
    DEFAULT: 'ease-in-out',
    ENTER: 'ease-out',
    EXIT: 'ease-in',
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK: 'Network error. Please check your connection.',
  API_ERROR: 'API error occurred. Please try again.',
  NOT_FOUND: 'The requested resource was not found.',
  INVALID_DATE: 'Invalid date format.',
  MEMORY_NOT_FOUND: 'Memory not found.',
  GENERIC: 'An unexpected error occurred.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  FAVORITE_ADDED: 'Added to favorites',
  FAVORITE_REMOVED: 'Removed from favorites',
  TAG_ADDED: 'Tag added',
  TAG_REMOVED: 'Tag removed',
  COPIED: 'Copied!',
  SAVED: 'Changes saved',
} as const;

// Validation Rules
export const VALIDATION = {
  TAG: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\s-_]+$/,
  },
  SEARCH: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
} as const;

// File Size Limits
export const FILE_LIMITS = {
  MAX_IMAGE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_VIDEO_SIZE: 500 * 1024 * 1024, // 500MB
  SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  SUPPORTED_VIDEO_FORMATS: ['mp4', 'mov', 'avi', 'webm'],
} as const;

// Logging Configuration
export const LOGGING_CONFIG = {
  MAX_LOGS: 1000,
  DEFAULT_LEVEL: 'INFO',
  LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  },
} as const;