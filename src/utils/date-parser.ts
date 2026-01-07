import * as chrono from 'chrono-node';
import { format } from 'date-fns';

/**
 * Parse natural language date string into a Date object
 * @param input Natural language date string (e.g., "tomorrow at 2pm", "in 3 hours")
 * @returns Parsed Date object or null if parsing failed
 */
export function parseNaturalDate(input: string): Date | null {
  const results = chrono.parse(input);

  if (results.length === 0) {
    return null;
  }

  // Take the first parsed result
  const parsedDate = results[0].start.date();

  return parsedDate;
}

/**
 * Validate that a date is in the future
 * @param date Date to validate
 * @returns true if date is in the future, false otherwise
 */
export function validateFutureDate(date: Date): boolean {
  const now = new Date();
  return date.getTime() > now.getTime();
}

/**
 * Format a date as a human-readable string
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDateTime(date: Date): string {
  return format(date, 'MMMM d, yyyy \'at\' h:mm a');
}

/**
 * Format a date as ISO 8601 string for storage
 * @param date Date to format
 * @returns ISO 8601 string
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Parse ISO 8601 string to Date
 * @param isoString ISO 8601 date string
 * @returns Date object
 */
export function fromISOString(isoString: string): Date {
  return new Date(isoString);
}
