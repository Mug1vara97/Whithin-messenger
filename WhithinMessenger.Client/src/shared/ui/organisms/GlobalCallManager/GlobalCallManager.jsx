import React from 'react';
import { SoundpadPanel } from '../../molecules';
// import { ActiveCallBar } from '../../molecules';

/**
 * Глобальный менеджер звонков
 * Отображает активную панель звонка, которая видна на всех страницах
 * когда звонок активен
 */
const GlobalCallManager = () => {
  return (
    <>
      <SoundpadPanel />
      {/* Активная панель звонка - показывается только когда звонок активен */}
      {/* <ActiveCallBar /> */}
    </>
  );
};

export default GlobalCallManager;
