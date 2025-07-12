import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { rootCommand } from '../../src/commands/root.js';
import { GitWorktreeManager } from '../../src/utils/git.js';
import fs from 'fs/promises';

vi.mock('../../src/utils/git.js');
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    fail: vi.fn()
  })
}));
vi.mock('fs/promises');

describe('rootCommand warnings', () => {
  let mockGitManager: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processCwdSpy: any;

  beforeEach(() => {
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      getProjectRoot: vi.fn().mockResolvedValue('/project/root'),
      listWorktrees: vi.fn().mockResolvedValue([])
    };

    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processCwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/project/root');
    // Default: no .wt_env file
    vi.mocked(fs.readFile).mockRejectedValue(new Error('No .wt_env file'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should warn when in a worktree without .wt_env file', async () => {
    processCwdSpy.mockReturnValue('/project/root/.git/tmp_worktrees/20250712_103426_feature');
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' },
      { path: '/project/root/.git/tmp_worktrees/20250712_103426_feature', head: 'def456', branch: 'feature' }
    ]);

    await rootCommand();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      chalk.yellow('Warning: This worktree appears to be created outside of wtm (no .wt_env file found)')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      chalk.yellow('Consider using "wtm add" for better integration')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('/project/root');
  });

  it('should not warn when .wt_env file exists', async () => {
    processCwdSpy.mockReturnValue('/project/root/.git/tmp_worktrees/20250712_103426_feature');
    
    // Mock .wt_env file exists
    vi.mocked(fs.readFile).mockResolvedValue(
      'WT_ROOT_DIR="/project/root"\n'
    );
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' },
      { path: '/project/root/.git/tmp_worktrees/20250712_103426_feature', head: 'def456', branch: 'feature' }
    ]);

    await rootCommand();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('/project/root');
  });

  it('should not warn when in main repository', async () => {
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' }
    ]);

    await rootCommand();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('/project/root');
  });

  it('should not warn for worktrees not in tmp_worktrees', async () => {
    processCwdSpy.mockReturnValue('/project/feature-worktree');
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' },
      { path: '/project/feature-worktree', head: 'def456', branch: 'feature' }
    ]);

    await rootCommand();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('/project/root');
  });
});