import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { GitWorktreeManager } from '../utils/git.js';
import { HookManager } from '../utils/hook.js';
import type { AddCommandOptions } from '../types/index.js';

export async function addCommand(branch: string, options: AddCommandOptions): Promise<void> {
  const quiet = !process.stderr.isTTY; // Detect if output is being piped
  const spinner = quiet ? null : ora(`Creating worktree for branch '${branch}'...`).start();
  
  try {
    const git = new GitWorktreeManager();
    
    if (!(await git.isGitRepository())) {
      if (spinner) spinner.fail('Not in a git repository');
      else console.error('Not in a git repository');
      process.exit(1);
    }
    
    const worktreePath = await git.addWorktree(branch, options.base);
    
    if (!quiet) {
      spinner!.succeed(`Created worktree at: ${chalk.green(worktreePath)}`);
      console.error(`Branch: ${chalk.cyan(branch)}`);
    }
    
    const projectRoot = await git.getProjectRoot();
    const hookManager = new HookManager(projectRoot);
    
    if (await hookManager.exists()) {
      const hookSpinner = quiet ? null : ora('Running hook...').start();
      try {
        await hookManager.execute(worktreePath, branch);
        if (hookSpinner) hookSpinner.succeed('Hook executed successfully');
      } catch (error: any) {
        if (hookSpinner) hookSpinner.fail(`Hook failed: ${error.message}`);
        else console.error(`Hook failed: ${error.message}`);
      }
    }
    
    if (options.shell) {
      // Launch a new shell in the worktree directory
      console.error(`\n${chalk.green('Launching new shell in worktree directory...')}`);
      try {
        const shell = process.env.SHELL || '/bin/bash';
        execSync(shell, {
          stdio: 'inherit',
          cwd: worktreePath
        });
      } catch (error: any) {
        console.error(chalk.red(`Failed to launch shell: ${error.message}`));
      }
    } else {
      // Output just the path to stdout for shell integration
      console.log(worktreePath);
    }
    
  } catch (error: any) {
    if (spinner) spinner.fail(`Error: ${error.message}`);
    else console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}