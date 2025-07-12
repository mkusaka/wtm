import type { SimpleGit } from 'simple-git';

export interface Worktree {
  path: string;
  head: string;
  branch?: string;
  detached?: boolean;
}

export interface WorktreeStatus {
  modified: number;
  created: number;
  deleted: number;
  isClean: boolean;
}

export interface CommitInfo {
  hash: string;
  message: string;
  date: string;
}

export interface EnrichedWorktree extends Worktree {
  status?: WorktreeStatus;
  recentCommits?: CommitInfo[];
  error?: string;
}

export interface ListCommandOptions {
  json?: boolean;
  interactive?: boolean;
}

export interface AddCommandOptions {
  base?: string;
  shell?: boolean;
}

export interface RemoveCommandOptions {
  force?: boolean;
}

export interface RootCommandOptions {
  json?: boolean;
  verbose?: boolean;
}

export interface GitWorktreeManagerInterface {
  git: SimpleGit;
  cwd: string;
  isGitRepository(): Promise<boolean>;
  getGitDir(): Promise<string>;
  listWorktrees(): Promise<Worktree[]>;
  addWorktree(branch: string, baseBranch?: string): Promise<string>;
  removeWorktree(branch: string): Promise<void>;
  getStatus(worktreePath: string): Promise<any>;
  getLog(worktreePath: string, limit?: number): Promise<any[]>;
  getProjectRoot(): Promise<string>;
}

export interface HookManagerInterface {
  projectRoot: string;
  hookPath: string;
  exists(): Promise<boolean>;
  execute(worktreePath: string, branchName: string): Promise<boolean>;
  create(): Promise<void>;
}