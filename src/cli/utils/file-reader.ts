import * as fs from 'fs/promises';
import * as path from 'path';
import { error } from './formatting';

/**
 * Read message content from a text file
 * @param filePath Path to the text file (relative paths checked in txt-messages/ first)
 * @returns File content as string, or null if error
 */
export async function readMessageFromFile(filePath: string): Promise<string | null> {
  try {
    // If it's just a filename (no path separators), look in txt-messages/ directory
    let resolvedPath = filePath;
    if (!filePath.includes('/') && !filePath.includes('\\')) {
      resolvedPath = path.join(process.cwd(), 'txt-messages', filePath);
    }

    // Check if file exists
    await fs.access(resolvedPath);

    // Read file content
    const content = await fs.readFile(resolvedPath, 'utf-8');

    // Trim whitespace
    const trimmed = content.trim();

    // Validate not empty
    if (trimmed.length === 0) {
      error('File is empty');
      return null;
    }

    return trimmed;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      error(`File not found: ${filePath}`);
    } else if (err.code === 'EACCES') {
      error(`Permission denied: ${filePath}`);
    } else {
      error(`Failed to read file: ${err.message}`);
    }
    return null;
  }
}
