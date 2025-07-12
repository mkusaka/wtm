import chalk from 'chalk';
import ora from 'ora';
import { GitWorktreeManager } from '../utils/git.js';
import type { RootCommandOptions } from '../types/index.js';
import fs from 'fs/promises';
import path from 'path';

export async function rootCommand(options: RootCommandOptions = {}): Promise<void> {
  const spinner = options.verbose && !options.json ? ora('Finding main repository...').start() : null;
  
  try {
    const git = new GitWorktreeManager();
    
    if (!(await git.isGitRepository())) {
      if (spinner) spinner.fail('Not in a git repository');
      process.exit(1);
    }
    
    const currentPath = process.cwd();
    let mainRepository: string | undefined;
    let envFileFound = false;
    
    // First, try to read from .wt_env file in current directory
    try {
      const envPath = path.join(currentPath, '.wt_env');
      const envContent = await fs.readFile(envPath, 'utf-8');
      const match = envContent.match(/^WT_ROOT_DIR="(.+)"$/m);
      if (match) {
        mainRepository = match[1];
        envFileFound = true;
      }
    } catch {
      // .wt_env file doesn't exist or can't be read, fallback to git worktree detection
    }
    
    const projectRoot = await git.getProjectRoot();
    const worktrees = await git.listWorktrees();
    
    // If not found in .env, use worktree detection
    if (!mainRepository) {
      const mainWorktree = worktrees.find(w => !w.path.includes('tmp_worktrees'));
      mainRepository = mainWorktree?.path || projectRoot;
    }
    
    // Sort worktrees by path length (descending) to match the most specific path first
    const sortedWorktrees = [...worktrees].sort((a, b) => b.path.length - a.path.length);
    
    const currentWorktree = sortedWorktrees.find(w => currentPath.startsWith(w.path));
    
    // Warn if in a worktree without .wt_env file (likely created outside of wtm)
    if (!envFileFound && currentWorktree && currentWorktree.path !== mainRepository && currentWorktree.path.includes('tmp_worktrees')) {
      console.error(chalk.yellow('Warning: This worktree appears to be created outside of wtm (no .wt_env file found)'));
      console.error(chalk.yellow('Consider using "wtm add" for better integration'));
    }
    
    if (spinner) spinner.stop();
    
    if (options.json) {
      console.log(JSON.stringify({
        projectRoot,
        mainRepository,
        currentPath,
        currentWorktree: currentWorktree?.path || null,
        isInWorktree: !!currentWorktree && currentWorktree.path !== mainRepository
      }, null, 2));
      return;
    }
    
    if (options.verbose) {
      // Verbose output with full details
      console.log(`\n${chalk.bold('Project root:')} ${chalk.green(projectRoot)}`);
      console.log(`${chalk.bold('Main repository:')} ${chalk.green(mainRepository)}`);
      
      if (currentWorktree && currentWorktree.path !== mainRepository) {
        console.log(`${chalk.bold('Current worktree:')} ${chalk.cyan(currentWorktree.path)}`);
        console.log(`${chalk.bold('Branch:')} ${chalk.cyan(currentWorktree.branch || '(detached)')}`);
        console.log(`\n${chalk.bold('To navigate to main repository:')}`);
        console.log(`  ${chalk.cyan('cd "$(wtm root)"')}`);
      } else {
        console.log(chalk.gray('\nYou are currently in the main repository'));
      }
    } else {
      // Default: output only the path
      if (currentWorktree && currentWorktree.path !== mainRepository) {
        console.log(mainRepository);
      } else {
        // Output current directory if already in main repository
        console.log(currentPath);
      }
    }
    
  } catch (error: any) {
    if (spinner) spinner.fail(`Error: ${error.message}`);
    process.exit(1);
  }
}