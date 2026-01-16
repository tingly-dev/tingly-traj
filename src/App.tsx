import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { useState } from 'react';
import { themes } from './theme';
import { ThemeProvider as CustomThemeProvider, useThemeContext } from './contexts/ThemeContext';
import Layout from './components/Layout';
import SessionList from './components/SessionList';
import SessionDetail from './components/SessionDetail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const { theme: themeName } = useThemeContext();

  return (
    <ThemeProvider theme={themes[themeName]}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout onProjectChange={setSelectedProject} onSearchChange={setSearchQuery} />}>
            <Route index element={<SessionList selectedProject={selectedProject} searchQuery={searchQuery} />}></Route>
            <Route path="session/:sessionId" element={<SessionDetail />}></Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function App() {
  return (
    <CustomThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </CustomThemeProvider>
  );
}

export default App;
