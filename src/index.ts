import { program } from 'commander';
import { listCommand } from './commands/list.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { initCommand } from './commands/init.js';

program
  .name('wtm')
  .description('Git worktree manager')
  .version('0.1.0');

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

// Set default action to interactive list
program
  .action(() => {
    listCommand({ interactive: true });
  });

export { program };