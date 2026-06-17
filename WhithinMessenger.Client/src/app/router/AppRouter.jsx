import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthContext } from '../../shared/lib/contexts/AuthContext';
import { LoginPage } from '../../pages/login/ui';
import { RegisterPage } from '../../pages/register/ui';
import { ConfirmEmailPage } from '../../pages/confirm-email/ui';
import { ConfirmEmailChangePage } from '../../pages/confirm-email-change/ui';
import { ConfirmPasswordChangePage } from '../../pages/confirm-password-change/ui';
import { ForgotPasswordPage } from '../../pages/forgot-password/ui';
import { ResetPasswordPage } from '../../pages/reset-password/ui';
import { HomePage } from '../../pages/home/ui';
import { ServerSettingsPage } from '../../pages/server-settings/ui';
import StartupPreloader from '../../shared/ui/organisms/StartupPreloader/StartupPreloader';
import SeoRouteSync from '../../shared/lib/seo/SeoRouteSync';
import { DesktopNotificationSync } from '../../shared/lib/hooks/DesktopNotificationSync';
import { DesktopCallOverlaySync } from '../../shared/lib/hooks/DesktopCallOverlaySync';
import { DesktopActiveCallOverlaySync } from '../../shared/lib/hooks/DesktopActiveCallOverlaySync';

const AppRouter = () => {
  const { isAuthenticated, isLoading } = useAuthContext();
  const [isMinBootTimePassed, setIsMinBootTimePassed] = useState(false);
  const [isBootExiting, setIsBootExiting] = useState(false);
  const [isBootCompleted, setIsBootCompleted] = useState(false);

  useEffect(() => {
    const minDisplayTimer = window.setTimeout(() => {
      setIsMinBootTimePassed(true);
    }, 10000);

    return () => {
      window.clearTimeout(minDisplayTimer);
    };
  }, []);

  useEffect(() => {
    if (isBootCompleted || isBootExiting || !isMinBootTimePassed || isLoading) {
      return undefined;
    }

    setIsBootExiting(true);
    const exitTimer = window.setTimeout(() => {
      setIsBootCompleted(true);
    }, 420);

    return () => {
      window.clearTimeout(exitTimer);
    };
  }, [isBootCompleted, isBootExiting, isLoading, isMinBootTimePassed]);

  const shouldShowBootPreloader = !isBootCompleted;

  if (shouldShowBootPreloader) {
    // Continue rendering below; preloader is rendered as overlay.
  }

  return (
    <>
      <Router>
        <SeoRouteSync />
        <DesktopNotificationSync />
        <DesktopCallOverlaySync />
        <DesktopActiveCallOverlaySync />
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
            } 
          />
          <Route 
            path="/register" 
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />
            } 
          />
          <Route
            path="/confirm-email"
            element={<ConfirmEmailPage />}
          />
          <Route
            path="/confirm-email-change"
            element={<ConfirmEmailChangePage />}
          />
          <Route
            path="/confirm-password-change"
            element={<ConfirmPasswordChangePage />}
          />
          <Route
            path="/forgot-password"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <ForgotPasswordPage />
            }
          />
          <Route
            path="/reset-password"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <ResetPasswordPage />
            }
          />
          <Route 
            path="/" 
            element={
              isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/server/:serverId" 
            element={
              isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/server/:serverId/channel/:channelId" 
            element={
              isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/chat/:chatId" 
            element={
              isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/channels/@me" 
            element={
              isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/channels/@me/friends" 
            element={
              isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/channels/@me/:chatId" 
            element={
              isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/server/:serverId/settings" 
            element={
              isAuthenticated ? <ServerSettingsPage /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="*" 
            element={
              <Navigate to={isAuthenticated ? "/" : "/login"} replace />
            } 
          />
        </Routes>
      </Router>

      {shouldShowBootPreloader && (
        <StartupPreloader
          isExiting={isBootExiting}
          loadingText={isLoading ? 'Синхронизация данных' : 'Запуск интерфейса'}
        />
      )}
    </>
  );
};

export default AppRouter;
