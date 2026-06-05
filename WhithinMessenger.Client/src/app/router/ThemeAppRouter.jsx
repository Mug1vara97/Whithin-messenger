import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeColorsPage } from '../../pages/theme-colors/ui';

/** Маршрутизатор только для окна редактора темы — без HomePage и чатов. */
const ThemeAppRouter = () => (
  <Router>
    <Routes>
      <Route path="/theme-colors" element={<ThemeColorsPage />} />
      <Route path="*" element={<Navigate to="/theme-colors" replace />} />
    </Routes>
  </Router>
);

export default ThemeAppRouter;
