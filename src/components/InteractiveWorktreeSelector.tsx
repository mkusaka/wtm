import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { ConfirmInput } from '@inkjs/ui';
import type { Worktree } from '../types/index.js';

interface Props {
  worktrees: Worktree[];
  onSelect: (worktree: Worktree) => void;
  onDelete: (worktree: Worktree) => void;
  onExit: () => void;
}

type Mode = 'select' | 'confirm-delete';

export const InteractiveWorktreeSelector: React.FC<Props> = ({ worktrees, onSelect, onDelete, onExit }) => {
  const [filter, setFilter] = useState('');
  const [mode, setMode] = useState<Mode>('select');
  const [selectedWorktree, setSelectedWorktree] = useState<Worktree | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { exit } = useApp();

  const filteredWorktrees = worktrees.filter(wt => 
    (wt.branch || '').toLowerCase().includes(filter.toLowerCase()) ||
    wt.path.toLowerCase().includes(filter.toLowerCase())
  );

  const items = filteredWorktrees.map((wt, index) => ({
    label: `${wt.branch || '(detached)'} - ${wt.path.split('/').pop()}`,
    value: wt.path,
    key: wt.path
  }));

  // Update selected worktree when filter changes
  useEffect(() => {
    if (filteredWorktrees.length > 0) {
      // When filter changes, try to keep the same selection if possible
      if (selectedWorktree) {
        const currentIndex = filteredWorktrees.findIndex(wt => wt.path === selectedWorktree.path);
        if (currentIndex >= 0) {
          // Current selection still exists in filtered list
          setSelectedIndex(currentIndex);
        } else {
          // Current selection was filtered out, select first item
          setSelectedIndex(0);
          setSelectedWorktree(filteredWorktrees[0]);
        }
      } else {
        // No previous selection, select first item
        setSelectedIndex(0);
        setSelectedWorktree(filteredWorktrees[0]);
      }
    } else {
      setSelectedWorktree(null);
      setSelectedIndex(0);
    }
  }, [filter]);

  // Handle keyboard input
  useInput((input, key) => {
    if (mode === 'select') {
      if (key.escape) {
        onExit();
        exit();
      } else if (key.ctrl && input === 'd' && selectedWorktree) {
        setMode('confirm-delete');
      } else if (key.backspace || key.delete) {
        setFilter(filter.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && !key.return) {
        setFilter(filter + input);
      }
    }
  });

  if (mode === 'confirm-delete' && selectedWorktree) {
    return (
      <Box flexDirection="column" width="100%">
        <Box borderStyle="round" borderColor="cyan" paddingX={1} width="100%">
          <Text bold>🌲 Git Worktree Manager</Text>
        </Box>
        <Box marginTop={2}>
          <Text>⚠️  Delete worktree '{selectedWorktree.branch || '(detached)'}'?</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Path: {selectedWorktree.path}</Text>
        </Box>
        <Box marginTop={2}>
          <ConfirmInput
            onConfirm={() => {
              onDelete(selectedWorktree);
            }}
            onCancel={() => {
              setMode('select');
            }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      <Box borderStyle="round" borderColor="cyan" paddingX={1} width="100%">
        <Text bold>🌲 Git Worktree Manager</Text>
      </Box>
      <Box marginTop={1}>
        <Text>🔍 Filter: {filter}<Text color="gray">_</Text></Text>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box flexDirection="column" flexGrow={1}>
          {filteredWorktrees.length === 0 ? (
            <Box paddingX={1}>
              <Text color="yellow">No worktrees found</Text>
            </Box>
          ) : (
            <SelectInput
              items={items}
              initialIndex={selectedIndex}
              limit={10}
              onSelect={(item) => {
                const worktree = filteredWorktrees.find(wt => wt.path === item.value);
                if (worktree) {
                  onSelect(worktree);
                }
              }}
              onHighlight={(item) => {
                const worktree = filteredWorktrees.find(wt => wt.path === item.value);
                if (worktree) {
                  const index = filteredWorktrees.indexOf(worktree);
                  setSelectedIndex(index);
                  setSelectedWorktree(worktree);
                }
              }}
            />
          )}
        </Box>
        <Box marginLeft={2} borderStyle="single" paddingX={1} minWidth={30}>
          <Box flexDirection="column">
            <Text bold underline>Preview:</Text>
            {selectedWorktree ? (
              <>
                <Text>📁 {selectedWorktree.path}</Text>
                <Text>🌿 {selectedWorktree.branch || '(detached)'}</Text>
                <Text>📌 {selectedWorktree.head.substring(0, 7)}</Text>
              </>
            ) : (
              <Text dimColor>No selection</Text>
            )}
          </Box>
        </Box>
      </Box>
      <Box marginTop={1} borderStyle="single" paddingX={1} width="100%">
        <Text dimColor>
          Type to filter | ↑↓ Navigate | Enter: Open | Ctrl-D: Delete | Esc: Exit
        </Text>
      </Box>
    </Box>
  );
};