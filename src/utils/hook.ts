import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import type { HookManagerInterface } from '../types/index.js';

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

    // Create NODE_PATH that includes both parent project and worktree node_modules
    const nodePaths = [
      path.join(this.projectRoot, 'node_modules'),
      path.join(worktreePath, 'node_modules')
    ];
    
    // Add existing NODE_PATH if any
    if (process.env.NODE_PATH) {
      nodePaths.push(process.env.NODE_PATH);
    }

    const env = {
      ...process.env,
      WT_WORKTREE_PATH: worktreePath,
      WT_BRANCH_NAME: branchName,
      WT_PROJECT_ROOT: this.projectRoot,
      NODE_PATH: nodePaths.join(path.delimiter)
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
// - NODE_PATH: Includes parent project's node_modules (libraries available)

import fs from 'fs/promises';
import path from 'path';

// Example: Using zx for shell commands (if installed in parent project)
// import { $ } from 'zx';

// Example: Using glob for pattern matching (if installed in parent project)
// import { glob } from 'glob';

// Default items to copy
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
  console.log(\`Worktree: \${process.env.WT_WORKTREE_PATH}\`);
  console.log(\`Branch: \${process.env.WT_BRANCH_NAME}\`);
  
  // Copy configuration files
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

  // Example: Using zx to install dependencies
  // try {
  //   await $\`pnpm install\`;
  //   console.log('Dependencies installed');
  // } catch (error) {
  //   console.error('Failed to install dependencies:', error);
  // }

  // Example: Using glob to copy all config files
  // const configFiles = await glob('config/*.json', { 
  //   cwd: process.env.WT_PROJECT_ROOT 
  // });
  // for (const file of configFiles) {
  //   const source = path.join(process.env.WT_PROJECT_ROOT, file);
  //   const dest = path.join(process.env.WT_WORKTREE_PATH, file);
  //   await fs.mkdir(path.dirname(dest), { recursive: true });
  //   await fs.copyFile(source, dest);
  //   console.log(\`Copied \${file}\`);
  // }
  
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