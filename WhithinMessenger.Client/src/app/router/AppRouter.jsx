import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthContext } from '../../shared/lib/contexts/AuthContext';
import { useStartupBoot } from '../../shared/lib/contexts/StartupBootContext';
import { markStartupBootCompleted } from '../../shared/lib/startup/startupBoot';
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

const MIN_BOOT_DISPLAY_MS = 380;

const AppRouter = () => {
  const { isAuthenticated, isLoading } = useAuthContext();
  const { isAppReady, skipBootAnimation, isChatsReady, isServersReady } = useStartupBoot();
  const [isBootExiting, setIsBootExiting] = useState(false);
  const [isBootCompleted, setIsBootCompleted] = useState(skipBootAnimation);
  const [bootShownAt, setBootShownAt] = useState(() => (skipBootAnimation ? 0 : Date.now()));
  const completeTimerRef = useRef(null);
  const shouldShowBootPreloader = !isBootCompleted;

  useEffect(() => {
    if (skipBootAnimation || isBootCompleted || isBootExiting || !isAppReady) {
      return undefined;
    }

    const elapsed = Date.now() - bootShownAt;
    const remaining = Math.max(0, MIN_BOOT_DISPLAY_MS - elapsed);

    const startExitTimer = window.setTimeout(() => {
      setIsBootExiting(true);
      completeTimerRef.current = window.setTimeout(() => {
        markStartupBootCompleted();
        setIsBootCompleted(true);
      }, 420);
    }, remaining);

    return () => {
      window.clearTimeout(startExitTimer);
      if (completeTimerRef.current) {
        window.clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }
    };
  }, [skipBootAnimation, isBootCompleted, isBootExiting, isAppReady, bootShownAt]);

  const loadingText = isLoading
    ? 'Синхронизация данных'
    : !isAuthenticated
      ? 'Запуск интерфейса'
      : !isServersReady
        ? 'Загрузка серверов'
        : !isChatsReady
          ? 'Загрузка чатов'
          : 'Подготовка интерфейса';

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
          loadingText={loadingText}
        />
      )}
    </>
  );
};

export default AppRouter;
