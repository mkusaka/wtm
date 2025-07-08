import chalk from 'chalk';
import ora from 'ora';
import { GitWorktreeManager } from '../utils/git.js';
import { HookManager } from '../utils/hook.js';
import type { AddCommandOptions } from '../types/index.js';

export async function addCommand(branch: string, options: AddCommandOptions): Promise<void> {
  const spinner = ora(`Creating worktree for branch '${branch}'...`).start();
  
  try {
    const git = new GitWorktreeManager();
    
    if (!(await git.isGitRepository())) {
      spinner.fail('Not in a git repository');
      process.exit(1);
    }
    
    const worktreePath = await git.addWorktree(branch, options.base);
    spinner.succeed(`Created worktree at: ${chalk.green(worktreePath)}`);
    
    console.log(`Branch: ${chalk.cyan(branch)}`);
    
    const projectRoot = await git.getProjectRoot();
    const hookManager = new HookManager(projectRoot);
    
    if (await hookManager.exists()) {
      const hookSpinner = ora('Running hook...').start();
      try {
        await hookManager.execute(worktreePath, branch);
        hookSpinner.succeed('Hook executed successfully');
      } catch (error: any) {
        hookSpinner.fail(`Hook failed: ${error.message}`);
      }
    }
    
    console.log(`\n${chalk.bold('Next steps:')}`);
    console.log(`  ${chalk.cyan('cd')} ${worktreePath}`);
    console.log('  # Start working on your feature\n');
    
  } catch (error: any) {
    spinner.fail(`Error: ${error.message}`);
    process.exit(1);
  }
}