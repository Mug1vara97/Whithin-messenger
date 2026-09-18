import React, { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { HubConnectionBuilder, HubConnectionState, HttpTransportType, LogLevel } from '@microsoft/signalr';
import { BASE_URL, HUB_ENDPOINTS } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';
import {
  SIGNALR_RECONNECT_DELAYS_MS,
  ensureHubStarted,
  isHubUsable,
  subscribeNetworkRecovery,
} from '../signalr/reconnectPolicy';

/**
 * Единое SignalR-соединение приложения.
 *
 * Все домены (чаты, список чатов, серверы, друзья, уведомления, presence) живут на одном
 * хабе `/hub`. Контекст владеет ровно одним HubConnection на userId и раздаёт его всем
 * потребителям. Потребители НЕ должны вызывать connection.stop() и НЕ должны вызывать
 * connection.off('Event') без ссылки на хендлер — соединение общее.
 *
 * Для подписки на реконнект используйте onReconnected(cb) (возвращает unsubscribe),
 * а не connection.onreconnected — у последнего нет способа отписаться.
 */
const ConnectionContext = createContext();

export const useConnectionContext = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    console.warn('useConnectionContext must be used within a ConnectionProvider, returning null');
    return null;
  }
  return context;
};

const normalizeUserId = (value) => (value === null || value === undefined ? null : String(value));

/**
 * Серверные группы, в которые можно вступать с клиента. Членство считается по ссылкам:
 * несколько потребителей (HomePage для входящих звонков, useChat для открытого чата, ...)
 * могут держать одну и ту же группу, и LeaveGroup уйдёт только когда её отпустят все.
 * После реконнекта все удерживаемые группы переподписываются автоматически.
 */
const GROUP_METHODS = {
  chat: { join: 'JoinGroup', leave: 'LeaveGroup', withArg: true },
  server: { join: 'JoinServerGroup', leave: 'LeaveServerGroup', withArg: true },
  serverlist: { join: 'JoinServerListGroup', leave: 'LeaveServerListGroup', withArg: false },
};

const groupKey = (kind, id) => `${kind}:${id ?? ''}`;

export const ConnectionProvider = ({ children }) => {
  const connectionRef = useRef(null);
  const connectionUserIdRef = useRef(null);
  const pendingStartRef = useRef(null);
  const restartingRef = useRef(false);

  const reconnectedListenersRef = useRef(new Set());
  const reconnectingListenersRef = useRef(new Set());
  const closedListenersRef = useRef(new Set());

  /** key -> { kind, id, count } */
  const groupsRef = useRef(new Map());

  const [connection, setConnectionState] = useState(null);

  const notify = (listeners, ...args) => {
    for (const listener of Array.from(listeners)) {
      try {
        listener(...args);
      } catch (error) {
        console.warn('[signalr] listener failed:', error);
      }
    }
  };

  const invokeGroupMethod = useCallback(async (conn, kind, id, action) => {
    const spec = GROUP_METHODS[kind];
    if (!spec || !conn || conn.state !== HubConnectionState.Connected) return false;
    const method = action === 'join' ? spec.join : spec.leave;
    try {
      if (spec.withArg) {
        await conn.invoke(method, String(id));
      } else {
        await conn.invoke(method);
      }
      return true;
    } catch (error) {
      console.warn(`[signalr] ${method}(${id ?? ''}) failed:`, error);
      return false;
    }
  }, []);

  const rejoinAllGroups = useCallback(async (conn) => {
    const entries = Array.from(groupsRef.current.values()).filter((entry) => entry.count > 0);
    await Promise.all(entries.map((entry) => invokeGroupMethod(conn, entry.kind, entry.id, 'join')));
  }, [invokeGroupMethod]);

  const handleReconnected = useCallback(async (conn, connectionId) => {
    await rejoinAllGroups(conn);
    notify(reconnectedListenersRef.current, connectionId);
  }, [rejoinAllGroups]);

  const restartIfNeeded = useCallback(async () => {
    const current = connectionRef.current;
    if (!current || restartingRef.current) return;
    if (isHubUsable(current)) return;

    restartingRef.current = true;
    try {
      const restarted = await ensureHubStarted(current, 'hub');
      if (restarted) {
        // Ручной рестарт после исчерпания авто-реконнекта — для потребителей это тот же
        // "reconnected": группы на сервере потеряны, надо переподписаться.
        await handleReconnected(current, current.connectionId);
      }
    } finally {
      restartingRef.current = false;
    }
  }, [handleReconnected]);

  const recoverAllConnections = useCallback(async () => {
    await restartIfNeeded();
  }, [restartIfNeeded]);

  const disposeCurrent = useCallback(async () => {
    const current = connectionRef.current;
    connectionRef.current = null;
    connectionUserIdRef.current = null;
    setConnectionState(null);
    if (!current) return;
    try {
      await current.stop();
    } catch (error) {
      console.error('[signalr] error stopping connection:', error);
    }
  }, []);

  const buildConnection = useCallback((userId) => {
    const url = `${BASE_URL}${HUB_ENDPOINTS.APP_HUB}?userId=${encodeURIComponent(userId)}`;

    const built = new HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: () => tokenManager.getToken() || '',
        // Сервер разрешает только WebSockets — пропускаем лишний negotiate round-trip.
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect(SIGNALR_RECONNECT_DELAYS_MS)
      .configureLogging(LogLevel.Error)
      .build();

    built.onreconnecting((error) => {
      notify(reconnectingListenersRef.current, error);
    });

    built.onreconnected((connectionId) => {
      void handleReconnected(built, connectionId);
    });

    built.onclose((error) => {
      notify(closedListenersRef.current, error);
      // VPN / network drop after retries exhausted — try again when possible.
      window.setTimeout(() => {
        if (connectionRef.current === built) {
          void restartIfNeeded();
        }
      }, 1500);
    });

    return built;
  }, [handleReconnected, restartIfNeeded]);

  /**
   * Возвращает общее соединение для userId.
   * Сигнатура (hubName, userId) сохранена для обратной совместимости — hubName игнорируется.
   */
  const getConnection = useCallback(async (hubNameOrUserId, maybeUserId) => {
    const userId = normalizeUserId(maybeUserId !== undefined ? maybeUserId : hubNameOrUserId);
    if (!userId) {
      throw new Error('getConnection: userId is required');
    }

    // Смена пользователя — старое соединение больше не нужно.
    if (connectionRef.current && connectionUserIdRef.current !== userId) {
      await disposeCurrent();
    }

    const existing = connectionRef.current;
    if (existing) {
      if (isHubUsable(existing)) {
        return existing;
      }
      if (existing.state === HubConnectionState.Disconnected) {
        const restarted = await ensureHubStarted(existing, 'hub');
        if (restarted) {
          await handleReconnected(existing, existing.connectionId);
          return existing;
        }
      }
      await disposeCurrent();
    }

    if (pendingStartRef.current) {
      return pendingStartRef.current;
    }

    const startPromise = (async () => {
      const built = buildConnection(userId);
      try {
        await built.start();
      } catch (error) {
        console.error('[signalr] error establishing connection:', error);
        throw error;
      }
      connectionRef.current = built;
      connectionUserIdRef.current = userId;
      setConnectionState(built);
      // Группы, запрошенные до установления соединения.
      await rejoinAllGroups(built);
      return built;
    })();

    pendingStartRef.current = startPromise;
    try {
      return await startPromise;
    } finally {
      pendingStartRef.current = null;
    }
  }, [buildConnection, disposeCurrent, handleReconnected, rejoinAllGroups]);

  /**
   * Вступить в серверную группу с подсчётом ссылок. Возвращает release().
   * kind: 'chat' | 'server' | 'serverlist'.
   */
  const acquireGroup = useCallback((kind, id) => {
    if (!GROUP_METHODS[kind]) {
      throw new Error(`acquireGroup: unknown group kind "${kind}"`);
    }
    const key = groupKey(kind, id);
    const entry = groupsRef.current.get(key) ?? { kind, id, count: 0 };
    entry.count += 1;
    groupsRef.current.set(key, entry);

    if (entry.count === 1) {
      void invokeGroupMethod(connectionRef.current, kind, id, 'join');
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = groupsRef.current.get(key);
      if (!current) return;
      current.count -= 1;
      if (current.count <= 0) {
        groupsRef.current.delete(key);
        void invokeGroupMethod(connectionRef.current, kind, id, 'leave');
      }
    };
  }, [invokeGroupMethod]);

  /** Явный (пере)вход в группу и ожидание результата — для первого JoinGroup перед GetMessages. */
  const ensureGroupJoined = useCallback(async (kind, id) => {
    const key = groupKey(kind, id);
    if (!groupsRef.current.has(key)) return false;
    return invokeGroupMethod(connectionRef.current, kind, id, 'join');
  }, [invokeGroupMethod]);

  const closeConnection = useCallback(async () => {
    await disposeCurrent();
  }, [disposeCurrent]);

  const onReconnected = useCallback((listener) => {
    reconnectedListenersRef.current.add(listener);
    return () => {
      reconnectedListenersRef.current.delete(listener);
    };
  }, []);

  const onReconnecting = useCallback((listener) => {
    reconnectingListenersRef.current.add(listener);
    return () => {
      reconnectingListenersRef.current.delete(listener);
    };
  }, []);

  const onClose = useCallback((listener) => {
    closedListenersRef.current.add(listener);
    return () => {
      closedListenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    return subscribeNetworkRecovery(() => {
      void recoverAllConnections();
    });
  }, [recoverAllConnections]);

  useEffect(() => {
    return () => {
      const current = connectionRef.current;
      connectionRef.current = null;
      if (current) {
        current.stop().catch(() => {});
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      getConnection,
      closeConnection,
      acquireGroup,
      ensureGroupJoined,
      onReconnected,
      onReconnecting,
      onClose,
      connection,
      recoverAllConnections,
    }),
    [
      getConnection,
      closeConnection,
      acquireGroup,
      ensureGroupJoined,
      onReconnected,
      onReconnecting,
      onClose,
      connection,
      recoverAllConnections,
    ],
  );

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};
