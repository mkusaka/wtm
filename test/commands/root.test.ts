import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rootCommand } from '../../src/commands/root.js';
import { GitWorktreeManager } from '../../src/utils/git.js';

vi.mock('../../src/utils/git.js');

describe('rootCommand', () => {
  let mockGitManager: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      revParse: vi.fn().mockResolvedValue('/project/root/.git')
    };

    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should exit when not in a git repository', async () => {
    mockGitManager.isGitRepository.mockResolvedValue(false);
    
    await expect(rootCommand()).rejects.toThrow('process.exit');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: This command must be run inside a Git repository');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should output repository root path', async () => {
    mockGitManager.revParse.mockResolvedValue('/project/root/.git');

    await rootCommand();

    expect(mockGitManager.revParse).toHaveBeenCalledWith(['--git-common-dir']);
    expect(consoleLogSpy).toHaveBeenCalledWith('/project/root');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('should output repository root path when in a worktree', async () => {
    mockGitManager.revParse.mockResolvedValue('/project/root/.git/worktrees/feature');

    await rootCommand();

    expect(mockGitManager.revParse).toHaveBeenCalledWith(['--git-common-dir']);
    expect(consoleLogSpy).toHaveBeenCalledWith('/project/root/.git/worktrees');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('should handle errors gracefully', async () => {
    mockGitManager.revParse.mockRejectedValue(new Error('Git error'));
    
    await expect(rootCommand()).rejects.toThrow('process.exit');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Git error');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle nested .git directory correctly', async () => {
    mockGitManager.revParse.mockResolvedValue('/project/root/.git/worktrees/feature');

    await rootCommand();

    expect(consoleLogSpy).toHaveBeenCalledWith('/project/root/.git/worktrees');
  });
});