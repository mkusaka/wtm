import chalk from 'chalk';
import ora from 'ora';
import { GitWorktreeManager } from '../utils/git.js';
import { interactiveCommand } from './interactive.js';
import type { ListCommandOptions, EnrichedWorktree } from '../types/index.js';

export async function listCommand(options: ListCommandOptions): Promise<void> {
  // Interactive mode
  if (options.interactive) {
    return interactiveCommand();
  }
  
  const spinner = ora('Loading worktrees...').start();
  
  try {
    const git = new GitWorktreeManager();
    
    if (!(await git.isGitRepository())) {
      spinner.fail('Not in a git repository');
      process.exit(1);
    }
    
    const worktrees = await git.listWorktrees();
    spinner.stop();
    
    if (worktrees.length === 0) {
      console.log(chalk.yellow('No worktrees found'));
      return;
    }
    
    if (options.json) {
      const enrichedWorktrees: EnrichedWorktree[] = await Promise.all(
        worktrees.map(async (wt) => {
          try {
            const status = await git.getStatus(wt.path);
            const logs = await git.getLog(wt.path, 5);
            return {
              ...wt,
              status: {
                modified: status.modified.length,
                created: status.created.length,
                deleted: status.deleted.length,
                isClean: status.isClean()
              },
              recentCommits: logs.map((log: any) => ({
                hash: log.hash,
                message: log.message,
                date: log.date
              }))
            };
          } catch (error: any) {
            return {
              ...wt,
              error: error.message
            };
          }
        })
      );
      console.log(JSON.stringify(enrichedWorktrees, null, 2));
      return;
    }
    
    console.log(chalk.bold.cyan('🌳 Git Worktrees:\n'));
    
    for (const worktree of worktrees) {
      const branchDisplay = worktree.branch 
        ? chalk.green(worktree.branch)
        : chalk.red('(detached)');
      
      console.log(`${chalk.bold('Branch:')} ${branchDisplay}`);
      console.log(`${chalk.bold('Path:')}   ${worktree.path}`);
      console.log(`${chalk.bold('HEAD:')}   ${worktree.head}`);
      
      try {
        const status = await git.getStatus(worktree.path);
        if (status.isClean()) {
          console.log(`${chalk.bold('Status:')} ${chalk.green('✨ Clean')}`);
        } else {
          const changes: string[] = [];
          if (status.modified.length > 0) changes.push(`${status.modified.length} modified`);
          if (status.created.length > 0) changes.push(`${status.created.length} added`);
          if (status.deleted.length > 0) changes.push(`${status.deleted.length} deleted`);
          console.log(`${chalk.bold('Status:')} ${chalk.yellow(changes.join(', '))}`);
        }
      } catch (error: any) {
        console.log(`${chalk.bold('Status:')} ${chalk.red('Error: ' + error.message)}`);
      }
      
      console.log(chalk.gray('─'.repeat(60)));
    }
  } catch (error: any) {
    spinner.fail(`Error: ${error.message}`);
    process.exit(1);
  }
}