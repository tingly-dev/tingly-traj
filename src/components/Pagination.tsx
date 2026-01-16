import { Box, IconButton, TextField, Stack, Typography } from '@mui/material';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { useState, useCallback, type KeyboardEvent } from 'react';

interface PageButton {
  type: 'page' | 'ellipsis' | 'first' | 'last';
  value?: number;
}

interface PaginationProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
}

// Generate page numbers to display with smart ellipsis
function generatePageNumbers(currentPage: number, totalPages: number): PageButton[] {
  const pages: PageButton[] = [];
  const maxButtons = 7; // Maximum number of page buttons to show

  if (totalPages <= maxButtons) {
    // Show all pages if total is less than max
    for (let i = 0; i < totalPages; i++) {
      pages.push({ type: 'page', value: i });
    }
  } else {
    // Always show first page
    pages.push({ type: 'page', value: 0 });

    if (currentPage <= 3) {
      // Near the beginning: 1, 2, 3, 4, 5, ... last
      for (let i = 1; i <= 4; i++) {
        pages.push({ type: 'page', value: i });
      }
      pages.push({ type: 'ellipsis' });
      pages.push({ type: 'last', value: totalPages - 1 });
    } else if (currentPage >= totalPages - 4) {
      // Near the end: first, ... last-5, last-4, last-3, last-2, last-1, last
      pages.push({ type: 'ellipsis' });
      for (let i = totalPages - 5; i < totalPages; i++) {
        pages.push({ type: 'page', value: i });
      }
    } else {
      // Middle: first, ... current-1, current, current+1, ... last
      pages.push({ type: 'ellipsis' });
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        pages.push({ type: 'page', value: i });
      }
      pages.push({ type: 'ellipsis' });
      pages.push({ type: 'last', value: totalPages - 1 });
    }
  }

  return pages;
}

export default function Pagination({ count, page, rowsPerPage, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(count / rowsPerPage) || 1;
  const pageNumbers = generatePageNumbers(page, totalPages);
  const [jumpInput, setJumpInput] = useState('');

  const handleJumpToPage = useCallback(() => {
    const pageNum = parseInt(jumpInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum - 1);
      setJumpInput('');
    }
  }, [jumpInput, totalPages, onPageChange]);

  const handleJumpKeyPress = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleJumpToPage();
      }
    },
    [handleJumpToPage],
  );

  const PageButton = ({
    pageNum,
    isActive,
    isDisabled,
  }: {
    pageNum: number;
    isActive: boolean;
    isDisabled?: boolean;
  }) => (
    <Box
      onClick={() => !isDisabled && !isActive && onPageChange(pageNum)}
      sx={{
        minWidth: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 1,
        fontSize: '0.875rem',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'primary.contrastText' : 'text.primary',
        bgcolor: isActive ? 'primary.main' : 'transparent',
        cursor: isDisabled || isActive ? 'default' : 'pointer',
        userSelect: 'none',
        transition: 'all 0.15s ease',
        border: isActive ? 'none' : 1,
        borderColor: 'divider',
        '&:hover': !isDisabled && !isActive
          ? {
              bgcolor: 'action.hover',
              borderColor: 'primary.light',
            }
          : {},
      }}
    >
      {pageNum + 1}
    </Box>
  );

  const NavButton = ({
    direction,
    isDisabled,
    onNavigate,
  }: {
    direction: 'prev' | 'next' | 'first' | 'last';
    isDisabled: boolean;
    onNavigate: () => void;
  }) => {
    const icons = {
      first: <KeyboardDoubleArrowLeftIcon fontSize="small" />,
      prev: <KeyboardArrowLeftIcon fontSize="small" />,
      next: <KeyboardArrowRightIcon fontSize="small" />,
      last: <KeyboardDoubleArrowRightIcon fontSize="small" />,
    };

    return (
      <IconButton
        onClick={onNavigate}
        disabled={isDisabled}
        size="small"
        sx={{
          width: 36,
          height: 36,
          border: 1,
          borderColor: 'divider',
          '&:hover:not(:disabled)': {
            bgcolor: 'action.hover',
            borderColor: 'primary.light',
          },
        }}
      >
        {icons[direction]}
      </IconButton>
    );
  };

  return (
    <Stack spacing={2} alignItems="center">
      {/* Page number navigation */}
      <Stack spacing={1} direction="row" alignItems="center">
        <NavButton
          direction="first"
          isDisabled={page === 0}
          onNavigate={() => onPageChange(0)}
        />
        <NavButton
          direction="prev"
          isDisabled={page === 0}
          onNavigate={() => onPageChange(page - 1)}
        />

        <Stack spacing={0.5} direction="row" alignItems="center">
          {pageNumbers.map((btn, idx) => {
            if (btn.type === 'ellipsis') {
              return (
                <Box
                  key={`ellipsis-${idx}`}
                  sx={{
                    minWidth: 36,
                    display: 'flex',
                    justifyContent: 'center',
                    color: 'text.disabled',
                  }}
                >
                  ...
                </Box>
              );
            }

            const pageNum = btn.value!;
            return (
              <PageButton
                key={`page-${pageNum}`}
                pageNum={pageNum}
                isActive={pageNum === page}
                isDisabled={false}
              />
            );
          })}
        </Stack>

        <NavButton
          direction="next"
          isDisabled={page >= totalPages - 1}
          onNavigate={() => onPageChange(page + 1)}
        />
        <NavButton
          direction="last"
          isDisabled={page >= totalPages - 1}
          onNavigate={() => onPageChange(totalPages - 1)}
        />
      </Stack>

      {/* Jump to page input */}
      <Stack spacing={1} direction="row" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
          Jump to page:
        </Typography>
        <TextField
          size="small"
          value={jumpInput}
          onChange={(e) => setJumpInput(e.target.value)}
          onKeyDown={handleJumpKeyPress}
          placeholder={`${page + 1}/${totalPages}`}
          sx={{
            width: 100,
            '& .MuiInputBase-input': {
              fontSize: '0.875rem',
              py: 0.5,
              px: 1,
            },
          }}
        />
      </Stack>
    </Stack>
  );
}
