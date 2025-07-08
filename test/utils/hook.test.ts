import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HookManager } from '../../src/utils/hook';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

vi.mock('child_process');
vi.mock('fs/promises');

describe('HookManager', () => {
  let hookManager: HookManager;
  const projectRoot = '/test/project';

  beforeEach(() => {
    hookManager = new HookManager(projectRoot);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exists', () => {
    it('should return true if hook file exists', async () => {
      (fs.access as any).mockResolvedValue();
      const result = await hookManager.exists();
      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(path.join(projectRoot, '.wt_hook.js'));
    });

    it('should return false if hook file does not exist', async () => {
      (fs.access as any).mockRejectedValue(new Error('ENOENT'));
      const result = await hookManager.exists();
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute hook with correct environment variables', async () => {
      (fs.access as any).mockResolvedValue();
      
      const mockChild = {
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(0), 10);
          }
        })
      };
      (spawn as any).mockReturnValue(mockChild);
      
      const result = await hookManager.execute('/test/worktree', 'feature-branch');
      
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith('node', [hookManager.hookPath], {
        cwd: '/test/worktree',
        env: expect.objectContaining({
          WT_WORKTREE_PATH: '/test/worktree',
          WT_BRANCH_NAME: 'feature-branch',
          WT_PROJECT_ROOT: projectRoot
        }),
        stdio: 'inherit'
      });
    });

    it('should return false if hook does not exist', async () => {
      (fs.access as any).mockRejectedValue(new Error('ENOENT'));
      const result = await hookManager.execute('/test/worktree', 'feature-branch');
      expect(result).toBe(false);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should reject if hook exits with non-zero code', async () => {
      (fs.access as any).mockResolvedValue();
      
      const mockChild = {
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(1), 10);
          }
        })
      };
      (spawn as any).mockReturnValue(mockChild);
      
      await expect(hookManager.execute('/test/worktree', 'feature-branch'))
        .rejects.toThrow('Hook exited with code 1');
    });

    it('should reject if hook process errors', async () => {
      (fs.access as any).mockResolvedValue();
      
      const mockChild = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('spawn error')), 10);
          }
        })
      };
      (spawn as any).mockReturnValue(mockChild);
      
      await expect(hookManager.execute('/test/worktree', 'feature-branch'))
        .rejects.toThrow('spawn error');
    });
  });

  describe('create', () => {
    it('should create hook file with correct content and permissions', async () => {
      (fs.writeFile as any).mockResolvedValue();
      (fs.chmod as any).mockResolvedValue();
      
      await hookManager.create();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        hookManager.hookPath,
        expect.stringContaining('#!/usr/bin/env node')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        hookManager.hookPath,
        expect.stringContaining('WT_WORKTREE_PATH')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        hookManager.hookPath,
        expect.stringContaining('WT_BRANCH_NAME')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        hookManager.hookPath,
        expect.stringContaining('WT_PROJECT_ROOT')
      );
      expect(fs.chmod).toHaveBeenCalledWith(hookManager.hookPath, 0o755);
    });
  });
});