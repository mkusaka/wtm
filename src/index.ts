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
  .command('add')
  .description('Create a new worktree')
  .option('-b, --branch [branch]', 'Branch name for the new worktree (interactive if not specified)')
  .option('--from <branch>', 'Base branch to create from', 'HEAD')
  .option('--path-only', 'Output only the worktree path (useful for shell functions)')
  .option('-s, --shell', 'Launch a new shell in the worktree directory')
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
  .action(rootCommand);

// Set default action to interactive list
program
  .action(() => {
    listCommand({ interactive: true });
  });

export { program };