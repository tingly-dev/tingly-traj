import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { exportSession } from '../services/export';
import { formatDistanceToNow } from 'date-fns';
import type { SessionDetail, Message } from '../../shared/types';
import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Avatar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FolderIcon from '@mui/icons-material/Folder';

export default function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);

  // Get project from URL query parameter
  const project = searchParams.get('project') || undefined;

  const { data: session, isLoading, error } = useQuery({
    queryKey: ['session', sessionId, project],
    queryFn: () => api.getSession(sessionId!, project!),
    enabled: !!sessionId && !!project,
  });

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !session) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Error loading session</Alert>
        <Button
          component={Link}
          to="/"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to sessions
        </Button>
      </Box>
    );
  }

  const getProjectName = (path: string) => {
    return path.split('/').pop() || path;
  };

  const handleExport = async () => {
    if (!sessionId || !project) return;
    setIsExporting(true);
    try {
      await exportSession(sessionId, project);
    } catch {
      alert('Failed to export session');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button
          onClick={() => navigate(-1)}
          startIcon={<ArrowBackIcon />}
          variant="outlined"
          size="small"
        >
          Back
        </Button>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            onClick={handleExport}
            disabled={isExporting}
            variant="outlined"
            startIcon={isExporting ? <CircularProgress size={16} /> : <DownloadIcon />}
            size="small"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              icon={<FolderIcon sx={{ fontSize: 16 }} />}
              label={getProjectName(session.project)}
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                height: 24,
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
            </Typography>
          </Stack>
        </Stack>
      </Stack>

      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
        {session.display || 'Untitled Session'}
      </Typography>

      <Stack spacing={2}>
        {session.messages.map((message: Message, index: number) => (
          <MessageBubble key={`${message.messageId}-${index}`} message={message} />
        ))}
      </Stack>
    </Box>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.type === 'file-history-snapshot') {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: 'primary.main',
          opacity: 0.05,
          borderColor: 'primary.main',
          borderStyle: 'dashed',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'primary.main' }}>
          <FolderIcon fontSize="small" />
          <Typography variant="body2">File History Snapshot</Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </Typography>
      </Paper>
    );
  }

  const isUser = message.type === 'user';

  // Handle different content types
  let contentText: string;
  if (typeof message.content === 'string') {
    contentText = message.content;
  } else if (typeof message.content === 'object' && message.content !== null) {
    // Handle structured content (e.g., {type: 'text', text: '...'})
    const contentObj = message.content as Record<string, unknown>;
    if ('text' in contentObj && typeof contentObj.text === 'string') {
      contentText = contentObj.text;
    } else {
      contentText = JSON.stringify(message.content, null, 2);
    }
  } else {
    contentText = String(message.content ?? '');
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: isUser ? 'background.paper' : '#121212',
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Avatar
            sx={{
              width: 24,
              height: 24,
              bgcolor: isUser ? 'success.main' : 'info.main',
            }}
          >
            {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
          </Avatar>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: isUser ? 'success.main' : 'info.main',
            }}
          >
            {isUser ? 'You' : 'Claude'}
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </Typography>
      </Stack>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {contentText}
      </Typography>
    </Paper>
  );
}
