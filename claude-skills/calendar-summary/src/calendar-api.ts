/**
 * calendar-api.ts
 * Google Calendar REST API helpers. Uses @gwynj/google-oauth for token management.
 */

import { getAccessToken } from '@gwynj/google-oauth';
import type { CalendarEvent } from './types.js';

const BASE = 'https://www.googleapis.com/calendar/v3';

// ── Types matching Calendar API responses ────────────────────────────────────

export interface CalendarListEntry {
  id: string;
  summary: string;
  summaryOverride?: string;
  primary?: boolean;
  accessRole?: string;
}

interface ApiCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end:   { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string; self?: boolean }>;
  recurrence?: string[];
  htmlLink?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function calendarFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const accessToken = await getAccessToken('calendar');
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Calendar API ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function listCalendars(): Promise<CalendarListEntry[]> {
  const data = await calendarFetch<{ items?: CalendarListEntry[] }>('/users/me/calendarList');
  return data.items ?? [];
}

/**
 * Fetch events from a single calendar within a time window.
 *
 * @param calendarId  Calendar ID
 * @param timeMin     ISO 8601 string (inclusive lower bound)
 * @param timeMax     ISO 8601 string (inclusive upper bound)
 * @param tz          IANA timezone string (e.g. 'Pacific/Auckland')
 * @param fields      Optional extra fields to request beyond the default set
 */
export async function listEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  tz: string,
  fields: string[] = [],
): Promise<ApiCalendarEvent[]> {
  // Base fields always fetched; caller can add extras
  const baseFields = ['id', 'summary', 'start', 'end', 'status', 'htmlLink'];
  const allFields = [...new Set([...baseFields, ...fields])];

  const results: ApiCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      timeMin,
      timeMax,
      timeZone: tz,
      singleEvents: 'true',
      orderBy: 'startTime',
      fields: `nextPageToken,items(${allFields.join(',')})`,
      ...(pageToken ? { pageToken } : {}),
    };

    const page = await calendarFetch<{ nextPageToken?: string; items?: ApiCalendarEvent[] }>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      params,
    );

    if (page.items) results.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);

  return results;
}

// ── Write operations (used by event-manage) ───────────────────────────────

export async function createEvent(
  calendarId: string,
  body: Record<string, unknown>,
): Promise<ApiCalendarEvent> {
  const accessToken = await getAccessToken('calendar');
  const url = `${BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Calendar API create failed: ${await res.text()}`);
  return res.json() as Promise<ApiCalendarEvent>;
}

export async function updateEvent(
  calendarId: string,
  eventId: string,
  body: Record<string, unknown>,
): Promise<ApiCalendarEvent> {
  const accessToken = await getAccessToken('calendar');
  const url = `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Calendar API update failed: ${await res.text()}`);
  return res.json() as Promise<ApiCalendarEvent>;
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const accessToken = await getAccessToken('calendar');
  const url = `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Calendar API delete failed: ${await res.text()}`);
  }
}

export async function respondToEvent(
  calendarId: string,
  eventId: string,
  responseStatus: 'accepted' | 'declined' | 'tentative',
): Promise<void> {
  const accessToken = await getAccessToken('calendar');
  const url = `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  // Fetch existing event to find self attendee entry
  const getRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!getRes.ok) throw new Error(`Calendar API get failed: ${await getRes.text()}`);
  const event = await getRes.json() as ApiCalendarEvent;

  const selfAttendee = event.attendees?.find(a => a.self);
  if (!selfAttendee) throw new Error('No self attendee found on event');

  const updatedAttendees = event.attendees!.map(a =>
    a.self ? { ...a, responseStatus } : a
  );

  const patchRes = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ attendees: updatedAttendees }),
  });
  if (!patchRes.ok) throw new Error(`Calendar API respond failed: ${await patchRes.text()}`);
}
