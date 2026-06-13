import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { FilterList } from '@mui/icons-material';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import UserAvatar from '../../../shared/ui/atoms/UserAvatar';
import './AuditLogPanel.css';

const PAGE_SIZE = 50;

const ACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'Все действия' },
  { value: 'channel_create', label: 'Создание канала' },
  { value: 'channel_update', label: 'Обновление канала' },
  { value: 'channel_privacy_update', label: 'Изменение приватности канала' },
  { value: 'channel_delete', label: 'Удаление канала' },
  { value: 'channel_move', label: 'Перемещение канала' },
  { value: 'category_create', label: 'Создание категории' },
  { value: 'category_update', label: 'Обновление категории' },
  { value: 'category_privacy_update', label: 'Изменение приватности категории' },
  { value: 'category_delete', label: 'Удаление категории' },
  { value: 'category_move', label: 'Перемещение категории' },
  { value: 'channel_member_add', label: 'Доступ к каналу выдан' },
  { value: 'channel_member_remove', label: 'Доступ к каналу снят' },
  { value: 'role_create', label: 'Создание роли' },
  { value: 'role_update', label: 'Обновление роли' },
  { value: 'role_delete', label: 'Удаление роли' },
  { value: 'member_role_add', label: 'Роль выдана' },
  { value: 'member_role_remove', label: 'Роль снята' },
  { value: 'member_kick', label: 'Исключение участника' },
  { value: 'member_add', label: 'Добавление участника' },
  { value: 'server_update', label: 'Обновление сервера' },
  { value: 'server_privacy_update', label: 'Изменение приватности сервера' },
  { value: 'message_delete', label: 'Удаление сообщения' },
];

const SERVER_FIELD_LABELS = {
  name: 'название',
  description: 'описание',
  avatar_upload: 'значок сервера',
  avatar_delete: 'значок сервера',
  banner_upload: 'баннер',
  banner_delete: 'баннер',
  banner_color: 'цвет баннера',
  banner_color_reset: 'цвет баннера',
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '—';
  }
};

const buildTargetText = (entry) => {
  const parts = [];
  if (entry.targetName) parts.push(entry.targetName);
  if (entry.detail) parts.push(entry.detail);

  if (
    entry.actionType === 'category_privacy_update' ||
    entry.actionType === 'channel_privacy_update' ||
    entry.actionType === 'server_privacy_update'
  ) {
    if (!entry.detail && entry.changes?.isPrivate != null) {
      parts.push(entry.changes.isPrivate ? 'Приватный' : 'Публичный');
    }
    if (!entry.detail && entry.changes?.isPublic != null) {
      parts.push(entry.changes.isPublic ? 'Публичный' : 'Приватный');
    }
  }

  if (entry.actionType === 'server_update' && entry.changes?.field) {
    const fieldLabel = SERVER_FIELD_LABELS[entry.changes.field] || entry.changes.field;
    if (!parts.length) parts.push(entry.changes.targetName || 'Сервер');
    if (fieldLabel) parts.push(`(${fieldLabel})`);
  }

  return parts.length ? parts.join(' · ') : '—';
};

const AuditLogPanel = ({ connection, serverId }) => {
  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFilter, setActionFilter] = useState('all');

  const handlePayload = useCallback((payload) => {
    const data = payload?.entries ? payload : { entries: payload || [], totalCount: 0, page: 1 };
    setEntries((prev) => (data.page > 1 ? [...prev, ...(data.entries || [])] : data.entries || []));
    setTotalCount(data.totalCount ?? 0);
    setPage(data.page ?? 1);
    setIsLoading(false);
    setError(null);
  }, []);

  const loadPage = useCallback(
    async (nextPage = 1) => {
      if (!connection || !serverId) return;
      setIsLoading(true);
      setError(null);
      try {
        await connection.invoke('GetAuditLog', serverId, nextPage, PAGE_SIZE);
      } catch (err) {
        setIsLoading(false);
        setError(err?.message || 'Не удалось загрузить журнал аудита');
      }
    },
    [connection, serverId],
  );

  useEffect(() => {
    if (!connection || !serverId) return undefined;

    connection.on('AuditLogLoaded', handlePayload);
    loadPage(1);

    return () => {
      connection.off('AuditLogLoaded', handlePayload);
    };
  }, [connection, serverId, handlePayload, loadPage]);

  const filteredEntries = useMemo(() => {
    if (actionFilter === 'all') return entries;
    return entries.filter((entry) => entry.actionType === actionFilter);
  }, [entries, actionFilter]);

  const hasMore = entries.length < totalCount;

  return (
    <div className="audit-log-panel">
      <div className="audit-log-toolbar">
        <p className="audit-log-toolbar__hint">
          Отображаются действия, которые поддерживаются в Whithin: каналы, категории, роли, участники, сервер и удаление сообщений.
        </p>
        <label className="audit-log-filter">
          <FilterList fontSize="small" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="audit-log-filter__select"
          >
            {ACTION_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="audit-log-card">
        <div className="audit-log-table">
          <div className="audit-log-table-head">
            <div className="audit-log-cell audit-log-cell--user">Пользователь</div>
            <div className="audit-log-cell audit-log-cell--action">Действие</div>
            <div className="audit-log-cell audit-log-cell--target">Объект</div>
            <div className="audit-log-cell audit-log-cell--time">Когда</div>
          </div>

          <div className="audit-log-table-body">
            {isLoading && entries.length === 0 && (
              <div className="audit-log-empty">Загрузка журнала…</div>
            )}

            {!isLoading && error && (
              <div className="audit-log-empty audit-log-empty--error">{error}</div>
            )}

            {!isLoading && !error && filteredEntries.length === 0 && (
              <div className="audit-log-empty">
                {entries.length === 0
                  ? 'Пока нет записей. Действия на сервере будут появляться здесь.'
                  : 'Нет записей для выбранного фильтра.'}
              </div>
            )}

            {filteredEntries.map((entry) => (
              <div key={entry.id} className="audit-log-row">
                <div className="audit-log-cell audit-log-cell--user">
                  <UserAvatar
                    username={entry.username}
                    avatarUrl={entry.avatar ? `${BASE_URL}${entry.avatar}` : null}
                    avatarColor={entry.avatarColor}
                    size={32}
                  />
                  <span className="audit-log-username">{entry.username}</span>
                </div>
                <div className="audit-log-cell audit-log-cell--action">
                  <span className="audit-log-action-label">{entry.actionLabel}</span>
                </div>
                <div className="audit-log-cell audit-log-cell--target">
                  <span className="audit-log-target">{buildTargetText(entry)}</span>
                </div>
                <div className="audit-log-cell audit-log-cell--time">
                  {formatDate(entry.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="audit-log-footer">
          <span>
            {actionFilter === 'all'
              ? `Показано ${entries.length} из ${totalCount}`
              : `Отфильтровано ${filteredEntries.length} из ${entries.length} загруженных`}
          </span>
          {hasMore && actionFilter === 'all' && (
            <button
              type="button"
              className="audit-log-load-more"
              disabled={isLoading}
              onClick={() => loadPage(page + 1)}
            >
              {isLoading ? 'Загрузка…' : 'Загрузить ещё'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(AuditLogPanel);
