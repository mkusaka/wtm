use anyhow::{Context, Result};
use chrono::{Local, TimeZone};
use clap::Parser;
use git2::{Repository, StatusOptions};
use rayon::prelude::*;
use skim::FuzzyAlgorithm;
use skim::prelude::*;
use std::borrow::Cow;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;

#[derive(Parser, Debug)]
#[command(
    author,
    version,
    about = "Interactive worktree selector with real-time updates"
)]
struct Args {
    /// Show preview panel
    #[arg(long)]
    preview: bool,

    /// Action to perform (cd, remove)
    #[arg(long, default_value = "cd")]
    action: String,
}

#[derive(Debug, Clone)]
struct WorktreeItem {
    branch: String,
    path: String,
    display_text: String,
    matching_ranges: Vec<(usize, usize)>,
}

impl WorktreeItem {
    fn new(branch: String, path: String, dirname: String, updated_relative: String) -> Self {
        // Build the display string once so `text()` and highlighting stay consistent.
        let updated_col = format!("{updated_relative:<10}");
        let branch_col = format!("{branch:<40}");
        let display_text = format!("{updated_col} {branch_col} {dirname}");

        // Describe the byte ranges we want skim to match against.
        // This allows ^prefix to anchor to the branch/dirname columns instead of the first column.
        let updated_range = (0, updated_col.len());
        let branch_start = updated_col.len() + 1;
        let branch_range = (branch_start, branch_start + branch.len());
        let dirname_start = branch_start + branch_col.len() + 1;
        let dirname_range = (dirname_start, display_text.len());

        Self {
            branch,
            path,
            display_text,
            matching_ranges: vec![updated_range, branch_range, dirname_range],
        }
    }
}

impl SkimItem for WorktreeItem {
    fn text(&self) -> Cow<'_, str> {
        Cow::Borrowed(&self.display_text)
    }

    fn display<'a>(&'a self, context: DisplayContext<'a>) -> AnsiString<'a> {
        // Use the context directly for proper highlighting
        AnsiString::from(context)
    }

    fn get_matching_ranges(&self) -> Option<&[(usize, usize)]> {
        Some(&self.matching_ranges)
    }

    fn preview(&self, _context: PreviewContext) -> ItemPreview {
        // Generate preview using git2 API data wrapped in shell for formatting
        let preview_result = generate_preview(&self.branch, &self.path);
        ItemPreview::Text(
            preview_result.unwrap_or_else(|e| format!("Error generating preview: {e}")),
        )
    }
}

fn generate_preview(branch: &str, path: &str) -> Result<String> {
    let mut output = String::new();

    // Header info
    output.push_str(&format!("🌳 Branch: {branch}\n\n"));
    output.push_str(&format!("📁 Path: {path}\n\n"));

    // Open repository
    if let Ok(repo) = Repository::open(path) {
        // Get last commit info
        if let Ok(head) = repo.head()
            && let Ok(commit) = head.peel_to_commit()
        {
            let timestamp = commit.time().seconds();
            let dt = Local
                .timestamp_opt(timestamp, 0)
                .single()
                .unwrap_or_else(Local::now);
            let relative = format_relative_time(&dt);
            let summary = commit.summary().unwrap_or("No message");
            output.push_str(&format!("🕐 Last commit: {relative}: {summary}\n\n"));
        }

        // Get status
        output.push_str("📝 Changed files:\n");
        output.push_str("───────────────────────────────────────────────────\n");

        let mut status_opts = StatusOptions::new();
        status_opts.include_untracked(true);

        if let Ok(statuses) = repo.statuses(Some(&mut status_opts)) {
            if statuses.is_empty() {
                output.push_str("  ✨ Working tree clean\n");
            } else {
                for entry in statuses.iter().take(10) {
                    let status = entry.status();
                    let path = entry.path().unwrap_or("?");

                    let status_char = if status.is_wt_new() || status.is_index_new() {
                        "A"
                    } else if status.is_wt_modified() || status.is_index_modified() {
                        "M"
                    } else if status.is_wt_deleted() || status.is_index_deleted() {
                        "D"
                    } else if status.is_wt_renamed() || status.is_index_renamed() {
                        "R"
                    } else if status.is_conflicted() {
                        "C"
                    } else {
                        "?"
                    };

                    output.push_str(&format!("  {status_char} {path}\n"));
                }

                let total = statuses.len();
                if total > 10 {
                    let more = total - 10;
                    output.push_str(&format!("  ... and {more} more\n"));
                }
            }
        }
        output.push('\n');

        // Get recent commits
        output.push_str("📜 Recent commits:\n");
        output.push_str("───────────────────────────────────────────────────\n");

        if let Ok(mut revwalk) = repo.revwalk() {
            let _ = revwalk.push_head();

            for oid in revwalk.take(10).flatten() {
                if let Ok(commit) = repo.find_commit(oid) {
                    let id_str = &oid.to_string()[..7];
                    let summary = commit.summary().unwrap_or("No message");
                    output.push_str(&format!("  {id_str} {summary}\n"));
                }
            }
        }
        output.push('\n');

        // Get diff stat against origin/develop
        output.push_str("📊 Diff vs origin/develop:\n");
        output.push_str("───────────────────────────────────────────────────\n");

        if let Ok(head_commit) = repo.head().and_then(|h| h.peel_to_commit()) {
            // Try to find origin/develop
            let develop_ref = repo
                .find_reference("refs/remotes/origin/develop")
                .or_else(|_| repo.find_reference("refs/remotes/origin/main"))
                .or_else(|_| repo.find_reference("refs/remotes/origin/master"));

            if let Ok(develop_ref) = develop_ref {
                if let Ok(develop_commit) = develop_ref.peel_to_commit() {
                    let head_tree = head_commit.tree().ok();
                    let develop_tree = develop_commit.tree().ok();

                    if let (Some(head_tree), Some(develop_tree)) = (head_tree, develop_tree) {
                        if let Ok(diff) = repo.diff_tree_to_tree(
                            Some(&develop_tree),
                            Some(&head_tree),
                            None,
                        ) {
                            if let Ok(stats) = diff.stats() {
                                let files = stats.files_changed();
                                let insertions = stats.insertions();
                                let deletions = stats.deletions();
                                output.push_str(&format!(
                                    "  {} file(s) changed, +{} -{}\n",
                                    files, insertions, deletions
                                ));
                            }

                            // Show changed files (max 15)
                            let mut file_count = 0;
                            for delta in diff.deltas().take(15) {
                                let path = delta
                                    .new_file()
                                    .path()
                                    .or_else(|| delta.old_file().path())
                                    .map(|p| p.to_string_lossy())
                                    .unwrap_or_default();
                                let status_char = match delta.status() {
                                    git2::Delta::Added => "A",
                                    git2::Delta::Deleted => "D",
                                    git2::Delta::Modified => "M",
                                    git2::Delta::Renamed => "R",
                                    git2::Delta::Copied => "C",
                                    _ => "?",
                                };
                                output.push_str(&format!("  {status_char} {path}\n"));
                                file_count += 1;
                            }

                            let total_deltas = diff.deltas().count();
                            if total_deltas > 15 {
                                output.push_str(&format!(
                                    "  ... and {} more files\n",
                                    total_deltas - file_count
                                ));
                            }

                            if file_count == 0 {
                                output.push_str("  ✨ No changes from origin/develop\n");
                            }
                        }
                    }
                }
            } else {
                output.push_str("  (origin/develop not found)\n");
            }
        }
    } else {
        output.push_str("Error: Cannot access worktree\n");
    }

    Ok(output)
}

fn format_relative_time(dt: &chrono::DateTime<Local>) -> String {
    let now = Local::now();
    let duration = now.signed_duration_since(*dt);

    if duration.num_days() > 0 {
        format!("{}d ago", duration.num_days())
    } else if duration.num_hours() > 0 {
        format!("{}h ago", duration.num_hours())
    } else if duration.num_minutes() > 0 {
        format!("{}m ago", duration.num_minutes())
    } else {
        "now".to_string()
    }
}

fn get_last_commit_info(path: &str) -> (Option<i64>, String) {
    let repo = match Repository::open(path) {
        Ok(r) => r,
        Err(_) => return (None, "unknown".to_string()),
    };

    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return (None, "unknown".to_string()),
    };

    let commit = match head.peel_to_commit() {
        Ok(c) => c,
        Err(_) => return (None, "unknown".to_string()),
    };

    let timestamp = commit.time().seconds();
    let dt = Local
        .timestamp_opt(timestamp, 0)
        .single()
        .unwrap_or_else(Local::now);

    let relative_time = format_relative_time(&dt);
    (Some(timestamp), relative_time)
}

fn get_dirname(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path)
        .to_string()
}

fn collect_worktrees() -> Result<Vec<(String, String)>> {
    // Find the main repository first
    let current_repo = Repository::open_from_env()
        .or_else(|_| Repository::discover("."))
        .context("Failed to open git repository")?;

    // Get the common git directory (handles both regular repos and worktrees)
    let git_common_dir = current_repo
        .path()
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Failed to get repository parent directory"))?;

    // For worktrees, we need to go up one more level to get the main repo
    let main_repo_path = if git_common_dir.ends_with(".git/worktrees") {
        git_common_dir
            .parent()
            .and_then(|p| p.parent())
            .ok_or_else(|| anyhow::anyhow!("Failed to get main repository path"))?
    } else if git_common_dir.ends_with(".git") {
        git_common_dir
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Failed to get repository parent"))?
    } else {
        git_common_dir
    };

    let main_repo = Repository::open(main_repo_path).context("Failed to open main repository")?;

    let mut worktrees = Vec::new();

    // Add the main repository
    if let Ok(head) = main_repo.head()
        && let Some(name) = head.shorthand()
    {
        let path = main_repo_path.to_string_lossy().to_string();
        worktrees.push((name.to_string(), path));
    }

    // Get worktrees directory
    let worktrees_dir = main_repo.path().join("worktrees");

    if worktrees_dir.exists() {
        // Read each worktree
        if let Ok(entries) = std::fs::read_dir(&worktrees_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let gitdir_path = entry.path().join("gitdir");

                // Read the gitdir file to get the actual worktree path
                if let Ok(gitdir_content) = std::fs::read_to_string(&gitdir_path) {
                    let worktree_path = gitdir_content.trim();

                    // Clean up the path - remove .git at the end if present
                    let worktree_path =
                        worktree_path.strip_suffix("/.git").unwrap_or(worktree_path);

                    // Open the worktree to get its branch
                    if let Ok(wt_repo) = Repository::open(worktree_path)
                        && let Ok(head) = wt_repo.head()
                        && let Some(branch_name) = head.shorthand()
                    {
                        worktrees.push((branch_name.to_string(), worktree_path.to_string()));
                    }
                }
            }
        }
    }

    Ok(worktrees)
}

fn remove_worktree(branch: &str, path: &str) -> Result<()> {
    // Open the worktree repository
    let repo = Repository::open(path).context("Failed to open worktree repository")?;

    // Get the main repository path
    let git_common_dir = repo
        .path()
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Failed to get repository parent directory"))?;

    let main_repo_path = if git_common_dir.ends_with(".git/worktrees") {
        git_common_dir
            .parent()
            .and_then(|p| p.parent())
            .ok_or_else(|| anyhow::anyhow!("Failed to get main repository path"))?
    } else {
        git_common_dir
    };

    // Remove the worktree directory
    eprintln!("Removing worktree: {branch} ({path})");
    std::fs::remove_dir_all(path).context("Failed to remove worktree directory")?;

    // Remove the administrative files in .git/worktrees
    let worktree_name = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| anyhow::anyhow!("Failed to get worktree name"))?;

    let admin_dir = main_repo_path.join(".git/worktrees").join(worktree_name);
    if admin_dir.exists() {
        std::fs::remove_dir_all(&admin_dir).context("Failed to remove worktree admin directory")?;
    }

    // Delete the branch
    let main_repo = Repository::open(main_repo_path).context("Failed to open main repository")?;

    if let Ok(mut branch_ref) = main_repo.find_branch(branch, git2::BranchType::Local) {
        branch_ref.delete().context("Failed to delete branch")?;
        eprintln!("Deleted branch: {branch}");
    }

    Ok(())
}

fn main() -> Result<()> {
    let args = Args::parse();

    // Collect basic worktree info
    let worktrees = collect_worktrees()?;

    // Create a channel for sending items to skim
    let (tx_item, rx_item): (SkimItemSender, SkimItemReceiver) = unbounded();

    // Create a map to store display text -> WorktreeItem mapping
    let item_map = Arc::new(Mutex::new(HashMap::<String, (String, String)>::new()));
    let item_map_clone = Arc::clone(&item_map);

    // Process worktrees in parallel and send to skim as they're ready
    thread::spawn(move || {
        // Collect all items first
        let mut all_items: Vec<(i64, Arc<WorktreeItem>)> = worktrees
            .into_par_iter()
            .map(|(branch, path)| {
                let (timestamp, relative_time) = get_last_commit_info(&path);
                let timestamp_val = timestamp.unwrap_or(0);
                let dirname = get_dirname(&path);

                let item = Arc::new(WorktreeItem::new(
                    branch,
                    path.clone(),
                    dirname,
                    relative_time,
                ));

                (-timestamp_val, item)
            })
            .collect();

        // Sort by timestamp (descending)
        all_items.sort_by_key(|(ts, _)| *ts);

        // Send all sorted items once and populate the map
        for (_, item) in all_items {
            // Store the mapping from display_text to (branch, path)
            let mut map = item_map_clone.lock().unwrap();
            map.insert(
                item.display_text.clone(),
                (item.branch.clone(), item.path.clone()),
            );
            drop(map);

            let _ = tx_item.send(item as Arc<dyn SkimItem>);
        }

        // Signal completion
        drop(tx_item);
    });

    // Configure skim options using builder for better control
    let options = SkimOptionsBuilder::default()
        .height("80%".to_string())
        .multi(false)
        .prompt("🔍 Select worktree > ".to_string())
        .preview(Some(String::new())) // Required to enable SkimItem::preview() method
        .preview_window(if args.preview {
            "right:60%:wrap".to_string()
        } else {
            "hidden".to_string()
        })
        .header(Some("🌲 Git Worktree Manager | Tips: ^prefix for start match, 'exact for exact match\n──────────────────────────────────────────────────────────────────────────\nUpdated    Branch                                   Directory".to_string()))
        .ansi(true)  // REQUIRED for colored highlights
        .regex(false)  // IMPORTANT: extended search with ' ^ ! etc.
        .exact(false)  // Start fuzzy; ' toggles exact
        .algorithm(FuzzyAlgorithm::SkimV2)  // Be explicit about algorithm
        // Color scheme for highlights
        .color(Some("matched:bg:yellow,matched:fg:black".to_string()))
        .build()
        .unwrap();

    // Run skim
    let selected = Skim::run_with(&options, Some(rx_item))
        .map(|out| out.selected_items)
        .unwrap_or_default();

    // Process selection
    if !selected.is_empty() {
        // Get the selected item
        let selected_item = &selected[0];

        // Get the display text and look up the item details from our map
        let display_text = selected_item.text();
        let map = item_map.lock().unwrap();

        if let Some((branch, path)) = map.get(display_text.as_ref()) {
            match args.action.as_str() {
                "cd" => {
                    // Output path for shell to cd
                    println!("{path}");
                }
                "remove" => {
                    // Remove worktree and branch
                    remove_worktree(branch, path)?;
                }
                _ => {
                    eprintln!("Unknown action: {}", args.action);
                }
            }
        } else {
            eprintln!("Error: Could not get item details");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_worktree_item_text_format() {
        let item = WorktreeItem::new(
            "feature-branch".to_string(),
            "/path/to/worktree".to_string(),
            "worktree".to_string(),
            "2h ago".to_string(),
        );

        // text() now returns formatted display string
        let text = item.text();
        // Format: "{:<10} {:<40} {}"
        assert!(text.contains("2h ago"));
        assert!(text.contains("feature-branch"));
        assert!(text.contains("worktree"));
    }

    #[test]
    fn test_search_format_vs_display_format() {
        let item = WorktreeItem::new(
            "feature-branch".to_string(),
            "/path/to/worktree".to_string(),
            "worktree".to_string(),
            "2h ago".to_string(),
        );

        // text() and display() now use the same format
        let text = item.text();

        // Should be formatted with fixed widths
        assert!(text.starts_with("2h ago"));
        assert!(text.contains("feature-branch"));
        assert!(text.contains("worktree"));
    }

    #[test]
    fn test_display_alignment() {
        // Test various branch name lengths
        let test_cases = vec![
            ("main", "2h ago", "project"),
            (
                "feature-very-long-branch-name-that-exceeds-40-chars",
                "10d ago",
                "my-workspace",
            ),
            ("fix", "now", "dir"),
        ];

        for (branch, updated, dirname) in test_cases {
            let item = WorktreeItem::new(
                branch.to_string(),
                format!("/path/to/{dirname}"),
                dirname.to_string(),
                updated.to_string(),
            );

            // Verify the text format has fixed-width columns
            let search_text = item.text();
            // Format is now: updated (10 chars) | branch (40 chars) | dirname
            assert!(search_text.starts_with(updated));
            assert!(search_text.contains(&item.branch));
            assert!(search_text.contains(dirname));
        }
    }
}
