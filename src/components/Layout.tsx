import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ProjectSummary } from '../../shared/types';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import ThemeSwitcher from './ThemeSwitcher';

interface LayoutProps {
  onProjectChange: (project: string | undefined) => void;
  onSearchChange: (search: string) => void;
}

export default function Layout({ onProjectChange, onSearchChange }: LayoutProps) {
  const navigate = useNavigate();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  const handleProjectChange = (value: string) => {
    onProjectChange(value === 'all' ? undefined : value);
    navigate('/');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
    navigate('/');
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AppBar
        position="static"
        sx={{
          width: 280,
          bgcolor: 'background.default',
          borderRight: 1,
          borderColor: 'divider',
          boxShadow: 'none',
          flexShrink: 0,
        }}
      >
        <Toolbar sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', mb: 0.5 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                cc-pick
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                Claude Code Session Viewer
              </Typography>
            </Box>
            <ThemeSwitcher />
          </Box>
        </Toolbar>

        <Box sx={{ px: 2.5, flex: 1, overflowY: 'auto' }}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              id="search"
              type="text"
              placeholder="Search sessions..."
              onChange={handleSearchChange}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiInputBase-root': {
                  bgcolor: '#2a2a2a',
                  '&:hover': {
                    bgcolor: '#2a2a2a',
                  },
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'divider',
                },
              }}
            />
          </Box>

          <FormControl fullWidth size="small">
            <InputLabel id="project-label">Project</InputLabel>
            <Select
              labelId="project-label"
              id="project"
              label="Project"
              onChange={(e) => handleProjectChange(e.target.value as string)}
              sx={{
                bgcolor: '#2a2a2a',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'divider',
                },
              }}
            >
              <MenuItem value="all">All Projects</MenuItem>
              {projects?.map((project: ProjectSummary) => (
                <MenuItem key={project.path} value={project.path}>
                  {project.name} ({project.sessionCount})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </Box>

        <List sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/" sx={{ borderRadius: 1 }}>
              <ListItemText primary="Sessions" />
            </ListItemButton>
          </ListItem>
        </List>
      </AppBar>

      <Box
        component="main"
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: 'background.default',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
