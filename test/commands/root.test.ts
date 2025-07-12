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

describe('rootCommand', () => {
  let mockGitManager: any;
  let consoleLogSpy: any;
  let processExitSpy: any;
  let processCwdSpy: any;

  beforeEach(() => {
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      getProjectRoot: vi.fn().mockResolvedValue('/project/root'),
      listWorktrees: vi.fn().mockResolvedValue([])
    };

    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    processCwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/project/root');
    // Default: no .wt_env file
    vi.mocked(fs.readFile).mockRejectedValue(new Error('No .wt_env file'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should exit when not in a git repository', async () => {
    mockGitManager.isGitRepository.mockResolvedValue(false);
    
    await expect(rootCommand()).rejects.toThrow('process.exit');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should output current path when in main repo (default)', async () => {
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' }
    ]);

    await rootCommand();

    expect(consoleLogSpy).toHaveBeenCalledWith('/project/root');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('should output main repository path when in a worktree (default)', async () => {
    processCwdSpy.mockReturnValue('/project/root/.git/tmp_worktrees/20250712_103426_feature');
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' },
      { path: '/project/root/.git/tmp_worktrees/20250712_103426_feature', head: 'def456', branch: 'feature' }
    ]);

    await rootCommand();

    expect(consoleLogSpy).toHaveBeenCalledWith('/project/root');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('should display main repository info with verbose flag when in main repo', async () => {
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' }
    ]);

    await rootCommand({ verbose: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n${chalk.bold('Project root:')} ${chalk.green('/project/root')}`
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `${chalk.bold('Main repository:')} ${chalk.green('/project/root')}`
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      chalk.gray('\nYou are currently in the main repository')
    );
  });

  it('should display worktree info with verbose flag when in a worktree', async () => {
    processCwdSpy.mockReturnValue('/project/root/.git/tmp_worktrees/20250712_103426_feature');
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' },
      { path: '/project/root/.git/tmp_worktrees/20250712_103426_feature', head: 'def456', branch: 'feature' }
    ]);

    await rootCommand({ verbose: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `${chalk.bold('Current worktree:')} ${chalk.cyan('/project/root/.git/tmp_worktrees/20250712_103426_feature')}`
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `${chalk.bold('Branch:')} ${chalk.cyan('feature')}`
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `  ${chalk.cyan('cd "$(wtm root)"')}`
    );
  });

  it('should output JSON format when requested', async () => {
    processCwdSpy.mockReturnValue('/project/root/.git/tmp_worktrees/20250712_103426_feature');
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' },
      { path: '/project/root/.git/tmp_worktrees/20250712_103426_feature', head: 'def456', branch: 'feature' }
    ]);

    await rootCommand({ json: true });

    const jsonCall = consoleLogSpy.mock.calls[0][0];
    const output = JSON.parse(jsonCall);

    expect(output).toEqual({
      projectRoot: '/project/root',
      mainRepository: '/project/root',
      currentPath: '/project/root/.git/tmp_worktrees/20250712_103426_feature',
      currentWorktree: '/project/root/.git/tmp_worktrees/20250712_103426_feature',
      isInWorktree: true
    });
  });

  it('should output JSON format when in main repository', async () => {
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' }
    ]);

    await rootCommand({ json: true });

    const jsonCall = consoleLogSpy.mock.calls[0][0];
    const output = JSON.parse(jsonCall);

    expect(output).toEqual({
      projectRoot: '/project/root',
      mainRepository: '/project/root',
      currentPath: '/project/root',
      currentWorktree: '/project/root',
      isInWorktree: false
    });
  });

  it('should handle no current worktree in JSON output', async () => {
    processCwdSpy.mockReturnValue('/some/other/path');
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' }
    ]);

    await rootCommand({ json: true });

    const jsonCall = consoleLogSpy.mock.calls[0][0];
    const output = JSON.parse(jsonCall);

    expect(output).toEqual({
      projectRoot: '/project/root',
      mainRepository: '/project/root',
      currentPath: '/some/other/path',
      currentWorktree: null,
      isInWorktree: false
    });
  });

  it('should handle errors gracefully', async () => {
    mockGitManager.getProjectRoot.mockRejectedValue(new Error('Git error'));
    
    await expect(rootCommand()).rejects.toThrow('process.exit');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display detached worktree correctly with verbose flag', async () => {
    processCwdSpy.mockReturnValue('/project/root/.git/tmp_worktrees/20250712_103426_feature');
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' },
      { path: '/project/root/.git/tmp_worktrees/20250712_103426_feature', head: 'def456', detached: true }
    ]);

    await rootCommand({ verbose: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `${chalk.bold('Branch:')} ${chalk.cyan('(detached)')}`
    );
  });

  it('should handle no main worktree found', async () => {
    processCwdSpy.mockReturnValue('/project/root/.git/tmp_worktrees/20250712_103426_feature');
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root/.git/tmp_worktrees/20250712_103426_feature', head: 'def456', branch: 'feature' }
    ]);

    await rootCommand();

    expect(consoleLogSpy).toHaveBeenCalledWith('/project/root');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });


  it('should read root path from .wt_env file when available with verbose', async () => {
    processCwdSpy.mockReturnValue('/project/root/.git/tmp_worktrees/20250712_103426_feature');
    
    // Mock .wt_env file with root directory
    vi.mocked(fs.readFile).mockResolvedValue(
      '# Worktree metadata\nWT_ROOT_DIR="/custom/root/path"\nWT_BRANCH_NAME="feature"\n'
    );
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root', head: 'abc123', branch: 'main' },
      { path: '/project/root/.git/tmp_worktrees/20250712_103426_feature', head: 'def456', branch: 'feature' }
    ]);

    await rootCommand({ verbose: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `${chalk.bold('Main repository:')} ${chalk.green('/custom/root/path')}`
    );
  });

  it('should output path from .wt_env file (default)', async () => {
    processCwdSpy.mockReturnValue('/project/root/.git/tmp_worktrees/20250712_103426_feature');
    
    // Mock .wt_env file with root directory
    vi.mocked(fs.readFile).mockResolvedValue(
      '# Worktree metadata\nWT_ROOT_DIR="/custom/root/path"\nWT_BRANCH_NAME="feature"\n'
    );
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root/.git/tmp_worktrees/20250712_103426_feature', head: 'def456', branch: 'feature' }
    ]);

    await rootCommand();

    expect(consoleLogSpy).toHaveBeenCalledWith('/custom/root/path');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('should handle JSON output with .wt_env file', async () => {
    processCwdSpy.mockReturnValue('/project/root/.git/tmp_worktrees/20250712_103426_feature');
    
    // Mock .wt_env file with root directory
    vi.mocked(fs.readFile).mockResolvedValue(
      'WT_ROOT_DIR="/custom/root/path"\n'
    );
    
    mockGitManager.listWorktrees.mockResolvedValue([
      { path: '/project/root/.git/tmp_worktrees/20250712_103426_feature', head: 'def456', branch: 'feature' }
    ]);

    await rootCommand({ json: true });

    const jsonCall = consoleLogSpy.mock.calls[0][0];
    const output = JSON.parse(jsonCall);

    expect(output).toEqual({
      projectRoot: '/project/root',
      mainRepository: '/custom/root/path',
      currentPath: '/project/root/.git/tmp_worktrees/20250712_103426_feature',
      currentWorktree: '/project/root/.git/tmp_worktrees/20250712_103426_feature',
      isInWorktree: true
    });
  });
});