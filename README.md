# wtm - Git Worktree Manager

A high-performance Git worktree management CLI tool written in TypeScript, designed to simplify the creation, organization, and maintenance of Git worktrees.

## Features

- **Interactive TUI Mode**: Default interactive terminal UI with real-time filtering and preview
- **Organized Worktree Structure**: Creates worktrees with timestamp prefixes in `.git/tmp_worktrees/` for better organization
- **Real-time Filtering**: Type to filter worktrees by branch name or path instantly
- **Preview Pane**: See worktree details (path, branch, commit) while navigating
- **Hook System**: Automate worktree initialization with customizable hooks
- **TypeScript Support**: Fully typed with TypeScript for better developer experience
- **Fast Linting**: Uses oxc-lint for blazing-fast code quality checks
- **Rich CLI Output**: Colorful and informative terminal output with progress indicators
- **Status Tracking**: Shows working tree status, modified files, and recent commits
- **JSON Export**: Machine-readable output format for scripting and automation

## Installation

### Prerequisites
- Node.js 18.0.0 or higher
- Git 2.0.0 or higher

### Install from npm

```bash
# Using npm
npm install -g @mkusaka/wtm

# Using pnpm (recommended)
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
wtm              # Opens interactive TUI for worktree selection
wtm list         # Same as above - interactive mode is default
```

In interactive mode:
- **Type to filter**: Start typing to filter worktrees by branch name or path
- **↑/↓ or j/k**: Navigate through worktrees
- **Enter**: Open selected worktree in a new shell
- **Ctrl-D**: Delete the selected worktree (with confirmation)
- **Esc**: Exit interactive mode

### Non-interactive Mode
```bash
wtm list --no-interactive  # Simple list output
wtm list --json           # JSON format (automatically disables interactive mode)
```

### Create a new worktree
```bash
wtm add feature-branch              # Create from HEAD
wtm add feature-branch -b develop   # Create from specific branch
```

The worktree will be created at `.git/tmp_worktrees/YYYYMMDD_HHMMSS_feature-branch/`

### Remove a worktree
```bash
wtm remove feature-branch      # Interactive confirmation
wtm remove feature-branch -f   # Force removal without confirmation
```

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

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build
pnpm build
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
└── dist/             # Compiled output
```

### Technology Stack

- **TypeScript**: Type-safe development
- **Commander.js**: CLI argument parsing
- **simple-git**: Git operations
- **chalk**: Terminal styling
- **ora**: Progress indicators
- **ink**: React for CLIs - powers the interactive TUI
- **@inkjs/ui**: Pre-built UI components for ink
- **ink-select-input**: Enhanced select component with highlight tracking
- **oxc-lint**: Fast linting
- **vitest**: Testing framework

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

#### `wtm [list]`
Lists all worktrees with their status. Opens interactive TUI by default.

Options:
- `-j, --json`: Output in JSON format
- `--no-interactive`: Disable interactive mode and show simple list

#### `wtm add <branch>`
Creates a new worktree for the specified branch.

Options:
- `-b, --base <branch>`: Base branch to create from (default: HEAD)

#### `wtm remove <branch>`
Removes the worktree and deletes the associated branch.

Options:
- `-f, --force`: Skip confirmation prompt

#### `wtm init`
Creates a `.wt_hook.js` template in the repository root.

## Troubleshooting

### Common Issues

1. **"Not in a git repository" error**
   - Ensure you're running wtm from within a Git repository
   - Check that `.git` directory exists

2. **"No worktree found for branch" error**
   - Verify the branch name is correct
   - Use `wtm list` to see all available worktrees

3. **Hook execution fails**
   - Check `.wt_hook.js` syntax
   - Ensure the hook file has execute permissions
   - Review error messages for specific issues

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details

## Acknowledgments

- Inspired by the need for better Git worktree management
- Built with modern TypeScript tooling
- Leverages the power of Git's worktree feature