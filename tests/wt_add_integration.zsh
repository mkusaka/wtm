#!/bin/zsh

set -eu

script_dir=${0:A:h}
source "${script_dir}/../wt.sh"

test_tmp=$(mktemp -d "${TMPDIR:-/tmp}/wtm-integration.XXXXXX")
trap 'rm -rf -- "$test_tmp"' EXIT

fail() {
    print -u2 -r -- "FAIL: $*"
    exit 1
}

assert_eq() {
    local expected=$1
    local actual=$2
    local message=$3
    [[ "$actual" = "$expected" ]] || fail "$message (expected='$expected', actual='$actual')"
}

assert_file_contains() {
    local file=$1
    local pattern=$2
    local message=$3
    local contents=$(<"$file")
    [[ "$contents" = *"$pattern"* ]] || fail "$message (actual='$contents')"
}

canonical_path() {
    (cd "$1" && pwd -P)
}

worktree_for_branch() {
    local repo=$1
    local branch=$2
    git -C "$repo" worktree list --porcelain | awk -v branch="$branch" '
        /^worktree / { path = substr($0, 10) }
        /^branch refs\/heads\// {
            name = substr($0, 19)
            if (name == branch) print path
        }
    '
}

init_repo() {
    local repo=$1
    mkdir -p "$repo"
    git init -q -b main "$repo"
    git -C "$repo" config user.name "wtm integration test"
    git -C "$repo" config user.email "wtm@example.invalid"
    print -r -- "initial" > "${repo}/README.md"
    git -C "$repo" add README.md
    git -C "$repo" commit -qm "initial"
    cat > "${repo}/.wt_hook.zsh" <<'HOOK'
print -r -- "$WT_BRANCH_NAME" > "${WT_WORKTREE_PATH}/hook-ran"
print -r -- "hook-output:$WT_BRANCH_NAME"
HOOK
}

run_wt() {
    local repo=$1
    local stdout_file=$2
    local stderr_file=$3
    shift 3
    (
        cd "$repo"
        wt "$@"
    ) > "$stdout_file" 2> "$stderr_file"
}

repo="${test_tmp}/repo"
stdout_file="${test_tmp}/stdout"
stderr_file="${test_tmp}/stderr"
init_repo "$repo"

# A remote-only branch must be checked out from origin rather than recreated.
remote_repo="${test_tmp}/remote.git"
git init -q --bare "$remote_repo"
git -C "$repo" remote add origin "$remote_repo"
git -C "$repo" push -q -u origin main
git -C "$repo" branch daemon/remote-only HEAD
git -C "$repo" push -q origin daemon/remote-only
git -C "$repo" branch -D daemon/remote-only >/dev/null
run_wt "$repo" "$stdout_file" "$stderr_file" \
    add --no-move --porcelain --no-hook daemon/remote-only
remote_path=$(<"$stdout_file")
assert_eq "origin/daemon/remote-only" \
    "$(git -C "$remote_path" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}')" \
    "remote-only branch should retain its origin tracking branch"

# Daemon-safe creation prints exactly one canonical path and skips the hook.
run_wt "$repo" "$stdout_file" "$stderr_file" \
    add --no-move --porcelain --no-hook -b daemon/no-hook HEAD
assert_eq "1" "$(wc -l < "$stdout_file" | tr -d ' ')" \
    "--porcelain should print exactly one stdout line"
created_path=$(<"$stdout_file")
assert_eq "$(canonical_path "$created_path")" "$created_path" \
    "--porcelain should print a canonical path"
[[ ! -e "${created_path}/hook-ran" ]] || fail "--no-hook should skip .wt_hook.zsh"

# --no-move rejects a branch that is already checked out and leaves it in place.
main_path_before=$(canonical_path "$(worktree_for_branch "$repo" main)")
if run_wt "$repo" "$stdout_file" "$stderr_file" \
    add --no-move --porcelain --no-hook main; then
    fail "--no-move should reject a checked-out branch"
fi
[[ ! -s "$stdout_file" ]] || fail "--no-move failure should not write to stdout"
assert_file_contains "$stderr_file" "Branch 'main' is already checked out" \
    "--no-move should explain why it refused the operation"
main_path_after=$(canonical_path "$(worktree_for_branch "$repo" main)")
assert_eq "$main_path_before" "$main_path_after" \
    "--no-move should not relocate the existing worktree"

# Hook output is redirected to stderr so porcelain stdout remains machine-readable.
run_wt "$repo" "$stdout_file" "$stderr_file" \
    add --no-move --porcelain -b daemon/hook HEAD
assert_eq "1" "$(wc -l < "$stdout_file" | tr -d ' ')" \
    "hook output should not add porcelain stdout lines"
hook_path=$(<"$stdout_file")
assert_eq "daemon/hook" "$(cat "${hook_path}/hook-ran")" \
    "hook should run when --no-hook is not supplied"
assert_file_contains "$stderr_file" "hook-output:daemon/hook" \
    "hook stdout should be redirected to stderr in porcelain mode"

# Legacy add syntax still creates a worktree, runs the hook, and reports normally.
run_wt "$repo" "$stdout_file" "$stderr_file" add -b legacy/create HEAD
assert_file_contains "$stdout_file" "Created worktree:" \
    "legacy add should retain its human-readable success output"
legacy_path=$(worktree_for_branch "$repo" legacy/create)
assert_eq "legacy/create" "$(cat "${legacy_path}/hook-ran")" \
    "legacy add should still run .wt_hook.zsh"

# Without --no-move, the existing automatic relocation behavior is preserved.
existing_path="${repo}/existing-move"
git -C "$repo" worktree add -q -b legacy/move "$existing_path" HEAD
run_wt "$repo" "$stdout_file" "$stderr_file" add legacy/move
assert_file_contains "$stdout_file" "Moved worktree:" \
    "legacy add should still move an existing worktree"
moved_path=$(worktree_for_branch "$repo" legacy/move)
[[ "$moved_path" = "$(canonical_path "$repo")/worktrees/"* ]] || \
    fail "legacy add should relocate the worktree under worktrees/"
[[ ! -e "$existing_path" ]] || fail "legacy relocation should remove the old path"

print -r -- "PASS: wt add integration tests"
