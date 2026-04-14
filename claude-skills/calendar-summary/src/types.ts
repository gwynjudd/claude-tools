// types.ts — shared interfaces for calendar-summary

export type Nearness = 'IMMINENT' | 'VERY_SOON' | 'THIS_WEEK' | 'NEXT_WEEK' | 'THIS_MONTH' | 'LATER';
export type PrepLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end:   { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
  }>;
  recurrence?: string[];
  htmlLink?: string;
  calendarId: string;    // injected: the calendar this event belongs to
  calendarName: string;  // injected: summaryOverride ?? summary
}

export interface ScoredEvent extends CalendarEvent {
  days_until: number;
  nearness: Nearness;
  cached: boolean;
  prep_level?: PrepLevel;  // present when cached=true
  notes?: string;          // one-sentence note; present when cached=true
}

export interface FetchEventsOutput {
  generated_at: string;              // ISO timestamp
  window_days: number;
  today: string;                     // YYYY-MM-DD Pacific/Auckland
  events: ScoredEvent[];
  yesterday_events?: ScoredEvent[];  // only when --yesterday flag used
}

// ~/.config/calendar-summary/event-cache.json — keyed by event ID
export interface CacheEntry {
  fingerprint: string;    // sha256(title + '\0' + desc + '\0' + location + '\0' + start)
  prep_level: PrepLevel;
  notes: string;
  last_assessed: string;  // YYYY-MM-DD
}

export type EventCache = Record<string, CacheEntry>;
