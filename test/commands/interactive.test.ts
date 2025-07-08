import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { interactiveCommand } from '../../src/commands/interactive.js';
import { GitWorktreeManager } from '../../src/utils/git.js';
import * as ink from 'ink';
import React from 'react';

// Mock dependencies
vi.mock('../../src/utils/git.js');
vi.mock('ink', () => ({
  render: vi.fn()
}));
vi.mock('react', () => ({
  default: {
    createElement: vi.fn()
  }
}));

describe('interactiveCommand', () => {
  let mockGit: any;
  let mockConsoleError: Mock;
  let mockConsoleLog: Mock;
  let mockExit: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGit = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue([
        { path: '/path/to/worktree1', head: 'abc123', branch: 'feature-1' },
        { path: '/path/to/worktree2', head: 'def456', branch: 'feature-2' }
      ]),
      removeWorktree: vi.fn().mockResolvedValue(undefined)
    };
    
    (GitWorktreeManager as unknown as Mock).mockImplementation(() => mockGit);
    
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  it('shows error when not in git repository', async () => {
    mockGit.isGitRepository.mockResolvedValue(false);

    try {
      await interactiveCommand();
    } catch (error: any) {
      expect(error.message).toBe('process.exit');
    }

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Not in a git repository')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('shows message when no worktrees found', async () => {
    mockGit.listWorktrees.mockResolvedValue([]);

    await interactiveCommand();

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('No worktrees found')
    );
    expect(ink.render).not.toHaveBeenCalled();
  });

  it('renders WorktreeSelector when worktrees exist', async () => {
    const mockWorktrees = [
      { path: '/path/to/worktree1', head: 'abc123', branch: 'feature-1' }
    ];
    mockGit.listWorktrees.mockResolvedValue(mockWorktrees);

    await interactiveCommand();

    expect(ink.render).toHaveBeenCalled();
    expect(React.createElement).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        worktrees: mockWorktrees,
        onSelect: expect.any(Function),
        onDelete: expect.any(Function),
        onExit: expect.any(Function)
      })
    );
  });

  it('handles worktree selection', async () => {
    const mockWorktrees = [
      { path: '/path/to/worktree1', head: 'abc123', branch: 'feature-1' }
    ];
    mockGit.listWorktrees.mockResolvedValue(mockWorktrees);

    await interactiveCommand();

    // Get the onSelect handler
    const createElementCall = (React.createElement as Mock).mock.calls[0];
    const props = createElementCall[1];
    const onSelect = props.onSelect;

    // Call onSelect
    try {
      onSelect(mockWorktrees[0]);
    } catch (error: any) {
      expect(error.message).toBe('process.exit');
    }

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('To change to this worktree, run:')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('cd /path/to/worktree1')
    );
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('handles worktree deletion success', async () => {
    const mockWorktrees = [
      { path: '/path/to/worktree1', head: 'abc123', branch: 'feature-1' }
    ];
    mockGit.listWorktrees.mockResolvedValue(mockWorktrees);

    await interactiveCommand();

    // Get the onDelete handler
    const createElementCall = (React.createElement as Mock).mock.calls[0];
    const props = createElementCall[1];
    const onDelete = props.onDelete;

    // Call onDelete
    try {
      await onDelete(mockWorktrees[0]);
    } catch (error: any) {
      expect(error.message).toBe('process.exit');
    }

    expect(mockGit.removeWorktree).toHaveBeenCalledWith('feature-1');
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Removed worktree and branch: feature-1')
    );
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('handles worktree deletion failure', async () => {
    const mockWorktrees = [
      { path: '/path/to/worktree1', head: 'abc123', branch: 'feature-1' }
    ];
    mockGit.listWorktrees.mockResolvedValue(mockWorktrees);
    mockGit.removeWorktree.mockRejectedValue(new Error('Failed to remove'));

    await interactiveCommand();

    // Get the onDelete handler
    const createElementCall = (React.createElement as Mock).mock.calls[0];
    const props = createElementCall[1];
    const onDelete = props.onDelete;

    // Call onDelete
    try {
      await onDelete(mockWorktrees[0]);
    } catch (error: any) {
      expect(error.message).toBe('process.exit');
    }

    expect(mockGit.removeWorktree).toHaveBeenCalledWith('feature-1');
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Error: Failed to remove')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('skips deletion for detached worktrees', async () => {
    const mockWorktrees = [
      { path: '/path/to/worktree1', head: 'abc123', detached: true }
    ];
    mockGit.listWorktrees.mockResolvedValue(mockWorktrees);

    await interactiveCommand();

    // Get the onDelete handler
    const createElementCall = (React.createElement as Mock).mock.calls[0];
    const props = createElementCall[1];
    const onDelete = props.onDelete;

    // Call onDelete with detached worktree
    await onDelete(mockWorktrees[0]);

    expect(mockGit.removeWorktree).not.toHaveBeenCalled();
  });

  it('handles exit', async () => {
    const mockWorktrees = [
      { path: '/path/to/worktree1', head: 'abc123', branch: 'feature-1' }
    ];
    mockGit.listWorktrees.mockResolvedValue(mockWorktrees);

    await interactiveCommand();

    // Get the onExit handler
    const createElementCall = (React.createElement as Mock).mock.calls[0];
    const props = createElementCall[1];
    const onExit = props.onExit;

    // Call onExit
    try {
      onExit();
    } catch (error: any) {
      expect(error.message).toBe('process.exit');
    }

    expect(mockExit).toHaveBeenCalledWith(0);
  });
});