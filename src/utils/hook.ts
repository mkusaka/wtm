import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import type { HookManagerInterface } from '../types/index';

export class HookManager implements HookManagerInterface {
  projectRoot: string;
  hookPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.hookPath = path.join(projectRoot, '.wt_hook.js');
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.hookPath);
      return true;
    } catch {
      return false;
    }
  }

  async execute(worktreePath: string, branchName: string): Promise<boolean> {
    if (!(await this.exists())) {
      return false;
    }

    const env = {
      ...process.env,
      WT_WORKTREE_PATH: worktreePath,
      WT_BRANCH_NAME: branchName,
      WT_PROJECT_ROOT: this.projectRoot
    };

    return new Promise((resolve, reject) => {
      const child = spawn('node', [this.hookPath], {
        cwd: worktreePath,
        env,
        stdio: 'inherit'
      });

      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`Hook exited with code ${code}`));
        }
      });
    });
  }

  async create(): Promise<void> {
    const template = `#!/usr/bin/env node

// .wt_hook.js - Executed after 'wtm add'
// Available environment variables:
// - WT_WORKTREE_PATH: Path to the new worktree
// - WT_BRANCH_NAME: Name of the new branch
// - WT_PROJECT_ROOT: Path to the main project root

import fs from 'fs/promises';
import path from 'path';

const copyItems = ['.env', '.env.local', '.claude'];

async function copyFile(source, dest) {
  try {
    await fs.copyFile(source, dest);
    console.log(\`Copied \${path.basename(source)}\`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(\`Error copying \${source}: \${error.message}\`);
    }
  }
}

async function copyDirectory(source, dest) {
  try {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
    console.log(\`Copied directory \${path.basename(source)}\`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(\`Error copying directory \${source}: \${error.message}\`);
    }
  }
}

async function main() {
  console.log('Running worktree hook...');
  
  for (const item of copyItems) {
    const sourcePath = path.join(process.env.WT_PROJECT_ROOT, item);
    const destPath = path.join(process.env.WT_WORKTREE_PATH, item);
    
    try {
      const stat = await fs.stat(sourcePath);
      if (stat.isDirectory()) {
        await copyDirectory(sourcePath, destPath);
      } else {
        await copyFile(sourcePath, destPath);
      }
    } catch (error) {
      // Item doesn't exist, skip it
    }
  }
  
  console.log('Hook completed successfully');
}

main().catch(error => {
  console.error('Hook error:', error);
  process.exit(1);
});
`;

    await fs.writeFile(this.hookPath, template);
    await fs.chmod(this.hookPath, 0o755);
  }
}