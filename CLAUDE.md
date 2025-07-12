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
pnpm test:coverage     # Run tests with coverage reports (HTML, JSON, text)

# Type checking
pnpm typecheck

# Linting and formatting
pnpm lint              # Linting with oxc-lint
pnpm format            # Format code with Prettier

# Development workflow
pnpm build && node dist/src/bin/wtm.js <command>  # Test CLI locally

# Watch mode for development
pnpm start  # Run tsx watch mode for rapid development
```

## Important Requirements

- **Node.js Version**: >=18.0.0 (required for ES modules support)
- **Package Manager**: pnpm (preferred for workspace support)
- **Module System**: ES modules (`"type": "module"`) - all imports must use `.js` extensions

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
   - Default action: `wtm` with no arguments launches interactive mode

3. **Git Operations** (`src/utils/git.ts`)
   - `GitWorktreeManager` class wraps simple-git library
   - Worktrees are created in `.git/tmp_worktrees/YYYYMMDD_HHMMSS_<branch>`
   - Branch names are normalized (removes `refs/heads/` prefix)

4. **Hook System** (`src/utils/hook.ts`)
   - Generates `.wt_hook.js` files that run after worktree creation
   - Executes with Node.js spawn, chmod 755, stdio inherited for real-time output
   - Environment variables: `WT_WORKTREE_PATH`, `WT_BRANCH_NAME`, `WT_PROJECT_ROOT`
   - Default hook copies `.env`, `.env.local`, and `.claude` files
   - Hook files are git-ignored (included in `.gitignore`)
   - Exit codes: 0 = success, non-zero = failure with proper error reporting
   - **Library Support**: Hooks can use libraries installed in the parent project (e.g., `zx`, `glob`)
     - The parent project's `node_modules` is automatically added to `NODE_PATH`
     - Simply import and use: `import { $ } from 'zx'` or `import { glob } from 'glob'`

5. **Interactive UI Components** (`src/components/`)
   - `InteractiveWorktreeSelector.tsx`: Main TUI component using ink (React for CLIs)
   - Real-time filtering with `ink-select-input` for better highlight tracking
   - Preview pane shows selected worktree details (commit history, branch status)
   - Keyboard controls: 
     - Filter: Type to filter worktrees
     - Navigation: ↑↓ or j/k
     - Selection: Enter
     - Deletion: Ctrl-D
     - Exit: Ctrl-C or Esc

### Command Flow Architecture

1. **List Command Flow**: 
   - CLI → `list.ts` → `GitWorktreeManager.listWorktrees()` → Interactive UI (default) or plain output
   - Interactive mode launches `InteractiveWorktreeSelector` component

2. **Add Command Flow**:
   - CLI → `add.ts` → `GitWorktreeManager.addWorktree()` → Hook execution → Success/error reporting
   - Creates worktree in timestamp directory, normalizes branch names, executes hook

3. **Remove Command Flow**:
   - CLI → `remove.ts` → `GitWorktreeManager.removeWorktree()` → Cleanup and reporting
   - Can be triggered from interactive UI or CLI directly

### Key Implementation Details

- **TypeScript Configuration**: Strict mode, ES modules, targets ES2022, Node16 module resolution
- **Testing**: Vitest with mocked Git operations and file system, tests in separate `test/` directory
- **Linting**: oxc-lint configured with TypeScript support
- **Build Output**: TypeScript compiles to `dist/` directory, preserving source structure
- **UI Framework**: ink (React for CLIs) with @inkjs/ui components and ink-select-input
- **Interactive Mode**: Default behavior, can be disabled with `--no-interactive` flag
- **Version Management**: Dynamically reads version from package.json at runtime

### Publishing Workflow

The package is published to npm as `@mkusaka/wtm`:

1. `npm version patch/minor/major` - Updates version and creates git tag
2. `npm publish` - Triggers prepublishOnly script (build, test, lint)
3. `git push origin main --follow-tags` - Push commits and tags

The `prepublishOnly` script ensures the package is always built and tested before publishing.

### CI/CD Workflows

The project uses GitHub Actions for continuous integration and deployment:

1. **CI Workflow** (`.github/workflows/ci.yml`)
   - Runs on push to main and pull requests
   - Tests against Node.js 18.x, 20.x, and 22.x
   - Executes: type check, lint, tests, and build
   - Verifies build output is executable

2. **Release Workflow** (`.github/workflows/release.yml`)
   - Triggered by version tags (v*)
   - Publishes to npm registry
   - Creates GitHub releases with build artifacts
   - Requires `NPM_TOKEN` secret for authentication

3. **Dependency Management** (`.github/dependabot.yml`)
   - Weekly updates for npm packages and GitHub Actions
   - Groups development and production dependencies

## Important Patterns

- All async operations use async/await (no callbacks)
- CLI output uses chalk for colors and ora for progress spinners
- Commands should provide clear feedback for both success and error cases
- Type imports use `import type` syntax to avoid runtime overhead
- Test files mirror source structure and use `.test.ts` extension in separate `test/` directory
- Interactive components use ink (React for CLIs) with hooks and functional components
- Interactive mode is the default - explicit `--no-interactive` flag to disable
- Component testing is challenging due to ink's nature - focus on integration tests
- ES module imports must use `.js` extensions even for TypeScript files
- Dynamic imports use `import.meta.url` instead of `__dirname`