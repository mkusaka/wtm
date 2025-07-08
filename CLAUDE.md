# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Git worktree management CLI tool (`wtm`) written in TypeScript. It simplifies creating, organizing, and maintaining Git worktrees with automatic timestamp-based directory organization and a customizable hook system.

## Development Commands

```bash
# Install dependencies (use pnpm)
pnpm install

# Build TypeScript to JavaScript
pnpm build

# Run tests
pnpm test              # Run all tests in CI mode
pnpm test -- <pattern> # Run specific test files

# Type checking
pnpm typecheck

# Linting (uses oxc-lint for fast performance)
pnpm lint

# Development workflow
pnpm build && node dist/src/bin/wtm.js <command>  # Test CLI locally
```

## Architecture

### Core Components

1. **CLI Entry Point** (`src/bin/wtm.ts`)
   - Shebang executable that imports and runs the main program
   - Must have execute permissions (handled by postbuild script)

2. **Command Structure** (`src/commands/`)
   - Each command is a separate module exporting an async function
   - Commands receive typed options from Commander.js
   - All commands check for Git repository before proceeding
   - Exit with `process.exit(1)` on errors

3. **Git Operations** (`src/utils/git.ts`)
   - `GitWorktreeManager` class wraps simple-git library
   - Worktrees are created in `.git/tmp_worktrees/YYYYMMDD_HHMMSS_<branch>`
   - Branch names are normalized (removes `refs/heads/` prefix)

4. **Hook System** (`src/utils/hook.ts`)
   - Generates `.wt_hook.js` files that run after worktree creation
   - Executes with environment variables: `WT_WORKTREE_PATH`, `WT_BRANCH_NAME`, `WT_PROJECT_ROOT`
   - Default hook copies `.env`, `.env.local`, and `.claude` files

### Key Implementation Details

- **TypeScript Configuration**: Strict mode enabled, ES modules, targets ES2022
- **Testing**: Vitest with mocked Git operations and file system
- **Linting**: oxc-lint configured to disable common style rules that conflict with the codebase
- **Build Output**: TypeScript compiles to `dist/` directory, preserving source structure

### Publishing Workflow

The package is published to npm as `@mkusaka/wtm`:

1. `npm version patch/minor/major` - Updates version and creates git tag
2. `npm publish` - Triggers prepublishOnly script (build, test, lint)
3. `git push origin main --follow-tags` - Push commits and tags

The `prepublishOnly` script ensures the package is always built and tested before publishing.

## Important Patterns

- All async operations use async/await (no callbacks)
- CLI output uses chalk for colors and ora for progress spinners
- Commands should provide clear feedback for both success and error cases
- Type imports use `import type` syntax to avoid runtime overhead
- Test files mirror source structure and use `.test.ts` extension