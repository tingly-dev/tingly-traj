import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

export const purpleDarkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0d0d0d',
      paper: '#1a1a1a',
    },
    primary: {
      main: '#7c3aed',
      light: '#8b5cf6',
    },
    divider: '#333',
    text: {
      primary: '#fff',
      secondary: '#ccc',
      disabled: '#888',
    },
    success: {
      main: '#22c55e',
    },
    info: {
      main: '#3b82f6',
    },
    error: {
      main: '#f87171',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            borderRadius: 6,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
  },
});

export const claudeCodeTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#1a1a1a',
      paper: '#242424',
    },
    primary: {
      main: '#d97706',
      light: '#f59e0b',
    },
    divider: '#404040',
    text: {
      primary: '#e5e5e5',
      secondary: '#a3a3a3',
      disabled: '#737373',
    },
    success: {
      main: '#22c55e',
    },
    info: {
      main: '#3b82f6',
    },
    error: {
      main: '#ef4444',
    },
  },
  typography: {
    fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", "Menlo", monospace',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'border-color 0.2s ease-in-out',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          textTransform: 'none',
          fontWeight: 500,
        },
        contained: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            borderRadius: 4,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
  },
});

export const defaultTheme = purpleDarkTheme;

export type ThemeName = 'purple' | 'claude';

export const themes: Record<ThemeName, Theme> = {
  purple: purpleDarkTheme,
  claude: claudeCodeTheme,
};
