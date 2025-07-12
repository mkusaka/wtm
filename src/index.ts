import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { listCommand } from './commands/list.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { initCommand } from './commands/init.js';
import { rootCommand } from './commands/root.js';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

program
  .name('wtm')
  .description('Git worktree manager')
  .version(packageJson.version);

program
  .command('list')
  .description('List all worktrees')
  .option('-j, --json', 'Output in JSON format')
  .option('--no-interactive', 'Disable interactive mode')
  .action(listCommand);

program
  .command('add <branch>')
  .description('Create a new worktree')
  .option('-b, --base <branch>', 'Base branch to create from', 'HEAD')
  .action(addCommand);

program
  .command('remove <branch>')
  .description('Remove a worktree and its branch')
  .option('-f, --force', 'Force removal without confirmation')
  .action(removeCommand);

program
  .command('init')
  .description('Initialize hook file in current repository')
  .action(initCommand);

program
  .command('root')
  .description('Show the main repository path (use with: cd "$(wtm root)")')
  .option('-j, --json', 'Output in JSON format')
  .option('-v, --verbose', 'Show detailed information about worktree status')
  .action(rootCommand);

// Set default action to interactive list
program
  .action(() => {
    listCommand({ interactive: true });
  });

export { program };