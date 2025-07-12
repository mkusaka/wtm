import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addCommand } from '../../src/commands/add';
import { GitWorktreeManager } from '../../src/utils/git';
import { HookManager } from '../../src/utils/hook';
import { InteractiveBranchSelector } from '../../src/components/InteractiveBranchSelector';
import { render } from 'ink';
import React from 'react';

vi.mock('../../src/utils/git');
vi.mock('../../src/utils/hook');
vi.mock('ink');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis()
  }))
}));
vi.mock('chalk', () => ({
  default: {
    red: (str: string) => str,
    green: (str: string) => str,
    cyan: (str: string) => str,
    bold: (str: string) => str
  }
}));

describe('addCommand', () => {
  let mockGit: any;
  let mockHook: any;
  let mockExit: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    mockGit = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      addWorktree: vi.fn().mockResolvedValue('/test/worktree'),
      getProjectRoot: vi.fn().mockResolvedValue('/test/project'),
      listBranches: vi.fn().mockResolvedValue(['main', 'develop', 'feature/test'])
    };
    
    mockHook = {
      exists: vi.fn().mockResolvedValue(false),
      execute: vi.fn()
    };

    (GitWorktreeManager as any).mockImplementation(() => mockGit);
    (HookManager as any).mockImplementation(() => mockHook);
    
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockExit.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('with -b option and branch name', () => {
    it('should create worktree with specified branch name', async () => {
      await addCommand({ branch: 'feature/new' });
      
      expect(mockGit.addWorktree).toHaveBeenCalledWith('feature/new', 'HEAD');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('feature/new'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('HEAD'));
    });

    it('should handle hook execution when hook exists', async () => {
      mockHook.exists.mockResolvedValue(true);
      mockHook.execute.mockResolvedValue(true);
      
      await addCommand({ branch: 'feature/new' });
      
      expect(mockHook.execute).toHaveBeenCalledWith('/test/worktree', 'feature/new');
    });

    it('should handle hook failure gracefully', async () => {
      mockHook.exists.mockResolvedValue(true);
      mockHook.execute.mockRejectedValue(new Error('Hook failed'));
      
      await addCommand({ branch: 'feature/new' });
      
      expect(mockHook.execute).toHaveBeenCalled();
      // Should not throw, just log the error
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Next steps'));
    });
  });

  describe('with --from option', () => {
    it('should create worktree from specified base branch', async () => {
      await addCommand({ branch: 'feature/new', from: 'develop' });
      
      expect(mockGit.addWorktree).toHaveBeenCalledWith('feature/new', 'develop');
    });
  });

  describe('without -b option (interactive mode)', () => {
    it('should show interactive branch selector', async () => {
      const mockUnmount = vi.fn();
      let capturedComponent: any;
      
      (render as any).mockImplementation((component: any) => {
        capturedComponent = component;
        return { unmount: mockUnmount };
      });

      // Start the command but don't await it yet
      const commandPromise = addCommand({});
      
      // Wait a bit for the render to be called
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify render was called with InteractiveBranchSelector
      expect(render).toHaveBeenCalled();
      expect(capturedComponent.type).toBe(InteractiveBranchSelector);
      expect(capturedComponent.props.branches).toEqual(['main', 'develop', 'feature/test']);
      
      // Simulate branch selection
      capturedComponent.props.onSelect('develop');
      
      // Now await the command
      await commandPromise;
      
      expect(mockUnmount).toHaveBeenCalled();
      expect(mockGit.addWorktree).toHaveBeenCalledWith('develop', 'HEAD');
    });

    it('should handle exit from interactive mode', async () => {
      const mockUnmount = vi.fn();
      let capturedComponent: any;
      
      (render as any).mockImplementation((component: any) => {
        capturedComponent = component;
        return { unmount: mockUnmount };
      });

      // Start the command
      const commandPromise = addCommand({ branch: true });
      
      // Wait a bit for the render to be called
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Simulate exit
      try {
        capturedComponent.props.onExit();
      } catch (e: any) {
        expect(e.message).toBe('process.exit');
      }
      
      expect(mockUnmount).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle empty branch list', async () => {
      mockGit.listBranches.mockResolvedValue([]);
      
      try {
        await addCommand({});
      } catch (e: any) {
        expect(e.message).toBe('process.exit');
      }
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('No branches found');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('with --path-only option', () => {
    it('should output only the worktree path', async () => {
      await addCommand({ branch: 'feature/new', pathOnly: true });
      
      expect(mockGit.addWorktree).toHaveBeenCalledWith('feature/new', 'HEAD');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('/test/worktree');
      
      // Should not output any other messages
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Branch:'));
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Next steps'));
    });

    it('should still run hooks silently', async () => {
      mockHook.exists.mockResolvedValue(true);
      mockHook.execute.mockResolvedValue(true);
      
      await addCommand({ branch: 'feature/new', pathOnly: true });
      
      expect(mockHook.execute).toHaveBeenCalledWith('/test/worktree', 'feature/new');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('/test/worktree');
    });

    it('should output errors to stderr in path-only mode', async () => {
      mockGit.addWorktree.mockRejectedValue(new Error('Failed to create worktree'));
      
      try {
        await addCommand({ branch: 'feature/new', pathOnly: true });
      } catch (e: any) {
        expect(e.message).toBe('process.exit');
      }
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create worktree');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('error handling', () => {
    it('should exit if not in a git repository', async () => {
      mockGit.isGitRepository.mockResolvedValue(false);
      
      try {
        await addCommand({ branch: 'feature/new' });
      } catch (e: any) {
        expect(e.message).toBe('process.exit');
      }
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Not in a git repository');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle errors during worktree creation', async () => {
      mockGit.addWorktree.mockRejectedValue(new Error('Failed to create worktree'));
      
      try {
        await addCommand({ branch: 'feature/new' });
      } catch (e: any) {
        expect(e.message).toBe('process.exit');
      }
      
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});