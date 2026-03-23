import React, { useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getTheme } from './theme';
import Layout from './components/Layout';
import TestForm from './components/TestForm';
import ProgressSection from './components/ProgressSection';
import ResultsSection from './components/ResultsSection';
import ErrorSection from './components/ErrorSection';
import ReportsPage from './components/ReportsPage';

type Page = 'home' | 'reports';
type TestState = 'idle' | 'running' | 'done' | 'error';

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [page, setPage] = useState<Page>('home');
  const [testState, setTestState] = useState<TestState>('idle');
  const [currentTestId, setCurrentTestId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  const theme = getTheme(mode);

  const handleTestStart = (testId: string) => {
    setCurrentTestId(testId);
    setTestState('running');
  };

  const handleError = (msg: string) => {
    setErrorMsg(msg);
    setTestState('error');
  };

  const handleComplete = () => {
    setTestState('done');
  };

  const handleNewTest = () => {
    setTestState('idle');
    setCurrentTestId('');
    setErrorMsg('');
  };

  const renderHome = () => {
    switch (testState) {
      case 'running':
        return (
          <ProgressSection
            testId={currentTestId}
            onComplete={handleComplete}
            onError={handleError}
          />
        );
      case 'done':
        return <ResultsSection testId={currentTestId} onNewTest={handleNewTest} />;
      case 'error':
        return <ErrorSection message={errorMsg} onRetry={handleNewTest} />;
      default:
        return <TestForm onTestStart={handleTestStart} onError={handleError} />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout
        page={page}
        onNavigate={(p) => { setPage(p); if (p === 'home' && testState !== 'running') setTestState('idle'); }}
        onToggleTheme={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}
        mode={mode}
      >
        {page === 'home' ? renderHome() : <ReportsPage />}
      </Layout>
    </ThemeProvider>
  );
}
