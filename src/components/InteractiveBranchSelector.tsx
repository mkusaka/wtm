import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';

interface Props {
  branches: string[];
  onSelect: (branch: string) => void;
  onExit: () => void;
}

export const InteractiveBranchSelector: React.FC<Props> = ({ branches, onSelect, onExit }) => {
  const [filter, setFilter] = useState('');

  const filteredBranches = branches.filter(branch => 
    branch.toLowerCase().includes(filter.toLowerCase())
  );

  const items = filteredBranches.map(branch => ({
    label: branch,
    value: branch
  }));

  const handleSelect = (item: { label: string; value: string }) => {
    onSelect(item.value);
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      onExit();
    } else if (key.escape) {
      onExit();
    } else if (key.backspace || key.delete) {
      setFilter(filter.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setFilter(filter + input);
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Select a branch to create worktree from:</Text>
      </Box>
      
      {filter && (
        <Box marginBottom={1}>
          <Text>Filter: {filter}</Text>
        </Box>
      )}

      {items.length === 0 ? (
        <Text color="yellow">No branches match your filter</Text>
      ) : (
        <SelectInput
          items={items}
          onSelect={handleSelect}
          onHighlight={() => {}}
        />
      )}

      <Box marginTop={1}>
        <Text dimColor>
          Type to filter • ↑↓ Navigate • Enter Select • Ctrl-C Exit
        </Text>
      </Box>
    </Box>
  );
};