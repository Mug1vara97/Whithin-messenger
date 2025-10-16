import { useContext } from 'react';
import { ServerContext } from './ServerContext';

export const useServerContext = () => {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error('useServerContext must be used within a ServerProvider');
  }
  return context;
};
