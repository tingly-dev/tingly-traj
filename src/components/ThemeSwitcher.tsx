import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Palette } from '@mui/icons-material';
import { useThemeContext, type ThemeName } from '../contexts/ThemeContext';

const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useThemeContext();

  const toggleTheme = () => {
    setTheme(theme === 'purple' ? 'claude' : 'purple');
  };

  const getThemeLabel = (currentTheme: ThemeName): string => {
    return currentTheme === 'purple' ? 'Purple Theme' : 'Claude Code Theme';
  };

  return (
    <Tooltip title={`Switch to ${getThemeLabel(theme === 'purple' ? 'purple' : 'claude')}`}>
      <IconButton
        onClick={toggleTheme}
        sx={{
          color: 'text.primary',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
        aria-label="Toggle theme"
      >
        <Palette />
      </IconButton>
    </Tooltip>
  );
};

export default ThemeSwitcher;
