import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Worktree } from '../types/index.js';

interface Props {
  worktrees: Worktree[];
  onSelect: (worktree: Worktree) => void;
  onDelete: (worktree: Worktree) => void;
  onExit: () => void;
}

export const WorktreeSelector: React.FC<Props> = ({ worktrees, onSelect, onDelete, onExit }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { exit } = useApp();

  const filteredWorktrees = worktrees.filter(wt => 
    (wt.branch || '').toLowerCase().includes(filter.toLowerCase()) ||
    wt.path.toLowerCase().includes(filter.toLowerCase())
  );

  // Reset selectedIndex when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Ensure selectedIndex is within bounds
  useEffect(() => {
    if (selectedIndex >= filteredWorktrees.length && filteredWorktrees.length > 0) {
      setSelectedIndex(filteredWorktrees.length - 1);
    }
  }, [selectedIndex, filteredWorktrees.length]);

  useInput((input: string, key: any) => {
    if (showDeleteConfirm) {
      if (input === 'y' || input === 'Y') {
        onDelete(filteredWorktrees[selectedIndex]);
        setShowDeleteConfirm(false);
      } else if (input === 'n' || input === 'N' || key.escape) {
        setShowDeleteConfirm(false);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(filteredWorktrees.length - 1, selectedIndex + 1));
    } else if (key.return) {
      if (filteredWorktrees[selectedIndex]) {
        onSelect(filteredWorktrees[selectedIndex]);
      }
    } else if (input === 'd') {
      if (filteredWorktrees[selectedIndex]) {
        setShowDeleteConfirm(true);
      }
    } else if (key.escape || (key.ctrl && input === 'c')) {
      onExit();
      exit();
    } else if (key.backspace || key.delete) {
      setFilter(filter.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setFilter(filter + input);
    }
  });

  const selected = filteredWorktrees[selectedIndex];

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold>🌲 Git Worktree Manager</Text>
      </Box>

      <Box marginY={1}>
        <Text>🔍 Filter: {filter}<Text color="gray">_</Text></Text>
      </Box>

      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" width="50%" marginRight={1}>
          <Text bold underline>Worktrees:</Text>
          <Box marginTop={1} flexDirection="column">
            {filteredWorktrees.length === 0 ? (
              <Text color="yellow">No worktrees found</Text>
            ) : (
              filteredWorktrees.map((wt, index) => (
                <Box key={wt.path}>
                  <Text
                    color={index === selectedIndex ? 'cyan' : undefined}
                    inverse={index === selectedIndex}
                  >
                    {index === selectedIndex ? '▶ ' : '  '}
                    {wt.branch || '(detached)'} - {wt.path.split('/').pop()}
                  </Text>
                </Box>
              ))
            )}
          </Box>
        </Box>

        <Box flexDirection="column" width="50%" borderStyle="single" paddingX={1}>
          <Text bold underline>Preview:</Text>
          {selected && (
            <Box marginTop={1} flexDirection="column">
              <Text>📁 Path: {selected.path}</Text>
              <Text>🌿 Branch: {selected.branch || '(detached)'}</Text>
              <Text>📌 HEAD: {selected.head}</Text>
            </Box>
          )}
        </Box>
      </Box>

      <Box marginTop={1} borderStyle="single" paddingX={1}>
        <Text>
          <Text bold>Controls:</Text> ↑↓ Navigate | Enter: Open | d: Delete | Esc: Exit
        </Text>
      </Box>

      {showDeleteConfirm && (
        <Box 
          position="absolute" 
          marginLeft={Math.floor(25)} 
          marginTop={Math.floor(10)} 
          borderStyle="double" 
          paddingX={2} 
          paddingY={1}
        >
          <Text>Delete worktree '{selected?.branch}'? (y/N)</Text>
        </Box>
      )}
    </Box>
  );
};