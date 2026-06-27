import React, { useState, useCallback, memo, useRef, useLayoutEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { NavLink, useLocation } from 'react-router-dom';
import { useServerContext } from '../../../shared/lib/contexts/useServerContext';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import { Settings, Explore } from '@mui/icons-material';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import { NotificationBellButton } from '../../../shared/ui/atoms/NotificationBellButton';
import { isElectronDesktop } from '../../../shared/lib/utils/desktopNotificationBridge';
import styles from './ServerList.module.css';

/** Ключ слота панели под текущий URL (серверы живут на /server/:id, не на /channels/...). */
function getActiveRailKey(pathname) {
  if (!pathname) return null;
  if (pathname.startsWith('/channels/@me')) return '@me';
  const serverMatch = pathname.match(/^\/server\/([^/]+)/);
  if (serverMatch?.[1]) return serverMatch[1];
  return null;
}

const ServerList = ({
  onServerSelected,
  onDiscoverClick,
  onCreateServerClick,
  onSettingsClick,
  onNotificationsClick,
  unreadNotificationsCount = 0,
  unreadCountByServer = {},
  notificationsPanelOpen = false,
}) => {
  const { logout } = useAuthContext();
  const location = useLocation();
  const {
    servers,
    isLoading,
    error,
    reorderServers
  } = useServerContext();

  const listRootRef = useRef(null);
  const serverScrollRef = useRef(null);
  const skipNextServerLinkClick = useRef(false);
  const [notchTop, setNotchTop] = useState(null);
  const [notchVisible, setNotchVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const activeRailKey = getActiveRailKey(location.pathname);
  const showNotificationsInRail = !isElectronDesktop();

  const updateRailNotch = useCallback(() => {
    const root = listRootRef.current;
    if (!root || !activeRailKey) {
      setNotchTop(null);
      setNotchVisible(false);
      return;
    }
    const slot = root.querySelector(`[data-rail-slot="${CSS.escape(activeRailKey)}"]`);
    if (!slot) {
      setNotchTop(null);
      setNotchVisible(false);
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const h = 40;
    const centerY = slotRect.top - rootRect.top + slotRect.height / 2;
    setNotchTop(centerY - h / 2);
    setNotchVisible(true);
  }, [activeRailKey]);

  useLayoutEffect(() => {
    updateRailNotch();

    const onResize = () => {
      if (listRootRef.current) {
        listRootRef.current.style.setProperty('--rail-time-out', 'none');
      }
      updateRailNotch();
      requestAnimationFrame(() => {
        listRootRef.current?.style.removeProperty('--rail-time-out');
      });
    };

    window.addEventListener('resize', onResize);
    const root = listRootRef.current;
    let ro;
    if (root && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(root);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [updateRailNotch, servers, isLoading]);

  React.useEffect(() => {
    console.log('ServerList: Servers updated:', servers);
  }, [servers]);



  const handleDiscoverClick = useCallback(() => {
    if (onDiscoverClick) {
      onDiscoverClick(true);
    }
  }, [onDiscoverClick]);

  const handleLogout = useCallback(() => {
    if (window.confirm('Вы уверены, что хотите выйти из аккаунта?')) {
      logout();
    }
  }, [logout]);

  const handleServerListWheel = useCallback((event) => {
    const container = serverScrollRef.current;
    if (!container) return;

    const canScroll = container.scrollHeight > container.clientHeight;
    if (!canScroll) return;

    // Явно прокручиваем контейнер серверов колесом,
    // чтобы не "утекало" на родительские области.
    event.preventDefault();
    container.scrollTop += event.deltaY;
  }, []);


  const onDragStart = () => {
    setIsDragging(true);
  };

  const onDragEnd = useCallback(async (result) => {
    setIsDragging(false);

    if (!result.destination || !result.source) return;

    const { source, destination } = result;

    if (source.index === destination.index) return;

    if (result.reason === 'DROP') {
      skipNextServerLinkClick.current = true;
      window.setTimeout(() => {
        skipNextServerLinkClick.current = false;
      }, 250);
    }

    try {
      const items = Array.from(servers);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);

      const serverIds = items.map((item) => item.serverId);
      await reorderServers(serverIds);
    } catch (error) {
      console.error('Error reordering servers:', error);
    }
  }, [servers, reorderServers]);

  const renderServersScroll = () => {
    if (isLoading) {
      return (
        <div className={styles['server-list-servers-loading']} aria-busy="true">
          Загрузка…
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles['server-list-servers-error']} title={error}>
          !
        </div>
      );
    }

    return (
      <Droppable droppableId="servers" direction="vertical">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={styles['server-list-droppable']}
          >
            {servers.map((server, index) => {
            const serverId = String(server.serverId);
            const serverUnreadCount = unreadCountByServer[serverId] || 0;
            const isServerActive = activeRailKey === serverId;

            return (
            <Draggable
              key={server.serverId.toString()}
              draggableId={server.serverId.toString()}
              index={index}
              isDragDisabled={!server.serverId}
            >
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  data-rail-slot={String(server.serverId)}
                  className={`${styles['server-item']} ${snapshot.isDragging ? styles.dragging : ''}`}
                  style={{
                    ...provided.draggableProps.style,
                    cursor: isDragging ? 'grabbing' : 'grab'
                  }}
                >
                  <NavLink
                    to={`/server/${server.serverId}`}
                    className={({ isActive }) =>
                      [
                        styles['server-button'],
                        styles['rail-tab-button'],
                        isActive ? styles['rail-tab-active'] : ''
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    onClick={(e) => {
                      if (skipNextServerLinkClick.current) {
                        e.preventDefault();
                        skipNextServerLinkClick.current = false;
                        return;
                      }
                      onDiscoverClick && onDiscoverClick(false);
                      onServerSelected && onServerSelected(server);
                    }}
                  >
                    {server.avatar ? (
                      <img
                        src={`${BASE_URL}${server.avatar}`}
                        alt={server.name}
                        style={{
                          width: 'inherit',
                          height: 'inherit',
                          borderRadius: 'inherit',
                          objectFit: 'cover'
                        }}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const parent = e.target.parentElement;
                          if (parent && !parent.querySelector('.server-fallback')) {
                            const fallback = document.createElement('span');
                            fallback.className = 'server-fallback';
                            fallback.textContent = server.name?.charAt(0)?.toUpperCase() || '?';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <span>{server.name?.charAt(0)?.toUpperCase() || '?'}</span>
                    )}
                    {serverUnreadCount > 0 && !isServerActive && (
                      <span className={styles['server-unread-badge']} aria-label={`${serverUnreadCount} непрочитанных уведомлений`}>
                        {serverUnreadCount > 99 ? '99+' : serverUnreadCount}
                      </span>
                    )}
                  </NavLink>
                </div>
              )}
            </Draggable>
            );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  return (
    <div ref={listRootRef} className={styles['server-list']}>
      <div
        className={`${styles['rail-selection-notch']} ${notchVisible ? styles['rail-selection-notch--visible'] : ''}`}
        style={notchTop != null ? { transform: `translate3d(0, ${notchTop}px, 0)` } : undefined}
        aria-hidden
      />
      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className={styles['server-list-stack']}>
          <ul className={styles['server-list-ul']}>
            <li className={styles['server-item']} data-rail-slot="@me">
              <NavLink
                to="/channels/@me"
                className={({ isActive }) =>
                  [
                    styles['server-button'],
                    styles['rail-tab-button'],
                    isActive ? styles['rail-tab-active'] : ''
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                onClick={() => {
                  onDiscoverClick && onDiscoverClick(false);
                  onServerSelected && onServerSelected(null);
                }}
                title="Чаты"
              >
                <ChatOutlinedIcon sx={{ fontSize: 22, color: 'inherit' }} />
              </NavLink>
            </li>
          </ul>

          <div
            ref={serverScrollRef}
            className={styles['server-list-servers-scroll']}
            onWheel={handleServerListWheel}
          >
            {renderServersScroll()}
          </div>

          <ul className={`${styles['server-list-ul']} ${styles['server-list-bottom']}`}>
            <li className={styles['server-item']}>
              <button
                type="button"
                className={`${styles['server-button']} ${styles['create-button']}`}
                onClick={onCreateServerClick}
              >
                +
              </button>
            </li>
            <li className={styles['server-item']}>
              <div
                className={styles['server-button']}
                onClick={handleDiscoverClick}
                title="Обзор"
              >
                <Explore sx={{ fontSize: 24, opacity: 0.85 }} />
              </div>
            </li>
            {showNotificationsInRail && (
              <li className={styles['server-item']}>
                <NotificationBellButton
                  unreadCount={unreadNotificationsCount}
                  isOpen={notificationsPanelOpen}
                  onClick={onNotificationsClick}
                  variant="rail"
                  iconSize={20}
                  className={`${styles['server-button']} ${styles['notification-button']}`}
                />
              </li>
            )}
            <li className={styles['server-item']}>
              <button
                type="button"
                className={`${styles['server-button']} ${styles['settings-button']}`}
                onClick={onSettingsClick}
                title="Настройки"
              >
                <Settings />
              </button>
            </li>
            <li className={styles['server-item']}>
              <button
                type="button"
                className={`${styles['server-button']} ${styles['logout-button']}`}
                onClick={handleLogout}
                title="Выйти из аккаунта"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16,17 21,12 16,7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </li>
          </ul>
        </div>
      </DragDropContext>

    </div>
  );
};

export default memo(ServerList, (prevProps, nextProps) => {
  return (
    prevProps.userId === nextProps.userId &&
    prevProps.selectedServerId === nextProps.selectedServerId &&
    prevProps.onServerSelected === nextProps.onServerSelected &&
    prevProps.onDiscoverClick === nextProps.onDiscoverClick &&
    prevProps.unreadNotificationsCount === nextProps.unreadNotificationsCount &&
    prevProps.unreadCountByServer === nextProps.unreadCountByServer
  );
});
