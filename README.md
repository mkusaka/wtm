# wtm - Git Worktree Manager

[![CI](https://github.com/mkusaka/wtm/actions/workflows/ci.yml/badge.svg)](https://github.com/mkusaka/wtm/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@mkusaka%2Fwtm.svg)](https://www.npmjs.com/package/@mkusaka/wtm)

A high-performance Git worktree management CLI tool written in TypeScript, designed to simplify the creation, organization, and maintenance of Git worktrees.

## Features

- **Interactive TUI Mode**: Default interactive terminal UI with real-time filtering and preview
- **Organized Worktree Structure**: Creates worktrees with timestamp prefixes in `.git/tmp_worktrees/` for better organization
- **Real-time Filtering**: Type to filter worktrees by branch name or path instantly
- **Preview Pane**: See worktree details (path, branch, commit) while navigating
- **Hook System**: Automate worktree initialization with customizable hooks
- **TypeScript Support**: Fully typed with TypeScript and ES modules for better developer experience
- **Fast Linting**: Uses oxc-lint for blazing-fast code quality checks
- **Rich CLI Output**: Colorful and informative terminal output with progress indicators
- **Status Tracking**: Shows working tree status, modified files, and recent commits
- **JSON Export**: Machine-readable output format for scripting and automation
- **Zero Config**: Works out of the box with sensible defaults
- **Branch Normalization**: Automatically handles `refs/heads/` prefixes

## Installation

### Prerequisites
- Node.js 18.0.0 or higher
- Git 2.0.0 or higher

### Install from npm

```bash
# Using npm
npm install -g @mkusaka/wtm

# Using pnpm
pnpm add -g @mkusaka/wtm

# Using yarn
yarn global add @mkusaka/wtm
```

### Install from source

```bash
# Clone the repository
git clone https://github.com/mkusaka/wtm.git
cd wtm

# Install dependencies
pnpm install

# Build the project
pnpm build

# Link globally (optional)
pnpm link --global
```

## Usage

### Interactive Mode (Default)
```bash
wtm              # Opens interactive TUI for worktree selection (default)
wtm list         # Same as above - interactive mode is default for list command
```

In interactive mode:
- **Type to filter**: Start typing to filter worktrees by branch name or path
- **↑/↓**: Navigate through worktrees
- **Enter**: Open selected worktree in a new shell
- **Ctrl-D**: Delete the selected worktree (with confirmation)
- **Ctrl-C or Esc**: Exit interactive mode

### Non-interactive Mode
```bash
wtm list --no-interactive  # Simple list output
wtm list --json           # JSON format (automatically disables interactive mode)
```

### Create a new worktree
```bash
wtm add                            # Interactive branch selection
wtm add -b feature-branch          # Create worktree for specific branch
wtm add -b                         # Interactive branch selection (same as wtm add)
wtm add --from develop -b feature  # Create 'feature' branch from 'develop'
wtm add -b feature --path-only     # Output only the worktree path (for shell integration)
wtm add -b feature --shell         # Create worktree and launch new shell in it
```

The worktree will be created at `.git/tmp_worktrees/YYYYMMDD_HHMMSS_feature-branch/`

#### Shell Integration Examples
```bash
# Navigate to new worktree immediately
cd "$(wtm add -b feature --path-only)"

# Create alias for quick worktree creation and navigation
alias wta='cd "$(wtm add --path-only -b"'
# Usage: wta feature-branch
```

### Remove a worktree
```bash
wtm remove feature-branch      # Interactive confirmation
wtm remove feature-branch -f   # Force removal without confirmation
```

### Navigate to main repository
```bash
wtm root                       # Output main repository path
wtm root --verbose            # Show detailed worktree information
wtm root --json              # Output in JSON format for programmatic use

# Shell integration - navigate to main repo from any worktree
cd "$(wtm root)"

# Create an alias for quick navigation
alias wh='cd "$(wtm root)"'  # "worktree home"
```

The `root` command helps you quickly navigate back to the main repository from any worktree. It automatically detects the main repository path using `.wt_env` files created in worktrees for faster resolution.

### Initialize hook file
```bash
wtm init  # Creates .wt_hook.js in repository root
```

## Hook System

The hook system allows you to automate worktree setup tasks. After running `wtm init`, a `.wt_hook.js` file is created in your repository root.

### Default Hook Behavior
The default hook copies the following files/directories from the main repository to new worktrees:
- `.env`
- `.env.local`
- `.claude`

These files are commonly used for local configuration and are not typically committed to version control.

### Customizing Hooks
Edit `.wt_hook.js` to customize the initialization process:

```javascript
// Available environment variables:
// - WT_WORKTREE_PATH: Path to the new worktree
// - WT_BRANCH_NAME: Name of the new branch  
// - WT_PROJECT_ROOT: Path to the main project root

// Example: Install dependencies after creating worktree
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  console.log('Installing dependencies...');
  await execAsync('pnpm install', { cwd: process.env.WT_WORKTREE_PATH });
}
```

### Using External Libraries in Hooks
Hooks can use any npm packages installed in your parent project without requiring separate installations:

```javascript
// The parent project's node_modules is automatically available
import { $ } from 'zx';  // If zx is installed in parent project
import { glob } from 'glob';  // If glob is installed in parent project

// Example: Advanced hook using external libraries
console.log(`Setting up worktree at: ${process.env.WT_WORKTREE_PATH}`);
console.log(`Branch name: ${process.env.WT_BRANCH_NAME}`);

// Use zx for shell commands
await $`cd ${process.env.WT_WORKTREE_PATH} && pnpm install`;

// Use glob to find and copy configuration files
const configFiles = await glob('config/*.json', { 
  cwd: process.env.WT_PROJECT_ROOT 
});

for (const file of configFiles) {
  await $`cp ${process.env.WT_PROJECT_ROOT}/${file} ${process.env.WT_WORKTREE_PATH}/${file}`;
}
```

This feature enables powerful automation workflows by leveraging the full npm ecosystem without bloating individual worktrees with dependencies.

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test              # Run all tests in CI mode
pnpm test:coverage     # Run tests with coverage reports

# Type checking
pnpm typecheck

# Linting and formatting
pnpm lint              # Fast linting with oxc-lint
pnpm lint:eslint       # Comprehensive linting with ESLint
pnpm format            # Format code with Prettier

# Build and run
pnpm build             # Build TypeScript to JavaScript
pnpm start             # Run the built CLI

# Development workflow
pnpm build && node dist/src/bin/wtm.js <command>  # Test CLI locally
tsx src/bin/wtm.ts <command>                      # Run directly with tsx
```

### Project Structure

```
wtm/
├── src/
│   ├── bin/          # CLI entry point
│   ├── commands/     # Command implementations
│   ├── components/   # React components for interactive UI
│   ├── utils/        # Utility functions
│   └── types/        # TypeScript type definitions
├── test/             # Test files
├── dist/             # Compiled output
└── .github/          # GitHub Actions workflows
```

### Technology Stack

- **TypeScript**: Type-safe development with ES modules
- **Commander.js**: CLI argument parsing (v14)
- **simple-git**: Git operations wrapper
- **chalk**: Terminal styling (v5)
- **ora**: Progress indicators (v8)
- **ink**: React for CLIs - powers the interactive TUI (v6)
- **@inkjs/ui**: Pre-built UI components for ink (v2)
- **ink-select-input**: Enhanced select component with highlight tracking (v6)
- **oxc-lint**: Fast linting (primary linter)
- **vitest**: Testing framework with coverage support
- **tsx**: TypeScript execution for development

## Configuration

### Git Worktree Structure
Worktrees are created in `.git/tmp_worktrees/` with the naming convention:
```
YYYYMMDD_HHMMSS_<branch-name>
```

This ensures:
- Chronological ordering
- Easy identification
- No naming conflicts

### Ignoring Hook Files
Add `.wt_hook.js` to your `.gitignore` to keep hook configurations local:
```
.wt_hook.js
```

## API Reference

### Commands

#### `wtm` or `wtm list`
Lists all worktrees with their status. Opens interactive TUI by default.

Options:
- `-j, --json`: Output in JSON format (automatically disables interactive mode)
- `--no-interactive`: Disable interactive mode and show simple list

#### `wtm add`
Creates a new worktree with interactive branch selection or specified branch.

Options:
- `-b, --branch [branch]`: Branch name for the new worktree (interactive if not specified)
- `--from <branch>`: Base branch to create from (default: HEAD)
- `--path-only`: Output only the worktree path (useful for shell functions)
- `-s, --shell`: Launch a new shell in the worktree directory

#### `wtm remove <branch>`
Removes the worktree and deletes the associated branch.

Options:
- `-f, --force`: Skip confirmation prompt

#### `wtm init`
Creates a `.wt_hook.js` template in the repository root.

#### `wtm root`
Shows the main repository path, useful for navigation from worktrees.

Options:
- `-j, --json`: Output in JSON format
- `-v, --verbose`: Show detailed information about worktree status

## Troubleshooting

### Common Issues

1. **"Not in a git repository" error**
   - Ensure you're running wtm from within a Git repository
   - Check that `.git` directory exists

2. **"No worktree found for branch" error**
   - Verify the branch name is correct
   - Use `wtm list` to see all available worktrees
   - Branch names are normalized (e.g., `refs/heads/main` becomes `main`)

3. **Hook execution fails**
   - Check `.wt_hook.js` syntax
   - Ensure the hook file has execute permissions
   - Review error messages for specific issues
   - Hook files run with inherited stdio for real-time output

4. **ES Module import errors**
   - Ensure all imports use `.js` extensions (even for TypeScript files)
   - Node.js version must be 18.0.0 or higher for ES modules support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

All pull requests must pass CI checks:
- Tests must pass on Node.js 18.x, 20.x, and 22.x
- Type checking must pass (`pnpm typecheck`)
- Linting must pass (`pnpm lint`)
- Build must succeed (`pnpm build`)

### Publishing (Maintainers Only)

The package is published to npm as `@mkusaka/wtm`. To publish a new version:

1. Ensure you have `NPM_TOKEN` secret configured in GitHub repository settings
2. Run `npm version patch/minor/major` to bump version and create git tag
3. Push with tags: `git push origin main --follow-tags`
4. GitHub Actions will automatically:
   - Run tests across Node.js 18.x, 20.x, and 22.x
   - Execute linting and type checking
   - Publish to npm registry
   - Create a GitHub release with build artifacts

The `prepublishOnly` script ensures the package is always built and tested before publishing.

## License

MIT License - see the [LICENSE](LICENSE) file for details

## Acknowledgments

- Inspired by the need for better Git worktree management
- Built with modern TypeScript tooling
- Leverages the power of Git's worktree feature