#!/bin/zsh

# Git Worktree Manager (wt)
# Combines simplicity from gist with Rust-powered interactive selection

wt() {
    local cmd=$1

    case "$cmd" in
        "")
            # Default: interactive selection with wtm-select (skim-based)
            if ! command -v wtm-select &> /dev/null; then
                echo "Error: wtm-select not found. Please install it first:"
                echo "  cargo install --path /path/to/wtm/wtm-select"
                return 1
            fi
            local selected_path=$(wtm-select --preview)
            [[ -n "$selected_path" ]] && cd "$selected_path" && echo "Changed to: $selected_path"
            ;;

        "add")
            local branch_name=$2
            local force_new=false

            # Check for -b flag (same as git worktree add -b)
            if [[ "$branch_name" = "-b" ]]; then
                force_new=true
                branch_name=$3
            fi

            [[ -z "$branch_name" ]] && { echo "Usage: wt add [-b] <branch_name>"; return 1; }

            local repo_root tmp_dir timestamp dir_name worktree_path project_root
            repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "Not in a git repo"; return 1; }
            tmp_dir="$repo_root/worktrees"; mkdir -p "$tmp_dir"

            timestamp=$(date +"%Y%m%d_%H%M%S")
            dir_name="${timestamp}_$(echo "$branch_name" | tr '/' '_')"
            worktree_path="${tmp_dir}/${dir_name}"

            # Check if branch exists
            local branch_exists=false
            if git show-ref --verify --quiet refs/heads/"$branch_name" || \
               git show-ref --verify --quiet refs/remotes/origin/"$branch_name"; then
                branch_exists=true
            fi

            # Check if branch is already used by another worktree
            local existing_worktree
            existing_worktree=$(git worktree list --porcelain | \
                awk -v branch="$branch_name" '
                    /^worktree / { path = substr($0, 10) }
                    /^branch refs\/heads\// {
                        b = substr($0, 19)
                        if (b == branch) print path
                    }
                ')
            if [[ -n "$existing_worktree" ]]; then
                # Automatically move existing worktree to the new location
                echo "Moving existing worktree from '$existing_worktree' to '$worktree_path'..."
                if git worktree move "$existing_worktree" "$worktree_path" 2>&1; then
                    echo "Moved worktree: $worktree_path"
                    project_root=$(git rev-parse --show-toplevel)
                    cd "$worktree_path" || return

                    # Run hook if exists with environment variables
                    if [[ -f "${project_root}/.wt_hook.zsh" ]]; then
                        export WT_WORKTREE_PATH="$worktree_path"
                        export WT_BRANCH_NAME="$branch_name"
                        export WT_PROJECT_ROOT="$project_root"
                        echo "Running .wt_hook.zsh..."
                        source "${project_root}/.wt_hook.zsh"
                        unset WT_WORKTREE_PATH WT_BRANCH_NAME WT_PROJECT_ROOT
                    fi
                    return 0
                else
                    echo "Error: Failed to move worktree"
                    return 1
                fi
            fi

            # Decide whether to create new branch or use existing
            local worktree_output
            if [[ "$force_new" = true ]]; then
                # Force create new branch
                worktree_output=$(git worktree add -b "$branch_name" "$worktree_path" 2>&1)
            elif [[ "$branch_exists" = true ]]; then
                # Use existing branch
                local local_exists=false
                local remote_exists=false
                git show-ref --verify --quiet refs/heads/"$branch_name" && local_exists=true
                git show-ref --verify --quiet refs/remotes/origin/"$branch_name" && remote_exists=true

                if [[ "$local_exists" = true ]]; then
                    # Local branch exists
                    echo "Using existing local branch: $branch_name"
                    worktree_output=$(git worktree add "$worktree_path" "$branch_name" 2>&1)
                elif [[ "$remote_exists" = true ]]; then
                    # Only remote branch exists - create local tracking branch
                    echo "Creating local branch from remote: $branch_name"
                    worktree_output=$(git worktree add --track -b "$branch_name" "$worktree_path" "origin/$branch_name" 2>&1)
                else
                    # Should not reach here, but handle gracefully
                    echo "Error: Branch '$branch_name' not found"
                    return 1
                fi
            else
                # Create new branch
                echo "Creating new branch: $branch_name"
                worktree_output=$(git worktree add -b "$branch_name" "$worktree_path" 2>&1)
            fi

            # Verify worktree was actually created (check for .git file in worktree directory)
            if [[ -d "$worktree_path" ]] && [[ -e "$worktree_path/.git" ]]; then
                echo "Created worktree: $worktree_path"
                project_root=$(git rev-parse --show-toplevel)
                cd "$worktree_path" || return

                # Run hook if exists with environment variables
                if [[ -f "${project_root}/.wt_hook.zsh" ]]; then
                    export WT_WORKTREE_PATH="$worktree_path"
                    export WT_BRANCH_NAME="$branch_name"
                    export WT_PROJECT_ROOT="$project_root"
                    echo "Running .wt_hook.zsh..."
                    source "${project_root}/.wt_hook.zsh"
                    unset WT_WORKTREE_PATH WT_BRANCH_NAME WT_PROJECT_ROOT
                fi
            else
                echo "Error: Failed to create worktree for branch '$branch_name'"
                [[ -n "$worktree_output" ]] && echo "$worktree_output"
                # Clean up potentially created but broken worktree directory
                [[ -d "$worktree_path" ]] && rm -rf "$worktree_path"
                return 1
            fi
            ;;

        "remove")
            if [[ -z "$2" ]]; then
                # Interactive removal with wtm-select
                if command -v wtm-select &> /dev/null; then
                    wtm-select --action remove
                else
                    echo "Usage: wt remove <branch_name>"
                fi
            else
                # Direct removal by branch name (simplified from gist)
                local branch_name=$2
                local info path
                info=$(git worktree list | grep "\[${branch_name}\]") || { echo "No worktree for branch: $branch_name"; return 1; }
                path=${info%%[[:space:]]*}
                git worktree remove --force "$path" && git branch -D "$branch_name" && \
                    echo "Removed worktree & branch: $branch_name"
            fi
            ;;

        "init")
            local git_dir exclude_file
            git_dir=$(git rev-parse --git-dir 2>/dev/null) || { echo "Not in a git repo"; return 1; }
            exclude_file="$git_dir/info/exclude"

            # Add worktrees to .git/info/exclude if not already present
            if [[ -f "$exclude_file" ]]; then
                if ! grep -qxF "worktrees" "$exclude_file"; then
                    echo "worktrees" >> "$exclude_file"
                    echo "Added 'worktrees' to .git/info/exclude"
                else
                    echo "'worktrees' already in .git/info/exclude"
                fi
            else
                mkdir -p "$(dirname "$exclude_file")"
                echo "worktrees" > "$exclude_file"
                echo "Created .git/info/exclude and added 'worktrees'"
            fi

            # Create hook template if not exists
            if [[ -f ".wt_hook.zsh" ]]; then
                echo ".wt_hook.zsh already exists"
            else
                cat > .wt_hook.zsh <<'EOF'
#!/bin/zsh
# .wt_hook.zsh - run after `wt add`
# Available variables: $WT_WORKTREE_PATH, $WT_BRANCH_NAME, $WT_PROJECT_ROOT

echo "🌲 Setting up worktree for branch: $WT_BRANCH_NAME"

# Copy common files from main repository
copy_items=(".env" ".claude" ".env.local")
for item in "${copy_items[@]}"; do
    [[ -e "${WT_PROJECT_ROOT}/$item" ]] && cp -r "${WT_PROJECT_ROOT}/$item" "$item" && echo "  Copied $item"
done

# Example: Install dependencies
# [[ -f package.json ]] && npm install

# Example: Run setup script
# [[ -x ./setup.sh ]] && ./setup.sh
EOF
                chmod +x .wt_hook.zsh
                echo "Created .wt_hook.zsh template"
            fi
            ;;

        "root")
            # Move to git repository root (from gist)
            cd "$(dirname "$(git rev-parse --git-common-dir)")" || return
            ;;

        "list")
            # List worktrees
            git worktree list
            ;;

        "help")
            echo "Git Worktree Manager (wt)"
            echo
            echo "Usage:"
            echo "  wt                     # interactive selection (skim-powered)"
            echo "  wt add <branch>        # create worktree (auto-move if exists elsewhere)"
            echo "  wt add -b <branch>     # create worktree with new branch (always new)"
            echo "  wt remove [<branch>]   # remove worktree (interactive or direct)"
            echo "  wt init                # generate .wt_hook.zsh template"
            echo "  wt root                # cd to git repo root"
            echo "  wt list                # list all worktrees"
            echo
            echo "Tips:"
            echo "  - In interactive mode: '^branch' for prefix, 'exact for exact match"
            echo "  - Worktrees are created in ./worktrees/"
            echo "  - .wt_hook.zsh runs after creating worktrees"
            ;;

        *)
            echo "Unknown command: $cmd"
            echo "Use 'wt help' for usage"
            return 1
            ;;
    esac
}

# Alias for backward compatibility
alias wts=wt