import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { chatApi } from '../../../entities/chat/api/chatApi';
import { serverApi } from '../../../entities/server/api/serverApi';
import { hasStartupBootCompleted } from '../startup/startupBoot';
import { ensureE2eIdentity, syncSessionE2eKeys } from '../e2e';
import { useAuthContext } from './AuthContext';
import { useServerContext } from './useServerContext';

const StartupBootContext = createContext(null);

export const StartupBootProvider = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuthContext();
  const { initialServersLoaded } = useServerContext();
  const [isChatsReady, setIsChatsReady] = useState(() => hasStartupBootCompleted());
  const [isServersReady, setIsServersReady] = useState(() => hasStartupBootCompleted());
  const [skipBootAnimation] = useState(() => hasStartupBootCompleted());

  const markChatsReady = useCallback(() => {
    setIsChatsReady(true);
  }, []);

  const markServersReady = useCallback(() => {
    setIsServersReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsChatsReady(false);
      setIsServersReady(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (initialServersLoaded) {
      setIsServersReady(true);
    }
  }, [initialServersLoaded]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user?.id) {
      return undefined;
    }

    // Upload device key, then refresh chat-key wraps for all locally known chats.
    void ensureE2eIdentity(user.id, { strictUpload: true })
      .then(() => chatApi.getUserChats())
      .then((chatItems) => {
        const chats = Array.isArray(chatItems) ? chatItems : [];
        return syncSessionE2eKeys(user.id, chats);
      })
      .catch(() => {});
  }, [isLoading, isAuthenticated, user?.id]);

  useEffect(() => {
    if (skipBootAnimation || isLoading || !isAuthenticated || !user?.id) {
      return undefined;
    }

    void chatApi.getUserChats().catch(() => {});
    void serverApi.getUserServers(user.id).catch(() => {});
  }, [skipBootAnimation, isLoading, isAuthenticated, user?.id]);

  const isAppReady =
    !isLoading && (!isAuthenticated || (isChatsReady && isServersReady));

  const value = useMemo(
    () => ({
      isAppReady,
      markChatsReady,
      markServersReady,
      skipBootAnimation,
      isChatsReady,
      isServersReady,
    }),
    [isAppReady, markChatsReady, markServersReady, skipBootAnimation, isChatsReady, isServersReady],
  );

  return (
    <StartupBootContext.Provider value={value}>
      {children}
    </StartupBootContext.Provider>
  );
};

export const useStartupBoot = () => {
  const context = useContext(StartupBootContext);
  if (!context) {
    throw new Error('useStartupBoot must be used within a StartupBootProvider');
  }
  return context;
};
