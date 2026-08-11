# Git Worktree Manager (wt)

A comprehensive git worktree management tool with interactive selection and Rust-powered performance.

## Features

- 🔍 Interactive worktree selection with fuzzy search (powered by skim)
- 🎨 Syntax highlighting for search matches
- 📅 Sort by last commit time
- 🔎 Advanced search modes (`^prefix`, `'exact`)
- 🌲 Full worktree lifecycle management
- 🪝 Custom hooks for worktree initialization
- 🦀 Uses git2 crate for native Git operations (no external dependencies)

## Installation

### Install the Rust tool

```bash
# Clone the repository
git clone https://github.com/mkusaka/wtm.git
cd wtm

# Install wtm-select to your PATH
cargo install --path wtm-select

# Reproducible install (recommended to avoid dependency breakages)
cargo install --path wtm-select --locked
```

### Source the shell function

Add to your `.zshrc`:

```bash
# Adjust the path to where you cloned the repository
source ~/path/to/wtm/wt.sh
```

## Usage

### Basic Commands

```bash
wt                     # Interactive selection (Enter: open, Esc: cancel)
wt add <branch>        # Create worktree (use existing branch or create new)
wt add -b <branch>     # Create worktree with new branch (always new)
wt add --no-move --porcelain --no-hook -b <branch> [<start-point>]
wt remove [<branch>]   # Remove worktree (interactive or by branch name)
wt init                # Generate .wt_hook.zsh template
wt root                # cd to original repo root
wt list                # List all worktrees
wt help                # Show help
```

### Daemon-safe creation

For scripts and long-running daemons, combine the following options:

```bash
worktree_path=$(wt add --no-move --porcelain --no-hook -b "$branch" HEAD)
```

- `--no-move` returns a non-zero status when the branch is already checked out,
  instead of relocating the existing worktree.
- `--porcelain` writes only the canonical worktree path followed by a newline to
  stdout on success. Progress messages, Git errors, and hook output go to stderr.
- `--no-hook` skips `.wt_hook.zsh`.

The options apply only when explicitly provided. Existing interactive and
human-oriented commands retain their automatic relocation, hook execution, and
status output.

### Interactive Mode Search

In the interactive selection mode (`wt`):

- **Fuzzy search**: Type any part of branch/directory name
- **Prefix match**: `^main` - branches starting with "main"
- **Exact match**: `'main` - exact "main" match
- **Inverse match**: `!test` - exclude items with "test"

### Worktree Hooks

Create `.wt_hook.zsh` in your repository root:

```bash
wt init  # Generate template
```

The hook will be executed after creating or switching to a worktree.
The generated template copies common local paths only when the destination does
not already exist, so tracked directories such as `.claude` are not nested or
overwritten in new worktrees.

Example `.wt_hook.zsh`:

```bash
#!/bin/zsh
echo "🌲 Setting up worktree..."

# Install dependencies
if [[ -f package.json ]]; then
    npm install
fi

# Copy environment file
if [[ -f .env.example ]] && [[ ! -f .env ]]; then
    cp .env.example .env
fi
```

## Components

### Rust Tool

- **wtm-select**: Interactive worktree selector with skim
  - Lists worktrees sorted by last commit time
  - Provides real-time preview of worktree status
  - Supports branch removal with `--action remove`
  - Uses git2 crate for all Git operations

### Display Format

```
Updated    Branch                                   Directory
──────────────────────────────────────────────────────────────
2h ago     feature-auth                            20241123_feature-auth
1d ago     bugfix-api                              20241122_bugfix-api
3d ago     main                                    wtm
```

## Examples

### Create a new feature branch worktree

```bash
wt add feature-new-ui
# Creates worktree in ./worktrees/YYYYMMDD_HHMMSS_feature-new-ui
# The shell stays in the current directory; use `cd -` to enter the worktree.
# Run `cd -` again to return.
```

### Switch between worktrees

```bash
wt
# Opens interactive selector
# Type to search, Enter to switch
```

### Remove worktree and its branch

```bash
wt remove feature-old
# Removes worktree and optionally deletes the branch
```


## Tips

- Worktrees are created in `./worktrees/` with timestamp prefixes
- Use `wt init` to set up `.git/info/exclude` to ignore the worktrees directory
- Use `wt root` to quickly return to the main repository
- The interactive selector shows relative time since last commit
- Search is performed across updated time, branch name, and directory name

## License

MIT
