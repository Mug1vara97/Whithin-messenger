import React, { useState, useCallback, memo, useRef, useLayoutEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { NavLink, useLocation } from 'react-router-dom';
import { useServerContext } from '../../../shared/lib/contexts/useServerContext';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import compassIcon from '../../../assets/magnifying-glass.png';
import { Settings, Palette, GraphicEq } from '@mui/icons-material';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import { openThemeColorsWindow } from '../../../shared/lib/theme/openThemeColorsWindow';
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
  onSoundpadClick,
  onNotificationsClick,
  unreadNotificationsCount = 0
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

  if (isLoading) {
    return (
      <div className={styles['server-list']}>
        <div className={styles['server-list-loading']}>Загрузка серверов...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles['server-list']}>
        <div className={styles['server-list-error']}>Ошибка: {error}</div>
      </div>
    );
  }

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
                <ChatOutlinedIcon sx={{ fontSize: 22 }} />
              </NavLink>
            </li>
          </ul>

          <div
            ref={serverScrollRef}
            className={styles['server-list-servers-scroll']}
            onWheel={handleServerListWheel}
          >
            <Droppable droppableId="servers" direction="vertical">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={styles['server-list-droppable']}
                >
                  {servers.map((server, index) => (
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
                        </NavLink>
                      </div>
                    )}
                  </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          <ul className={`${styles['server-list-ul']} ${styles['server-list-bottom']}`}>
            <li className={styles['server-item']}>
              <div
                className={styles['server-button']}
                onClick={handleDiscoverClick}
              >
                <img
                  src={compassIcon}
                  alt="Discover"
                  style={{
                    width: '24px',
                    height: '24px',
                    filter: 'brightness(0) invert(1)',
                    opacity: 0.8
                  }}
                />
              </div>
            </li>
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
              <button
                type="button"
                className={`${styles['server-button']} ${styles['notification-button']}`}
                onClick={onNotificationsClick}
                title="Уведомления"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                </svg>
                {unreadNotificationsCount > 0 && (
                  <span className={styles['notification-badge']}>
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            </li>
            <li className={styles['server-item']}>
              <button
                type="button"
                className={`${styles['server-button']} ${styles['theme-paint-button']}`}
                onClick={openThemeColorsWindow}
                title="Цвета интерфейса"
              >
                <Palette />
              </button>
            </li>
            {onSoundpadClick && (
              <li className={styles['server-item']}>
                <button
                  type="button"
                  className={`${styles['server-button']} ${styles['soundpad-button']}`}
                  onClick={onSoundpadClick}
                  title="Саундпад (VB-Cable)"
                >
                  <GraphicEq />
                </button>
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

const CreateServerForm = ({ onClose, onCreate }) => {
  const [serverName, setServerName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (serverName.trim()) {
      onCreate({
        serverName: serverName.trim(),
        description: description.trim(),
        isPublic
      });
    }
  };

  const resetModalState = () => {
    setServerName('');
    setDescription('');
    setIsPublic(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={serverName}
        onChange={(e) => setServerName(e.target.value)}
        placeholder="Название сервера"
        className={styles['modal-input']}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Описание сервера"
        className={styles['modal-input']}
        rows={3}
      />
      <div className={styles['server-type-toggle']}>
        <label className={styles['toggle-label']}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span className={styles['toggle-text']}>
            {isPublic ? 'Публичный сервер' : 'Приватный сервер'}
          </span>
        </label>
        <p className={styles['toggle-description']}>
          {isPublic 
            ? 'Сервер будет виден в поиске и доступен всем' 
            : 'Сервер будет доступен только по приглашению'}
        </p>
      </div>
      <div className={styles['modal-actions']}>
        <button
          onClick={handleSubmit}
          disabled={!serverName.trim()}
        >
          Создать
        </button>
        <button onClick={resetModalState}>
          Отмена
        </button>
      </div>
    </form>
  );
};

export default memo(ServerList, (prevProps, nextProps) => {
  return (
    prevProps.userId === nextProps.userId &&
    prevProps.selectedServerId === nextProps.selectedServerId &&
    prevProps.onServerSelected === nextProps.onServerSelected &&
    prevProps.onDiscoverClick === nextProps.onDiscoverClick &&
    prevProps.unreadNotificationsCount === nextProps.unreadNotificationsCount
  );
});
