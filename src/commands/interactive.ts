import React from 'react';
import { render } from 'ink';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { GitWorktreeManager } from '../utils/git.js';
import { InteractiveWorktreeSelector } from '../components/InteractiveWorktreeSelector.js';
import type { Worktree } from '../types/index.js';

export async function interactiveCommand(): Promise<void> {
  const git = new GitWorktreeManager();
  
  if (!(await git.isGitRepository())) {
    console.error(chalk.red('Not in a git repository'));
    process.exit(1);
  }
  
  const worktrees = await git.listWorktrees();
  
  if (worktrees.length === 0) {
    console.log(chalk.yellow('No worktrees found'));
    return;
  }

  const handleSelect = (worktree: Worktree) => {
    try {
      // Clear the terminal and show the path
      console.clear();
      console.log(chalk.green(`\nChanging to worktree: ${worktree.branch || '(detached)'}`));
      console.log(chalk.cyan(`Path: ${worktree.path}\n`));
      
      // Launch new shell in the worktree directory
      const shell = process.env.SHELL || '/bin/bash';
      execSync(shell, {
        stdio: 'inherit',
        cwd: worktree.path
      });
    } catch (error: any) {
      console.error(chalk.red(`\nFailed to change directory: ${error.message}`));
    }
    process.exit(0);
  };

  const handleDelete = async (worktree: Worktree) => {
    if (!worktree.branch) return;
    
    try {
      await git.removeWorktree(worktree.branch);
      console.log(chalk.red(`\nRemoved worktree and branch: ${worktree.branch}`));
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  };

  const handleExit = () => {
    process.exit(0);
  };

  render(
    React.createElement(InteractiveWorktreeSelector, {
      worktrees,
      onSelect: handleSelect,
      onDelete: handleDelete,
      onExit: handleExit
    })
  );
}