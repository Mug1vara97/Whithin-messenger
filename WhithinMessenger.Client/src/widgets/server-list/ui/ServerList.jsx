import React, { useState, useCallback, memo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Link } from 'react-router-dom';
import { ServerIcon } from '../../../shared/ui';
import { useServerContext } from '../../../shared/lib/contexts/useServerContext';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import compassIcon from '../../../assets/magnifying-glass.png';
import { Settings } from '@mui/icons-material';
import './ServerList.css';

const ServerList = ({ onServerSelected, onDiscoverClick, onCreateServerClick, onSettingsClick, onNotificationsClick, userId }) => {
  const { logout } = useAuthContext();
  const [isDragging, setIsDragging] = useState(false);
  
  const {
    servers,
    isLoading,
    error,
    reorderServers
  } = useServerContext();

  // Логирование для отладки
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


  const onDragStart = () => {
    setIsDragging(true);
  };

  const onDragEnd = useCallback(async (result) => {
    setIsDragging(false);

    if (!result.destination || !result.source) return;

    const { source, destination } = result;

    if (source.index === destination.index) return;

    try {
      const items = Array.from(servers);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);

      const updatedItems = items.map((item, index) => ({
        ...item,
        position: index
      }));

      await reorderServers(updatedItems);
    } catch (error) {
      console.error('Error reordering servers:', error);
    }
  }, [servers, reorderServers]);

  if (isLoading) {
    return (
      <div className="server-list">
        <div className="server-list-loading">Загрузка серверов...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="server-list">
        <div className="server-list-error">Ошибка: {error}</div>
      </div>
    );
  }

  return (
    <div className="server-list">
      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <Droppable droppableId="servers" direction="vertical">
          {(provided) => (
            <ul
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              <li className="server-item">
                <Link 
                  to="/channels/@me" 
                  className="server-button"
                  onClick={() => {
                    onDiscoverClick && onDiscoverClick(false);
                    onServerSelected && onServerSelected(null);
                  }}
                >
                  Чаты
                </Link>
              </li>
              {servers.map((server, index) => (
                <Draggable
                  key={server.serverId.toString()}
                  draggableId={server.serverId.toString()}
                  index={index}
                  isDragDisabled={!server.serverId}
                >
                  {(provided, snapshot) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`server-item ${snapshot.isDragging ? 'dragging' : ''}`}
                      style={{
                        ...provided.draggableProps.style,
                        cursor: isDragging ? 'grabbing' : 'grab'
                      }}
                    >
                      <Link
                        to={`/channels/${server.serverId}`}
                        className="server-button"
                        onClick={(e) => {
                          e.preventDefault(); // Предотвращаем навигацию
                          if (!snapshot.isDragging) {
                            onDiscoverClick && onDiscoverClick(false);
                            onServerSelected && onServerSelected(server);
                          }
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
                          />
                        ) : server.name}
                      </Link>
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              <li className="server-item">
                <div 
                  className="server-button"
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
              <li className="server-item">
                <button
                  className="server-button create-button"
                  onClick={onCreateServerClick}
                >
                  +
                </button>
              </li>
              <li className="server-item">
                <button
                  className="server-button notification-button"
                  onClick={onNotificationsClick}
                  title="Уведомления"
                >
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                  >
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                  </svg>
                </button>
              </li>
              <li className="server-item">
                <button
                  className="server-button settings-button"
                  onClick={onSettingsClick}
                  title="Настройки"
                >
                  <Settings />
                </button>
              </li>
              <li className="server-item">
                <button
                  className="server-button logout-button"
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
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </li>
            </ul>
          )}
        </Droppable>
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
        className="modal-input"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Описание сервера"
        className="modal-input"
        rows={3}
      />
      <div className="server-type-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span className="toggle-text">
            {isPublic ? 'Публичный сервер' : 'Приватный сервер'}
          </span>
        </label>
        <p className="toggle-description">
          {isPublic 
            ? 'Сервер будет виден в поиске и доступен всем' 
            : 'Сервер будет доступен только по приглашению'}
        </p>
      </div>
      <div className="modal-actions">
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
  // Сравниваем только важные пропсы
  return (
    prevProps.userId === nextProps.userId &&
    prevProps.selectedServerId === nextProps.selectedServerId &&
    prevProps.onServerSelected === nextProps.onServerSelected &&
    prevProps.onDiscoverClick === nextProps.onDiscoverClick
  );
});
