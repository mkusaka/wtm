import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { removeCommand } from '../../src/commands/remove.js';
import { GitWorktreeManager } from '../../src/utils/git.js';
import * as ink from 'ink';

// Mock dependencies
vi.mock('../../src/utils/git.js');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis()
  }))
}));
vi.mock('ink', () => ({
  render: vi.fn(() => ({ unmount: vi.fn() }))
}));
vi.mock('@inkjs/ui', () => ({
  ConfirmInput: vi.fn()
}));

describe('removeCommand', () => {
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
      await removeCommand('feature-1', {});
    } catch (error: any) {
      expect(error.message).toBe('process.exit');
    }

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Not in a git repository')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('shows error when worktree not found', async () => {
    mockGit.listWorktrees.mockResolvedValue([]);

    try {
      await removeCommand('feature-1', {});
    } catch (error: any) {
      expect(error.message).toBe('process.exit');
    }

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('No worktree found for branch: feature-1')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('displays worktree information before removal', async () => {
    await removeCommand('feature-1', { force: true });

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Worktree to remove:')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Branch:')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Path:')
    );
  });

  it('removes worktree when forced', async () => {
    await removeCommand('feature-1', { force: true });

    expect(mockGit.removeWorktree).toHaveBeenCalledWith('feature-1');
    expect(ink.render).not.toHaveBeenCalled();
  });

  it.skip('shows confirmation dialog when not forced', async () => {
    // Mock render to simulate user confirmation
    const mockUnmount = vi.fn();
    (ink.render as Mock).mockReturnValue({ unmount: mockUnmount });

    await removeCommand('feature-1', {});

    expect(ink.render).toHaveBeenCalled();
  });

  it.skip('cancels removal when user declines', async () => {
    // Mock confirmation to return false
    const mockUnmount = vi.fn();
    (ink.render as Mock).mockImplementation((element) => {
      // Simulate user canceling
      const confirmInput = element.props.children[1];
      if (confirmInput && confirmInput.props.onCancel) {
        setTimeout(() => confirmInput.props.onCancel(), 0);
      }
      return { unmount: mockUnmount };
    });

    await removeCommand('feature-1', {});

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Cancelled')
    );
    expect(mockGit.removeWorktree).not.toHaveBeenCalled();
  });

  it('handles removal error', async () => {
    mockGit.removeWorktree.mockRejectedValue(new Error('Removal failed'));

    try {
      await removeCommand('feature-1', { force: true });
    } catch (error: any) {
      expect(error.message).toBe('process.exit');
    }

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Error: Removal failed')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});