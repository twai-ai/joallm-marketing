import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { lazy, Suspense } from 'react';
import { ChatInterfaceNew as ChatInterface } from './components/chat/ChatInterfaceNew';
import { LoadingSkeleton } from './components/common/LoadingSkeleton';
import { BookmarksPanel } from './components/bookmarks/BookmarksPanel';

// Lazy load components for better performance
const WelcomePage = lazy(() => import('./pages/WelcomePage').then(module => ({ default: module.WelcomePage })));
const StudioOverviewPage = lazy(() => import('./pages/StudioOverviewPage').then(module => ({ default: module.StudioOverviewPage })));
const MediaAIPage = lazy(() => import('./pages/MediaAIPage').then(module => ({ default: module.MediaAIPage })));
const AcquisitionIntelligencePage = lazy(() => import('./pages/AcquisitionIntelligencePage').then(module => ({ default: module.AcquisitionIntelligencePage })));
const MarketingStudioPage = lazy(() => import('./pages/MarketingStudioPage').then(module => ({ default: module.MarketingStudioPage })));
const AcquisitionWorkspacePage = lazy(() => import('./pages/AcquisitionWorkspacePage').then(module => ({ default: module.AcquisitionWorkspacePage })));
const DocumentAIPage = lazy(() => import('./pages/DocumentAIPage').then(module => ({ default: module.DocumentAIPage })));
const StoryPage = lazy(() => import('./pages/StoryPage').then(module => ({ default: module.StoryPage })));
const StorySessionPage = lazy(() => import('./pages/StorySessionPage').then(module => ({ default: module.StorySessionPage })));
const MediaAssetPage = lazy(() => import('./pages/MediaAssetPage').then(module => ({ default: module.MediaAssetPage })));
const WorkflowFamilyPlaceholderPage = lazy(() => import('./pages/WorkflowFamilyPlaceholderPage').then(module => ({ default: module.WorkflowFamilyPlaceholderPage })));
const WorkflowBuilder = lazy(() => import('./components/workflow/WorkflowBuilder').then(module => ({ default: module.WorkflowBuilder })));
const NotebookInterface = lazy(() => import('./components/notebook/NotebookInterface').then(module => ({ default: module.NotebookInterface })));
const DocsInterface = lazy(() => import('./components/docs/DocsInterface').then(module => ({ default: module.DocsInterface })));
const JoaLLMFarm = lazy(() => import('./components/farm/JoaLLMFarm').then(module => ({ default: module.JoaLLMFarm })));
const KnowledgeManager = lazy(() => import('./components/knowledge/KnowledgeManagerNew').then(module => ({ default: module.KnowledgeManagerNew as any })));
const RAGSearchPage = lazy(() => import('./pages/RAGSearchPage').then(module => ({ default: module.RAGSearchPage })));
const SettingsPanel = lazy(() => import('./components/settings/SettingsPanel').then(module => ({ default: module.SettingsPanel })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(module => ({ default: module.RegisterPage })));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage').then(module => ({ default: module.UnauthorizedPage })));
const AuthCallback = lazy(() => import('./pages/AuthCallback').then(module => ({ default: module.AuthCallback })));

import { EnhancedUserRoleProvider } from './contexts/EnhancedUserRoleContext';
import { LLMProvider } from './contexts/LLMContext';
import { WorkflowProvider } from './contexts/WorkflowContext';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastProvider } from './utils/toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { CommandPalette } from './components/common/CommandPalette';
import { ProtectedRoute, AuthRoute } from './components/auth/ProtectedRoute';
import { RoleBasedOnboarding } from './components/onboarding/RoleBasedOnboarding';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export type ViewMode = 'welcome' | 'media-ai' | 'chat' | 'notebook' | 'workflow' | 'docs' | 'farm' | 'rag-search';
export type UserRole = 'developer' | 'analyst' | 'business' | 'casual';

// Create QueryClient instance for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function LegacyMediaRedirect() {
  const { fileId } = useParams();

  if (fileId) {
    return <Navigate to={`/studio/media-ai/${fileId}`} replace />;
  }

  return <Navigate to="/studio/media-ai" replace />;
}

function LegacyPeopleRedirect() {
  const { personId } = useParams();
  if (personId) {
    return <Navigate to={`/studio/people/${personId}`} replace />;
  }
  return <Navigate to="/studio/people" replace />;
}

function LegacyCampaignsRedirect() {
  const { programId } = useParams();
  if (programId) {
    return <Navigate to={`/studio/campaigns/${programId}`} replace />;
  }
  return <Navigate to="/studio/campaigns" replace />;
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'workspace' | 'models' | 'data' | 'security' | 'billing'>('workspace');
  const [knowledgeManagerOpen, setKnowledgeManagerOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

  const routeForView = (view: ViewMode) => {
    switch (view) {
      case 'welcome':
        return '/welcome';
      case 'media-ai':
        return '/studio/media-ai';
      case 'chat':
        return '/chat';
      case 'notebook':
        return '/notebook';
      case 'workflow':
        return '/studio';
      case 'docs':
        return '/docs';
      case 'farm':
        return '/farm';
      case 'rag-search':
        return '/rag-search';
      default:
        return '/welcome';
    }
  };

  // Keyboard shortcuts with actions
  const { shortcuts, isCommandPaletteOpen, setIsCommandPaletteOpen } = useKeyboardShortcuts({
    onToggleSidebar: () => setSidebarOpen(prev => !prev),
    onOpenSettings: () => setSettingsOpen(true),
    onNewChat: () => navigate('/chat'),
    onSwitchView: (view) => navigate(routeForView(view)),
    onToggleDocumentation: () => navigate('/docs'),
    onCloseModal: () => {
      if (settingsOpen) setSettingsOpen(false);
      if (knowledgeManagerOpen) setKnowledgeManagerOpen(false);
      if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
    },
    // Chat-specific actions will be handled by the chat component itself
  });

  // Determine current view from URL
  const getCurrentView = (): ViewMode => {
    const path = location.pathname;
    if (path === '/' || path === '/welcome') return 'welcome';
    if (path.startsWith('/media-ai')) return 'workflow';
    if (path.startsWith('/chat')) return 'chat';
    if (path.startsWith('/notebook')) return 'notebook';
    if (path.startsWith('/studio') || path.startsWith('/workflow')) return 'workflow';
    if (path.startsWith('/docs')) return 'docs';
    if (path.startsWith('/farm')) return 'farm';
    if (path.startsWith('/rag-search')) return 'rag-search';
    return 'welcome';
  };

  const currentView = getCurrentView();
  const isBareAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/unauthorized' ||
    location.pathname.startsWith('/auth/');

  const handleViewChange = (view: ViewMode) => {
    navigate(routeForView(view));
  };

  // Update shortcuts with actual actions
  useEffect(() => {
    // This would normally be handled by the components themselves
    // but for now, we'll keep it simple
  }, []);

  // Listen for custom sidebar toggle events from child components
  useEffect(() => {
    const handleToggleSidebar = () => {
      setSidebarOpen(prev => !prev);
    };

    const handleNavigateToView = (event: CustomEvent) => {
      const view = event.detail?.view;
      if (view) {
        handleViewChange(view);
      }
    };

    const handleOpenUpgrade = () => {
      setSettingsInitialTab('billing');
      setSettingsOpen(true);
    };

    const handleOpenSettings = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: 'workspace' | 'models' | 'data' | 'security' | 'billing' }>).detail;
      setSettingsInitialTab(detail?.tab ?? 'workspace');
      setSettingsOpen(true);
    };

    window.addEventListener('toggleSidebar', handleToggleSidebar);
    window.addEventListener('navigateToView', handleNavigateToView as EventListener);
    window.addEventListener('openUpgrade', handleOpenUpgrade);
    window.addEventListener('openSettings', handleOpenSettings);
    
    return () => {
      window.removeEventListener('toggleSidebar', handleToggleSidebar);
      window.removeEventListener('navigateToView', handleNavigateToView as EventListener);
      window.removeEventListener('openUpgrade', handleOpenUpgrade);
      window.removeEventListener('openSettings', handleOpenSettings);
    };
  }, []);

  return (
    <div className="app-shell-bg flex min-h-screen min-h-[100dvh] overflow-x-hidden md:h-screen md:overflow-hidden">
      {/* Sidebar — only for authenticated app surfaces, not login/register */}
      {!isBareAuthRoute && (
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          currentView={currentView}
          onViewChange={handleViewChange}
          onQuickPrompt={() => {}}
          onOpenKnowledge={() => setKnowledgeManagerOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCreativeSettings={() => {
            setSettingsInitialTab('models');
            setSettingsOpen(true);
          }}
          onOpenBookmarks={() => setBookmarksOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!isBareAuthRoute && (
          <Header
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenKnowledge={() => setKnowledgeManagerOpen(true)}
            currentView={currentView}
          />
        )}

        {/* Content */}
        <MainContent>
          <Suspense fallback={<LoadingSkeleton />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={
                <AuthRoute>
                  <LoginPage />
                </AuthRoute>
              } />
              <Route path="/register" element={
                <AuthRoute>
                  <RegisterPage />
                </AuthRoute>
              } />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/error" element={<AuthCallback />} />

              {/* Protected Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <WelcomePage />
                </ProtectedRoute>
              } />
              <Route path="/welcome" element={
                <ProtectedRoute>
                  <WelcomePage />
                </ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute>
                  <ChatInterface />
                </ProtectedRoute>
              } />
              <Route path="/chat/:sessionId" element={
                <ProtectedRoute>
                  <ChatInterface />
                </ProtectedRoute>
              } />
              <Route path="/media-ai" element={
                <ProtectedRoute>
                  <Navigate to="/studio/media-ai" replace />
                </ProtectedRoute>
              } />
              <Route path="/studio/media" element={
                <ProtectedRoute>
                  <LegacyMediaRedirect />
                </ProtectedRoute>
              } />
              <Route path="/studio/media-ai" element={
                <ProtectedRoute>
                  <MediaAIPage />
                </ProtectedRoute>
              } />
              <Route path="/studio/media/:fileId" element={
                <ProtectedRoute>
                  <LegacyMediaRedirect />
                </ProtectedRoute>
              } />
              <Route path="/studio/media-ai/:fileId" element={
                <ProtectedRoute>
                  <MediaAssetPage />
                </ProtectedRoute>
              } />
              <Route path="/studio/people" element={
                <ProtectedRoute>
                  <AcquisitionIntelligencePage />
                </ProtectedRoute>
              } />
              <Route path="/studio/people/:personId" element={
                <ProtectedRoute>
                  <AcquisitionIntelligencePage />
                </ProtectedRoute>
              } />
              <Route path="/studio/campaigns" element={
                <ProtectedRoute>
                  <MarketingStudioPage />
                </ProtectedRoute>
              } />
              <Route path="/studio/campaigns/:programId" element={
                <ProtectedRoute>
                  <AcquisitionWorkspacePage />
                </ProtectedRoute>
              } />
              <Route path="/studio/story" element={
                <ProtectedRoute>
                  <StoryPage />
                </ProtectedRoute>
              } />
              <Route path="/studio/story/:storyId" element={
                <ProtectedRoute>
                  <StorySessionPage />
                </ProtectedRoute>
              } />
              {/* Legacy aliases — keep bookmarks working */}
              <Route path="/studio/acquisition" element={
                <ProtectedRoute>
                  <Navigate to="/studio/people" replace />
                </ProtectedRoute>
              } />
              <Route path="/studio/acquisition/:personId" element={
                <ProtectedRoute>
                  <LegacyPeopleRedirect />
                </ProtectedRoute>
              } />
              <Route path="/studio/marketing" element={
                <ProtectedRoute>
                  <Navigate to="/studio/campaigns" replace />
                </ProtectedRoute>
              } />
              <Route path="/studio/marketing/:programId" element={
                <ProtectedRoute>
                  <LegacyCampaignsRedirect />
                </ProtectedRoute>
              } />
              <Route path="/document-ai" element={
                <ProtectedRoute>
                  <Navigate to="/studio/document-ai" replace />
                </ProtectedRoute>
              } />
              <Route path="/studio/document-ai" element={
                <ProtectedRoute>
                  <DocumentAIPage />
                </ProtectedRoute>
              } />
              <Route path="/:familyId(document-ai|docs-ai|data-intelligence)" element={
                <ProtectedRoute>
                  <WorkflowFamilyPlaceholderPage />
                </ProtectedRoute>
              } />
              <Route path="/studio/:familyId(document-ai|docs-ai|data-intelligence)" element={
                <ProtectedRoute>
                  <WorkflowFamilyPlaceholderPage />
                </ProtectedRoute>
              } />
              <Route path="/studio/docs-ai" element={
                <ProtectedRoute>
                  <Navigate to="/studio/document-ai" replace />
                </ProtectedRoute>
              } />
              <Route path="/notebook" element={
                <ProtectedRoute>
                  <NotebookInterface />
                </ProtectedRoute>
              } />
              <Route path="/notebook/:notebookId" element={
                <ProtectedRoute>
                  <NotebookInterface />
                </ProtectedRoute>
              } />
              <Route path="/workflow" element={
                <ProtectedRoute>
                  <WorkflowBuilder />
                </ProtectedRoute>
              } />
              <Route path="/workflow/:workflowId" element={
                <ProtectedRoute>
                  <WorkflowBuilder />
                </ProtectedRoute>
              } />
              <Route path="/studio" element={
                <ProtectedRoute>
                  <StudioOverviewPage />
                </ProtectedRoute>
              } />
              <Route path="/studio/custom" element={
                <ProtectedRoute>
                  <WorkflowBuilder />
                </ProtectedRoute>
              } />
              <Route path="/studio/custom/:workflowId" element={
                <ProtectedRoute>
                  <WorkflowBuilder />
                </ProtectedRoute>
              } />
              <Route path="/docs" element={
                <ProtectedRoute>
                  <DocsInterface />
                </ProtectedRoute>
              } />
              <Route path="/farm" element={
                <ProtectedRoute>
                  <JoaLLMFarm />
                </ProtectedRoute>
              } />
              <Route path="/rag-search" element={
                <ProtectedRoute>
                  <RAGSearchPage onUpgrade={() => { setSettingsInitialTab('billing'); setSettingsOpen(true); }} />
                </ProtectedRoute>
              } />
              <Route path="/rag-search/:sessionId" element={
                <ProtectedRoute>
                  <RAGSearchPage onUpgrade={() => { setSettingsInitialTab('billing'); setSettingsOpen(true); }} />
                </ProtectedRoute>
              } />
            </Routes>
          </Suspense>
        </MainContent>
      </div>

      {/* Settings Panel */}
      <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><LoadingSkeleton /></div>}>
        {settingsOpen && (
          <SettingsPanel
            isOpen={settingsOpen}
            onClose={() => { setSettingsOpen(false); setSettingsInitialTab('workspace'); }}
            initialTab={settingsInitialTab}
          />
        )}
      </Suspense>

      {/* Knowledge Manager */}
      <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><LoadingSkeleton /></div>}>
        {knowledgeManagerOpen && (
          <KnowledgeManager
            isOpen={knowledgeManagerOpen}
            onClose={() => setKnowledgeManagerOpen(false)}
          />
        )}
      </Suspense>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        shortcuts={shortcuts}
      />

      {/* Bookmarks Panel */}
      <BookmarksPanel
        isOpen={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
      />

      {/* Role-Based Onboarding */}
      <RoleBasedOnboarding />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <EnhancedUserRoleProvider>
              <LLMProvider>
                <WorkflowProvider>
                  <ToastProvider />
                  <AppLayout />
                </WorkflowProvider>
              </LLMProvider>
            </EnhancedUserRoleProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;// Deployment trigger - includes all UI/UX improvements
