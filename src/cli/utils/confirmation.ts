import inquirer from 'inquirer';

/**
 * Prompt user for yes/no confirmation
 * @param message The question to ask
 * @returns true if user confirms, false otherwise
 */
export async function confirm(message: string): Promise<boolean> {
  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false,
    },
  ]);

  return answer.confirmed;
}
