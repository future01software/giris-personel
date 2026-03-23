// Deployment Trigger: 2026-02-02-22-48
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';

import Layout from './components/Layout';
import PageTransition from './components/PageTransition';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// Lazy Load Pages
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Personnel = lazy(() => import('./pages/Personnel'));
const PersonnelAdd = lazy(() => import('./pages/PersonnelAdd'));
const PersonnelDetail = lazy(() => import('./pages/PersonnelDetail'));
const EntryCheck = lazy(() => import('./pages/EntryCheck'));
const SecurityCheck = lazy(() => import('./pages/SecurityCheck'));
const EntryLogs = lazy(() => import('./pages/EntryLogs'));
const EntryLogsSearch = lazy(() => import('./pages/EntryLogsSearch'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const Alerts = lazy(() => import('./pages/Alerts'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#050505]">
    <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const RoleBasedRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role === 'security') {
    return <Navigate to="/security-check" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

// Wrapper for Layout to use Outlet
const LayoutWrapper = () => (
  <Layout>
    <Outlet />
  </Layout>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <Landing />
            </PageTransition>
          }
        />

        <Route
          path="/login"
          element={
            <PageTransition>
              <Login />
            </PageTransition>
          }
        />

        <Route
          path="/reset-password"
          element={
            <PageTransition>
              <ResetPassword />
            </PageTransition>
          }
        />

        {/* Login sonrası yönlendirme için tek merkez */}
        <Route path="/app" element={<RoleBasedRedirect />} />

        {/* Persistent Layout for all protected pages */}
        <Route element={<LayoutWrapper />}>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
                <PageTransition>
                  <Dashboard />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path="/personnel"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PageTransition>
                  <Personnel />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path="/personnel/add"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PageTransition>
                  <PersonnelAdd />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path="/personnel/:id"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PageTransition>
                  <PersonnelDetail />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path="/entry-check"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PageTransition>
                  <EntryCheck />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path="/security-check"
            element={
              <ProtectedRoute allowedRoles={['security']}>
                <PageTransition>
                  <SecurityCheck />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path="/entry-logs"
            element={
              <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
                <PageTransition>
                  <EntryLogs />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path="/entry-logs/search"
            element={
              <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
                <PageTransition>
                  <EntryLogsSearch />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PageTransition>
                  <Settings />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PageTransition>
                  <Users />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          <Route
            path="/alerts"
            element={
              <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
                <PageTransition>
                  <Alerts />
                </PageTransition>
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AlertProvider>
        <WebSocketProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
              <AnimatedRoutes />
            </Suspense>
          </BrowserRouter>
          <Toaster position="top-right" />
        </WebSocketProvider>
      </AlertProvider>
    </AuthProvider>
  );
};

export default App;