import { simpleGit } from 'simple-git';
import type { SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import type { Worktree, GitWorktreeManagerInterface } from '../types/index.js';

export class GitWorktreeManager implements GitWorktreeManagerInterface {
  git: SimpleGit;
  cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.git = simpleGit(cwd);
    this.cwd = cwd;
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await this.git.revparse(['--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  async getGitDir(): Promise<string> {
    const gitDir = await this.git.revparse(['--git-dir']);
    return path.resolve(this.cwd, gitDir.trim());
  }

  async listWorktrees(): Promise<Worktree[]> {
    const raw = await this.git.raw(['worktree', 'list', '--porcelain']);
    const worktrees: Worktree[] = [];
    const lines = raw.split('\n');
    
    let currentWorktree: Partial<Worktree> = {};
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree as Worktree);
        }
        currentWorktree = { path: line.substring(9) };
      } else if (line.startsWith('HEAD ')) {
        currentWorktree.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        let branch = line.substring(7);
        // Remove refs/heads/ prefix if present
        if (branch.startsWith('refs/heads/')) {
          branch = branch.substring(11);
        }
        currentWorktree.branch = branch;
      } else if (line.startsWith('detached')) {
        currentWorktree.detached = true;
      } else if (line === '') {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree as Worktree);
          currentWorktree = {};
        }
      }
    }
    
    if (currentWorktree.path) {
      worktrees.push(currentWorktree as Worktree);
    }
    
    return worktrees;
  }

  async addWorktree(branch: string, baseBranch: string = 'HEAD'): Promise<string> {
    const gitDir = await this.getGitDir();
    const tmpDir = path.join(gitDir, 'tmp_worktrees');
    await fs.mkdir(tmpDir, { recursive: true });
    
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .split('.')[0];
    const dirName = `${timestamp}_${branch}`;
    const worktreePath = path.join(tmpDir, dirName);
    
    // Check if the branch already exists
    const branches = await this.listBranches();
    const branchExists = branches.includes(branch);
    
    if (branchExists) {
      // If branch exists, just check it out in the new worktree
      await this.git.raw(['worktree', 'add', worktreePath, branch]);
    } else {
      // If branch doesn't exist, create it from baseBranch
      await this.git.raw(['worktree', 'add', '-b', branch, worktreePath, baseBranch]);
    }
    
    return worktreePath;
  }

  async removeWorktree(branch: string): Promise<void> {
    const worktrees = await this.listWorktrees();
    const worktree = worktrees.find(w => w.branch === branch);
    
    if (!worktree) {
      throw new Error(`No worktree found for branch: ${branch}`);
    }
    
    await this.git.raw(['worktree', 'remove', '--force', worktree.path]);
    
    try {
      await this.git.deleteLocalBranch(branch, true);
    } catch (error: any) {
      console.warn(`Warning: Could not delete branch ${branch}: ${error.message}`);
    }
  }

  async getStatus(worktreePath: string): Promise<any> {
    const worktreeGit = simpleGit(worktreePath);
    return await worktreeGit.status();
  }

  async getLog(worktreePath: string, limit: number = 10): Promise<any[]> {
    const worktreeGit = simpleGit(worktreePath);
    const log = await worktreeGit.log(['-n', limit.toString()]);
    return [...log.all];
  }

  async getProjectRoot(): Promise<string> {
    const toplevel = await this.git.revparse(['--show-toplevel']);
    return toplevel.trim();
  }

  async listBranches(): Promise<string[]> {
    const branchSummary = await this.git.branch(['--all']);
    const branches: string[] = [];
    
    // Include local branches
    branchSummary.branches && Object.entries(branchSummary.branches).forEach(([name, _info]) => {
      // Skip remotes branches for now
      if (!name.startsWith('remotes/')) {
        // Remove any prefix like '* ' for current branch
        const cleanName = name.replace(/^\*\s*/, '');
        if (cleanName && cleanName !== 'HEAD') {
          branches.push(cleanName);
        }
      }
    });
    
    return branches.sort();
  }
}