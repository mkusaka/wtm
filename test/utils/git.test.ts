import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitWorktreeManager } from '../../src/utils/git';
import { simpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';

vi.mock('simple-git');
vi.mock('fs/promises');

describe('GitWorktreeManager', () => {
  let gitManager: GitWorktreeManager;
  let mockGit: any;

  beforeEach(() => {
    mockGit = {
      revparse: vi.fn(),
      raw: vi.fn(),
      deleteLocalBranch: vi.fn(),
      status: vi.fn(),
      log: vi.fn()
    };
    (simpleGit as any).mockReturnValue(mockGit);
    gitManager = new GitWorktreeManager('/test/path');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isGitRepository', () => {
    it('should return true if in a git repository', async () => {
      mockGit.revparse.mockResolvedValue('.git');
      const result = await gitManager.isGitRepository();
      expect(result).toBe(true);
      expect(mockGit.revparse).toHaveBeenCalledWith(['--git-dir']);
    });

    it('should return false if not in a git repository', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Not a git repository'));
      const result = await gitManager.isGitRepository();
      expect(result).toBe(false);
    });
  });

  describe('getGitDir', () => {
    it('should return the absolute path to git directory', async () => {
      mockGit.revparse.mockResolvedValue('.git\n');
      const result = await gitManager.getGitDir();
      expect(result).toBe(path.resolve('/test/path', '.git'));
    });
  });

  describe('listWorktrees', () => {
    it('should parse worktree list correctly', async () => {
      const mockOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature

worktree /path/to/detached
HEAD ghi789
detached
`;
      mockGit.raw.mockResolvedValue(mockOutput);
      
      const result = await gitManager.listWorktrees();
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        path: '/path/to/main',
        head: 'abc123',
        branch: 'main'
      });
      expect(result[1]).toEqual({
        path: '/path/to/feature',
        head: 'def456',
        branch: 'feature'
      });
      expect(result[2]).toEqual({
        path: '/path/to/detached',
        head: 'ghi789',
        detached: true
      });
    });

    it('should handle empty worktree list', async () => {
      mockGit.raw.mockResolvedValue('');
      const result = await gitManager.listWorktrees();
      expect(result).toEqual([]);
    });
  });

  describe('addWorktree', () => {
    it('should create a new worktree with timestamp', async () => {
      const mockDate = new Date('2024-01-15T10:30:45.123Z');
      vi.setSystemTime(mockDate);
      
      mockGit.revparse.mockResolvedValue('.git\n');
      fs.mkdir.mockResolvedValue();
      mockGit.raw.mockResolvedValue();
      
      const result = await gitManager.addWorktree('feature-branch');
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.resolve('/test/path', '.git/tmp_worktrees'),
        { recursive: true }
      );
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'feature-branch',
        path.resolve('/test/path', '.git/tmp_worktrees/20240115_103045_feature-branch'),
        'HEAD'
      ]);
      expect(result).toBe(path.resolve('/test/path', '.git/tmp_worktrees/20240115_103045_feature-branch'));
      
      vi.useRealTimers();
    });

    it('should use custom base branch when provided', async () => {
      mockGit.revparse.mockResolvedValue('.git\n');
      fs.mkdir.mockResolvedValue();
      mockGit.raw.mockResolvedValue();
      
      await gitManager.addWorktree('feature-branch', 'develop');
      
      expect(mockGit.raw).toHaveBeenCalledWith(
        expect.arrayContaining(['worktree', 'add', '-b', 'feature-branch', expect.any(String), 'develop'])
      );
    });
  });

  describe('removeWorktree', () => {
    it('should remove worktree and delete branch', async () => {
      // First call for listWorktrees
      mockGit.raw.mockResolvedValueOnce(`worktree /path/to/feature
HEAD def456
branch refs/heads/feature
`);
      // Second call for remove
      mockGit.raw.mockResolvedValueOnce();
      mockGit.deleteLocalBranch.mockResolvedValue();
      
      await gitManager.removeWorktree('feature');
      
      expect(mockGit.raw).toHaveBeenNthCalledWith(1, ['worktree', 'list', '--porcelain']);
      expect(mockGit.raw).toHaveBeenNthCalledWith(2, ['worktree', 'remove', '--force', '/path/to/feature']);
      expect(mockGit.deleteLocalBranch).toHaveBeenCalledWith('feature', true);
    });

    it('should throw error if worktree not found', async () => {
      mockGit.raw.mockResolvedValue('');
      
      await expect(gitManager.removeWorktree('nonexistent')).rejects.toThrow(
        'No worktree found for branch: nonexistent'
      );
    });

    it('should continue if branch deletion fails', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // First call for listWorktrees
      mockGit.raw.mockResolvedValueOnce(`worktree /path/to/feature
HEAD def456
branch refs/heads/feature
`);
      // Second call for remove
      mockGit.raw.mockResolvedValueOnce();
      mockGit.deleteLocalBranch.mockRejectedValue(new Error('Branch not found'));
      
      await gitManager.removeWorktree('feature');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: Could not delete branch feature: Branch not found'
      );
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getStatus', () => {
    it('should get status from worktree path', async () => {
      const mockStatus = {
        modified: ['file1.js'],
        created: ['file2.js'],
        deleted: [],
        isClean: () => false
      };
      
      const mockWorktreeGit = {
        status: vi.fn().mockResolvedValue(mockStatus)
      };
      (simpleGit as any).mockImplementation((path: string) => {
        if (path === '/path/to/worktree') {
          return mockWorktreeGit;
        }
        return mockGit;
      });
      
      const result = await gitManager.getStatus('/path/to/worktree');
      
      expect(result).toBe(mockStatus);
      expect(simpleGit).toHaveBeenCalledWith('/path/to/worktree');
    });
  });

  describe('getLog', () => {
    it('should get log from worktree path', async () => {
      const mockLogs = [
        { hash: 'abc123', message: 'Initial commit', date: '2024-01-01' },
        { hash: 'def456', message: 'Add feature', date: '2024-01-02' }
      ];
      
      const mockWorktreeGit = {
        log: vi.fn().mockResolvedValue({ all: mockLogs })
      };
      (simpleGit as any).mockImplementation((path: string) => {
        if (path === '/path/to/worktree') {
          return mockWorktreeGit;
        }
        return mockGit;
      });
      
      const result = await gitManager.getLog('/path/to/worktree', 5);
      
      expect(result).toEqual(mockLogs);
      expect(mockWorktreeGit.log).toHaveBeenCalledWith(['-n', '5']);
    });
  });

  describe('getProjectRoot', () => {
    it('should return the project root directory', async () => {
      mockGit.revparse.mockResolvedValue('/path/to/project\n');
      const result = await gitManager.getProjectRoot();
      expect(result).toBe('/path/to/project');
      expect(mockGit.revparse).toHaveBeenCalledWith(['--show-toplevel']);
    });
  });
});