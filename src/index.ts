import { program } from 'commander';
import { listCommand } from './commands/list';
import { addCommand } from './commands/add';
import { removeCommand } from './commands/remove';
import { initCommand } from './commands/init';

program
  .name('wtm')
  .description('Git worktree manager')
  .version('0.1.0');

program
  .command('list', { isDefault: true })
  .description('List all worktrees')
  .option('-j, --json', 'Output in JSON format')
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

export { program };