import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rootCommand } from '../../src/commands/root.js';
import { GitWorktreeManager } from '../../src/utils/git.js';

vi.mock('../../src/utils/git.js');

describe('rootCommand edge cases', () => {
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

  it('should handle bare repository correctly', async () => {
    mockGitManager.revParse.mockResolvedValue('/project/repo.git');

    await rootCommand();

    expect(consoleLogSpy).toHaveBeenCalledWith('/project');
  });

  it('should handle root directory correctly', async () => {
    mockGitManager.revParse.mockResolvedValue('/.git');

    await rootCommand();

    expect(consoleLogSpy).toHaveBeenCalledWith('/');
  });

  it('should handle deeply nested git directory', async () => {
    mockGitManager.revParse.mockResolvedValue('/very/deep/nested/path/.git/worktrees/feature');

    await rootCommand();

    expect(consoleLogSpy).toHaveBeenCalledWith('/very/deep/nested/path/.git/worktrees');
  });

  it('should handle when git common dir is just .git', async () => {
    mockGitManager.revParse.mockResolvedValue('.git');

    await rootCommand();

    expect(consoleLogSpy).toHaveBeenCalledWith('.');
  });
});