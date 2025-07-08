import chalk from 'chalk';
import { GitWorktreeManager } from '../utils/git';
import { HookManager } from '../utils/hook';

export async function initCommand(): Promise<void> {
  try {
    const git = new GitWorktreeManager();
    
    if (!(await git.isGitRepository())) {
      console.error(chalk.red('Not in a git repository'));
      process.exit(1);
    }
    
    const projectRoot = await git.getProjectRoot();
    const hookManager = new HookManager(projectRoot);
    
    if (await hookManager.exists()) {
      console.error(chalk.yellow('.wt_hook.js already exists'));
      process.exit(1);
    }
    
    await hookManager.create();
    
    console.log(chalk.green('✅ Created .wt_hook.js'));
    console.log(`\n${chalk.bold('Hook file location:')} ${hookManager.hookPath}`);
    console.log(`\n${chalk.bold('What\'s next:')}`);
    console.log('  1. Edit .wt_hook.js to customize worktree initialization');
    console.log('  2. The hook will run automatically after \'wtm add\'');
    console.log(`\n${chalk.gray('The default hook copies .env, .env.local, and .claude files/directories')}`);
    
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}