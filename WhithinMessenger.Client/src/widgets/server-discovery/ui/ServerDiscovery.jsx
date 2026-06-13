import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useServerContext } from '../../../shared/lib/contexts/useServerContext';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import './ServerDiscovery.css';

const resolveMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const ServerDiscoveryCard = ({
  server,
  isMember,
  isJoining,
  onJoin,
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const bannerUrl = resolveMediaUrl(server.banner);
  const avatarUrl = resolveMediaUrl(server.avatar);
  const bannerColor = server.bannerColor || '#5865f2';
  const initials = server.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <article className="server-discovery__card">
      <div
        className="server-discovery__card-banner"
        style={{
          backgroundColor: bannerColor,
          backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
        }}
      >
        <div className="server-discovery__card-banner-shade" />
        <div
          className="server-discovery__card-icon"
          style={{ backgroundColor: avatarUrl && !avatarError ? 'transparent' : bannerColor }}
        >
          {avatarUrl && !avatarError ? (
            <img
              src={avatarUrl}
              alt=""
              onError={() => setAvatarError(true)}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
      </div>

      <div className="server-discovery__card-body">
        <div className="server-discovery__card-head">
          <h3 className="server-discovery__card-title">{server.name}</h3>
          {server.isPublic && (
            <span className="server-discovery__badge">
              <PublicOutlinedIcon sx={{ fontSize: 14 }} />
              Публичный
            </span>
          )}
        </div>

        {server.description ? (
          <p className="server-discovery__card-desc">{server.description}</p>
        ) : (
          <p className="server-discovery__card-desc server-discovery__card-desc--empty">
            Описание не указано
          </p>
        )}

        <div className="server-discovery__card-meta">
          <GroupsOutlinedIcon sx={{ fontSize: 16 }} />
          <span>{server.memberCount || 0} участников</span>
        </div>
      </div>

      <div className="server-discovery__card-actions">
        {isMember ? (
          <button type="button" className="server-discovery__btn server-discovery__btn--joined" disabled>
            <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
            Вы участник
          </button>
        ) : (
          <button
            type="button"
            className="server-discovery__btn server-discovery__btn--join"
            disabled={isJoining}
            onClick={() => onJoin(server)}
          >
            {isJoining ? 'Присоединение…' : 'Присоединиться'}
          </button>
        )}
      </div>
    </article>
  );
};

const ServerDiscovery = ({ onServerSelected, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [joiningServer, setJoiningServer] = useState(null);

  const {
    publicServers,
    isLoading,
    error,
    joinPublicServer,
    isUserMember,
    fetchPublicServers,
  } = useServerContext();

  useEffect(() => {
    fetchPublicServers();
  }, [fetchPublicServers]);

  const filteredServers = useMemo(() => {
    if (!publicServers?.length) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return publicServers;

    return publicServers.filter((server) => {
      const nameMatch = server.name?.toLowerCase().includes(query);
      const descMatch = server.description?.toLowerCase().includes(query);
      return nameMatch || descMatch;
    });
  }, [publicServers, searchQuery]);

  const handleJoinServer = useCallback(
    async (server) => {
      try {
        setJoiningServer(server.serverId);
        await joinPublicServer(server.serverId);
        onServerSelected?.(server);
        onClose?.();
      } catch (joinError) {
        console.error('Error joining server:', joinError);
        alert(`Ошибка при присоединении к серверу: ${joinError.message}`);
      } finally {
        setJoiningServer(null);
      }
    },
    [joinPublicServer, onServerSelected, onClose]
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="server-discovery__state">
          <div className="server-discovery__loader" aria-hidden="true" />
          <p>Загружаем публичные серверы…</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="server-discovery__state server-discovery__state--error">
          <p>Не удалось загрузить серверы</p>
          <span>{error}</span>
          <button type="button" className="server-discovery__btn server-discovery__btn--ghost" onClick={fetchPublicServers}>
            Повторить
          </button>
        </div>
      );
    }

    if (filteredServers.length === 0) {
      return (
        <div className="server-discovery__state">
          <ExploreOutlinedIcon sx={{ fontSize: 48, opacity: 0.35 }} />
          <h3>Серверы не найдены</h3>
          <p>
            {searchQuery.trim()
              ? 'Попробуйте другой запрос или очистите поиск.'
              : 'Публичных серверов пока нет.'}
          </p>
        </div>
      );
    }

    return (
      <div className="server-discovery__grid">
        {filteredServers.map((server) => (
          <ServerDiscoveryCard
            key={server.serverId}
            server={server}
            isMember={isUserMember(server.serverId)}
            isJoining={joiningServer === server.serverId}
            onJoin={handleJoinServer}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="server-discovery">
      <header className="server-discovery__header">
        <div className="server-discovery__header-main">
          <div className="server-discovery__header-icon">
            <ExploreOutlinedIcon />
          </div>
          <div>
            <h1 className="server-discovery__title">Обнаружение серверов</h1>
            <p className="server-discovery__subtitle">
              Найдите сообщества Whithin и присоединяйтесь к публичным серверам.
            </p>
          </div>
        </div>

        {onClose && (
          <button type="button" className="server-discovery__close" onClick={onClose} aria-label="Закрыть">
            <CloseIcon fontSize="small" />
          </button>
        )}
      </header>

      <div className="server-discovery__toolbar">
        <label className="server-discovery__search">
          <SearchIcon className="server-discovery__search-icon" sx={{ fontSize: 20 }} />
          <input
            type="search"
            placeholder="Поиск по названию или описанию…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        {!isLoading && !error && (
          <span className="server-discovery__count">
            {filteredServers.length}{' '}
            {filteredServers.length === 1 ? 'сервер' : filteredServers.length < 5 ? 'сервера' : 'серверов'}
          </span>
        )}
      </div>

      <div className="server-discovery__content">{renderContent()}</div>
    </div>
  );
};

export default ServerDiscovery;
