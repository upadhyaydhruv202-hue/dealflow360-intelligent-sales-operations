import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthProvider';
import { FeatureGate, FeatureProvider } from './features';
import { AppLayout } from './layouts/AppLayout';
import { AutomationsPage } from './pages/AutomationsPage';
import { CopilotPage } from './pages/CopilotPage';
import { IntentsPage } from './pages/IntentsPage';
import { ProblemIntelligencePage } from './pages/ProblemIntelligencePage';
import { CapabilityRecommendationsPage } from './pages/CapabilityRecommendationsPage';
import { ProjectPlanningPage } from './pages/ProjectPlanningPage';
import { ProjectGeneratorPage } from './pages/ProjectGeneratorPage';
import { RagPage } from './pages/RagPage';
import { SearchPage } from './pages/SearchPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AnomalyPage } from './pages/AnomalyPage';
import { RealtimePage } from './pages/RealtimePage';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { UiKitPage } from './pages/UiKitPage';
import { CustomerAccountPage, CustomerPortalPage, problemRoutes } from './problem';
import { ApiClientProvider } from './services/api';
import { ThemeProvider, ToastProvider } from './ui';

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ApiClientProvider>
            <FeatureProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                  <Route path="/portal/:token" element={<CustomerPortalPage />} />
                  <Route path="/account" element={<CustomerAccountPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/ui" element={<UiKitPage />} />
                    <Route
                      path="/copilot"
                      element={
                        <FeatureGate feature="copilot">
                          <CopilotPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/intents"
                      element={
                        <FeatureGate feature="intents">
                          <IntentsPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/problem-intelligence"
                      element={
                        <FeatureGate feature="problemIntelligence">
                          <ProblemIntelligencePage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/capability-recommendations"
                      element={
                        <FeatureGate feature="capabilityRecommendations">
                          <CapabilityRecommendationsPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/project-planning"
                      element={
                        <FeatureGate feature="projectPlanning">
                          <ProjectPlanningPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/project-generator"
                      element={
                        <FeatureGate feature="projectGenerator">
                          <ProjectGeneratorPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/rag"
                      element={
                        <FeatureGate feature="rag">
                          <RagPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/search"
                      element={
                        <FeatureGate feature="search">
                          <SearchPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/analytics"
                      element={
                        <FeatureGate feature="analytics">
                          <AnalyticsPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/anomalies"
                      element={
                        <FeatureGate feature="anomalyDetection">
                          <AnomalyPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/realtime"
                      element={
                        <FeatureGate feature="realtime">
                          <RealtimePage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="/automations"
                      element={
                        <FeatureGate feature="automation">
                          <AutomationsPage />
                        </FeatureGate>
                      }
                    />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    {problemRoutes.map((route) => (
                      <Route key={route.path} path={route.path} element={route.element} />
                    ))}
                  </Route>
                </Routes>
              </BrowserRouter>
            </FeatureProvider>
          </ApiClientProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
