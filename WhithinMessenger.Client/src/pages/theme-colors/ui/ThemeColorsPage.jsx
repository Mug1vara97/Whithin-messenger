import React from 'react';
import ThemeColorEditor from '../../../shared/ui/molecules/ThemeColorMenu/ThemeColorMenu';
import './ThemeColorsPage.css';

const ThemeColorsPage = () => (
  <div className="theme-colors-page">
    <ThemeColorEditor standalone />
  </div>
);

export default ThemeColorsPage;
