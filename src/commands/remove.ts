import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { GitWorktreeManager } from '../utils/git';
import type { RemoveCommandOptions } from '../types/index';

function askConfirmation(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export async function removeCommand(branch: string, options: RemoveCommandOptions): Promise<void> {
  try {
    const git = new GitWorktreeManager();
    
    if (!(await git.isGitRepository())) {
      console.error(chalk.red('Not in a git repository'));
      process.exit(1);
    }
    
    const worktrees = await git.listWorktrees();
    const worktree = worktrees.find(w => w.branch === branch);
    
    if (!worktree) {
      console.error(chalk.red(`No worktree found for branch: ${branch}`));
      process.exit(1);
    }
    
    console.log(`\n${chalk.bold('Worktree to remove:')}`);
    console.log(`  Branch: ${chalk.cyan(branch)}`);
    console.log(`  Path:   ${worktree.path}\n`);
    
    let confirmed = options.force || false;
    
    if (!confirmed) {
      confirmed = await askConfirmation(
        `${chalk.yellow('⚠️  Warning:')} This will remove the worktree and delete the branch '${branch}'.\n` +
        'Are you sure? (y/N) '
      );
    }
    
    if (!confirmed) {
      console.log(chalk.gray('Cancelled'));
      return;
    }
    
    const spinner = ora(`Removing worktree for branch '${branch}'...`).start();
    
    await git.removeWorktree(branch);
    
    spinner.succeed(`Removed worktree and branch: ${chalk.red(branch)}`);
    
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}