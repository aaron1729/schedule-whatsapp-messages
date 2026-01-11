import * as fs from 'fs/promises';
import * as path from 'path';

interface DdFileInfo {
  filename: string;
  date: Date;
  fullPath: string;
}

/**
 * Read the chat ID from config-dd file
 */
export async function getDdChatId(): Promise<string> {
  try {
    const configPath = path.join(process.cwd(), 'config-dd');
    const content = await fs.readFile(configPath, 'utf8');
    return content.trim();
  } catch (error: any) {
    throw new Error('config-dd file not found. Please create it with the chat ID.');
  }
}

/**
 * Find all dd files in txt-messages directory
 * Files should be named: YYYY-MM-DD-dd.txt
 */
export async function findDdFiles(): Promise<DdFileInfo[]> {
  const txtMessagesDir = path.join(process.cwd(), 'txt-messages');

  try {
    const files = await fs.readdir(txtMessagesDir);
    const ddFiles: DdFileInfo[] = [];

    // Pattern: YYYY-MM-DD-dd.txt
    const pattern = /^(\d{4})-(\d{2})-(\d{2})-dd\.txt$/;

    for (const file of files) {
      const match = file.match(pattern);
      if (match) {
        const [, year, month, day] = match;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

        ddFiles.push({
          filename: file,
          date,
          fullPath: path.join(txtMessagesDir, file),
        });
      }
    }

    return ddFiles;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error('txt-messages directory not found. Please create it first.');
    }
    throw error;
  }
}

/**
 * Get the latest dd file by date
 */
export async function getLatestDdFile(): Promise<DdFileInfo | null> {
  const files = await findDdFiles();

  if (files.length === 0) {
    return null;
  }

  // Sort by date descending and return the first one
  files.sort((a, b) => b.date.getTime() - a.date.getTime());
  return files[0];
}

/**
 * Extract date from filename (YYYY-MM-DD-dd.txt)
 */
export function extractDateFromFilename(filename: string): Date | null {
  const pattern = /^(\d{4})-(\d{2})-(\d{2})-dd\.txt$/;
  const match = filename.match(pattern);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * Convert a date to Central Time and get just the date part (YYYY-MM-DD)
 */
export function getDateInCentralTime(date: Date): string {
  // Convert to Central Time (America/Chicago)
  const centralTimeString = date.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Parse the date string (MM/DD/YYYY format)
  const [month, day, year] = centralTimeString.split('/');

  // Return in YYYY-MM-DD format
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Check if scheduled time matches the date in the filename (both in Central Time)
 */
export function validateDateMatch(scheduledTime: Date, filenameDate: Date): {
  matches: boolean;
  scheduledDateCT: string;
  filenameDateCT: string;
} {
  const scheduledDateCT = getDateInCentralTime(scheduledTime);
  const filenameDateCT = getDateInCentralTime(filenameDate);

  return {
    matches: scheduledDateCT === filenameDateCT,
    scheduledDateCT,
    filenameDateCT,
  };
}
