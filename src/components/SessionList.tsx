import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { exportSession } from '../services/export';
import { formatDistanceToNow } from 'date-fns';
import type { SessionInfo } from '../../shared/types';
import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Stack,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import LoadingIcon from '@mui/icons-material/HourglassEmpty';
import Pagination from './Pagination';

interface SessionListProps {
  selectedProject?: string;
  searchQuery?: string;
}

const DEFAULT_ROWS_PER_PAGE = 20;
const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function SessionList({ selectedProject, searchQuery }: SessionListProps) {
  const [exportingSession, setExportingSession] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = localStorage.getItem('sessions-per-page');
    return saved ? parseInt(saved, 10) : DEFAULT_ROWS_PER_PAGE;
  });

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [selectedProject, searchQuery]);

  // Persist rows per page to localStorage
  useEffect(() => {
    localStorage.setItem('sessions-per-page', rowsPerPage.toString());
  }, [rowsPerPage]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions', selectedProject, searchQuery, page, rowsPerPage],
    queryFn: () => api.getSessions({
      project: selectedProject,
      search: searchQuery,
      limit: rowsPerPage,
      offset: page * rowsPerPage,
    }),
    staleTime: 30000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: undefined,
  });

  const sessions = data?.sessions ?? [];
  const totalSessions = data?.total ?? 0;

  const getProjectName = (path: string) => {
    return path.split('/').pop() || path;
  };

  const handleExport = async (e: React.MouseEvent, sessionId: string, project: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExportingSession(sessionId);
    try {
      await exportSession(sessionId, project);
    } catch {
      alert('Failed to export session');
    } finally {
      setExportingSession(null);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Error loading sessions: {(error as Error).message}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Sessions
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          {totalSessions.toLocaleString()} sessions
        </Typography>
      </Stack>

      <Stack spacing={1} key={`page-${page}-${rowsPerPage}`}>
        {sessions.map((session: SessionInfo) => (
          <Card
            key={session.sessionId}
            component={Link}
            to={`/session/${session.sessionId}?project=${encodeURIComponent(session.project)}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
              border: 1,
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'primary.light',
                transform: 'translateY(-1px)',
              },
            }}
          >
            <CardContent sx={{ flex: 1, minWidth: 0, p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Chip
                  label={getProjectName(session.project)}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    height: 24,
                  }}
                />
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
                  {formatDistanceToNow(new Date(session.timestamp), { addSuffix: true })}
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {session.display || 'No description'}
              </Typography>
            </CardContent>
            <Box sx={{ p: 1, pr: 2 }}>
              <IconButton
                onClick={(e) => handleExport(e, session.sessionId, session.project)}
                disabled={exportingSession === session.sessionId}
                title="Export session data"
                size="small"
                sx={{
                  color: 'text.disabled',
                  '&:hover:not(:disabled)': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                  },
                  '&:disabled': {
                    opacity: 0.6,
                  },
                }}
              >
                {exportingSession === session.sessionId ? <LoadingIcon /> : <DownloadIcon />}
              </IconButton>
            </Box>
          </Card>
        ))}

        {sessions.length === 0 && !isLoading && (
          <Box sx={{ textAlign: 'center', py: 7.5, color: 'text.disabled' }}>
            <Typography>No sessions found</Typography>
          </Box>
        )}
      </Stack>

      {totalSessions > 0 && (
        <Stack spacing={2} sx={{ mt: 3 }} alignItems="center">
          {/* Rows per page selector */}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', justifyContent: 'flex-end' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              Sessions per page:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0);
                }}
                sx={{ fontSize: '0.875rem' }}
              >
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option} sx={{ fontSize: '0.875rem' }}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Page number navigation */}
          <Pagination
            count={totalSessions}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
          />
        </Stack>
      )}
    </Box>
  );
}
