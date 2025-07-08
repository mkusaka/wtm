import React from 'react';
import { render } from 'ink';
import chalk from 'chalk';
import { GitWorktreeManager } from '../utils/git.js';
import { WorktreeSelector } from '../components/WorktreeSelector.js';
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
    console.log(chalk.green(`\nTo change to this worktree, run:`));
    console.log(chalk.cyan(`  cd ${worktree.path}`));
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
    React.createElement(WorktreeSelector, {
      worktrees,
      onSelect: handleSelect,
      onDelete: handleDelete,
      onExit: handleExit
    })
  );
}