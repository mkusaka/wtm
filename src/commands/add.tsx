import React from 'react';
import { render } from 'ink';
import chalk from 'chalk';
import ora from 'ora';
import { GitWorktreeManager } from '../utils/git.js';
import { HookManager } from '../utils/hook.js';
import { InteractiveBranchSelector } from '../components/InteractiveBranchSelector.js';
import type { AddCommandOptions } from '../types/index.js';

export async function addCommand(options: AddCommandOptions): Promise<void> {
  const quiet = !process.stderr.isTTY; // Detect if output is being piped
  const git = new GitWorktreeManager();
  
  if (!(await git.isGitRepository())) {
    if (quiet) {
      console.error('Not in a git repository');
    } else {
      console.error(chalk.red('Not in a git repository'));
    }
    process.exit(1);
  }

  let branch: string;
  let baseBranch = options.from || 'HEAD';
  
  // Handle the -b option
  if (!options.branch || options.branch === true) {
    // -b was not passed or passed without a value, show interactive selector for branch name
    const branches = await git.listBranches();
    
    if (branches.length === 0) {
      console.error(chalk.red('No branches found'));
      process.exit(1);
    }
    
    branch = await new Promise<string>((resolve) => {
      const { unmount } = render(
        <InteractiveBranchSelector
          branches={branches}
          onSelect={(selectedBranch) => {
            unmount();
            resolve(selectedBranch);
          }}
          onExit={() => {
            unmount();
            process.exit(0);
          }}
        />
      );
    });
  } else {
    // -b was passed with a value
    branch = options.branch as string;
  }

  // If path-only mode or quiet mode, don't show spinner or other output
  const spinner = (options.pathOnly || quiet) ? null : ora(`Creating worktree for branch '${branch}' from '${baseBranch}'...`).start();
  
  try {
    const worktreePath = await git.addWorktree(branch, baseBranch);
    
    if (options.pathOnly) {
      // Output only the path for shell integration
      console.log(worktreePath);
      
      // Still run hooks in path-only mode, but silently
      const projectRoot = await git.getProjectRoot();
      const hookManager = new HookManager(projectRoot);
      
      if (await hookManager.exists()) {
        try {
          await hookManager.execute(worktreePath, branch);
        } catch {
          // Silently ignore hook errors in path-only mode
        }
      }
    } else {
      // Shell mode or regular output mode
      if (!options.shell) {
        spinner!.succeed(`Created worktree at: ${chalk.green(worktreePath)}`);
      }
      
      if (!quiet) {
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
          const { execSync } = await import('child_process');
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
    }
    
  } catch (error: any) {
    if (options.pathOnly || quiet) {
      // In path-only mode or quiet mode, output error to stderr
      console.error(error.message);
    } else {
      spinner!.fail(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}