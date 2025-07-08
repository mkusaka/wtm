import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { listCommand } from '../../src/commands/list';
import { GitWorktreeManager } from '../../src/utils/git';
import chalk from 'chalk';
import type { ListCommandOptions } from '../../src/types';

vi.mock('../../src/utils/git', () => ({
  GitWorktreeManager: vi.fn()
}));
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn()
  })
}));

describe('listCommand', () => {
  let mockGit: any;
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    mockGit = {
      isGitRepository: vi.fn(),
      listWorktrees: vi.fn(),
      getStatus: vi.fn(),
      getLog: vi.fn()
    };
    (GitWorktreeManager as any).mockImplementation(() => mockGit);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should exit if not in a git repository', async () => {
    mockGit.isGitRepository.mockResolvedValue(false);
    
    await listCommand({} as ListCommandOptions);
    
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should display message when no worktrees found', async () => {
    mockGit.isGitRepository.mockResolvedValue(true);
    mockGit.listWorktrees.mockResolvedValue([]);
    
    await listCommand({} as ListCommandOptions);
    
    expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('No worktrees found'));
  });

  it('should display worktrees in default format', async () => {
    mockGit.isGitRepository.mockResolvedValue(true);
    mockGit.listWorktrees.mockResolvedValue([
      {
        path: '/path/to/worktree',
        head: 'abc123',
        branch: 'feature-branch'
      }
    ]);
    mockGit.getStatus.mockResolvedValue({
      modified: [],
      created: [],
      deleted: [],
      isClean: () => true
    });
    
    await listCommand({} as ListCommandOptions);
    
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('🌳 Git Worktrees:'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('feature-branch'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('/path/to/worktree'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✨ Clean'));
  });

  it('should display worktrees with changes', async () => {
    mockGit.isGitRepository.mockResolvedValue(true);
    mockGit.listWorktrees.mockResolvedValue([
      {
        path: '/path/to/worktree',
        head: 'abc123',
        branch: 'feature-branch'
      }
    ]);
    mockGit.getStatus.mockResolvedValue({
      modified: ['file1.js', 'file2.js'],
      created: ['file3.js'],
      deleted: ['file4.js'],
      isClean: () => false
    });
    
    await listCommand({} as ListCommandOptions);
    
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('2 modified, 1 added, 1 deleted'));
  });

  it('should display detached worktrees', async () => {
    mockGit.isGitRepository.mockResolvedValue(true);
    mockGit.listWorktrees.mockResolvedValue([
      {
        path: '/path/to/worktree',
        head: 'abc123',
        detached: true
      }
    ]);
    mockGit.getStatus.mockResolvedValue({
      modified: [],
      created: [],
      deleted: [],
      isClean: () => true
    });
    
    await listCommand({} as ListCommandOptions);
    
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('(detached)'));
  });

  it('should output JSON format when requested', async () => {
    mockGit.isGitRepository.mockResolvedValue(true);
    mockGit.listWorktrees.mockResolvedValue([
      {
        path: '/path/to/worktree',
        head: 'abc123',
        branch: 'feature-branch'
      }
    ]);
    mockGit.getStatus.mockResolvedValue({
      modified: ['file1.js'],
      created: [],
      deleted: [],
      isClean: () => false
    });
    mockGit.getLog.mockResolvedValue([
      {
        hash: 'abc123',
        message: 'Initial commit',
        date: '2024-01-01'
      }
    ]);
    
    await listCommand({ json: true } as ListCommandOptions);
    
    const jsonCall = consoleLogSpy.mock.calls.find((call: any[]) => 
      call[0].includes('"path"') && call[0].includes('"status"')
    );
    expect(jsonCall).toBeDefined();
    
    const json = JSON.parse(jsonCall[0]);
    expect(json[0]).toMatchObject({
      path: '/path/to/worktree',
      branch: 'feature-branch',
      status: {
        modified: 1,
        created: 0,
        deleted: 0,
        isClean: false
      },
      recentCommits: [
        {
          hash: 'abc123',
          message: 'Initial commit',
          date: '2024-01-01'
        }
      ]
    });
  });

  it('should handle errors when getting status', async () => {
    mockGit.isGitRepository.mockResolvedValue(true);
    mockGit.listWorktrees.mockResolvedValue([
      {
        path: '/path/to/worktree',
        head: 'abc123',
        branch: 'feature-branch'
      }
    ]);
    mockGit.getStatus.mockRejectedValue(new Error('Permission denied'));
    
    await listCommand({} as ListCommandOptions);
    
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Permission denied'));
  });
});