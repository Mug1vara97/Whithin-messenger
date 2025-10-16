import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthContext } from '../../shared/lib/contexts/AuthContext';
import { LoginPage } from '../../pages/login/ui';
import { RegisterPage } from '../../pages/register/ui';
import { HomePage } from '../../pages/home/ui';
import { ServerSettingsPage } from '../../pages/server-settings/ui';

const AppRouter = () => {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
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
  );
};

export default AppRouter;
