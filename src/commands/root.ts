import { GitWorktreeManager } from '../utils/git.js';
import path from 'path';

export async function rootCommand(): Promise<void> {
  const git = new GitWorktreeManager();
  
  if (!(await git.isGitRepository())) {
    console.error('Error: This command must be run inside a Git repository');
    process.exit(1);
  }

  try {
    // Get the git common directory (equivalent to git rev-parse --git-common-dir)
    const gitCommonDir = await git.revParse(['--git-common-dir']);
    // Get the parent directory (equivalent to dirname)
    const rootPath = path.dirname(gitCommonDir);
    console.log(rootPath);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}