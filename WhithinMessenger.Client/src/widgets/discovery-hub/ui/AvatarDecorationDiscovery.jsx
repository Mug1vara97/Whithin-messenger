import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { userApi } from '../../../entities/user/api';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import {
  AVATAR_DECORATION_CATALOG,
  normalizeAvatarDecorationPath,
} from '../../../shared/lib/avatarDecorations/catalog';
import UserAvatar from '../../../shared/ui/atoms/UserAvatar/UserAvatar';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import './AvatarDecorationDiscovery.css';

const AvatarDecorationCard = ({
  item,
  isActive,
  isBusy,
  previewAvatarUrl,
  previewAvatarColor,
  previewDisplayName,
  previewLogin,
  onApply,
  onRemove,
}) => (
  <article className="avatar-decoration-discovery__card">
    <div className="avatar-decoration-discovery__preview">
      <UserAvatar
        displayName={previewDisplayName}
        login={previewLogin}
        avatarUrl={previewAvatarUrl}
        avatarColor={previewAvatarColor}
        avatarDecoration={item.path}
        size={88}
      />
    </div>

    <div className="avatar-decoration-discovery__card-body">
      <div className="avatar-decoration-discovery__card-head">
        <h3 className="avatar-decoration-discovery__card-title">{item.name}</h3>
        {isActive && (
          <span className="avatar-decoration-discovery__badge avatar-decoration-discovery__badge--active">
            На профиле
          </span>
        )}
      </div>
      {item.description ? (
        <p className="avatar-decoration-discovery__card-desc">{item.description}</p>
      ) : null}
    </div>

    <div className="avatar-decoration-discovery__card-actions">
      {isActive ? (
        <button
          type="button"
          className="avatar-decoration-discovery__btn avatar-decoration-discovery__btn--remove"
          disabled={isBusy}
          onClick={onRemove}
        >
          <RemoveCircleOutlineIcon sx={{ fontSize: 18 }} />
          Снять
        </button>
      ) : (
        <button
          type="button"
          className="avatar-decoration-discovery__btn avatar-decoration-discovery__btn--apply"
          disabled={isBusy}
          onClick={() => onApply(item.path)}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
          Применить
        </button>
      )}
    </div>
  </article>
);

const AvatarDecorationDiscovery = ({ searchQuery = '' }) => {
  const { user } = useAuthContext();
  const userId = user?.id || user?.userId || user?.Id;
  const [profile, setProfile] = useState(null);
  const [busyPath, setBusyPath] = useState('');
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await userApi.getProfile(userId);
      setProfile(data);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить профиль');
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const activeDecorationPath = profile?.avatarDecoration ?? null;

  const previewAvatarUrl = useMemo(() => {
    if (!profile?.avatar) return null;
    return profile.avatar.startsWith('http') ? profile.avatar : `${BASE_URL}${profile.avatar}`;
  }, [profile?.avatar]);

  const previewAvatarColor = profile?.accentColor || profile?.avatarColor || '#5865F2';
  const previewDisplayName = profile?.displayName || user?.displayName || null;
  const previewLogin = user?.username || user?.login || null;

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return AVATAR_DECORATION_CATALOG;

    return AVATAR_DECORATION_CATALOG.filter((item) => {
      const nameMatch = item.name?.toLowerCase().includes(query);
      const descMatch = item.description?.toLowerCase().includes(query);
      return nameMatch || descMatch;
    });
  }, [searchQuery]);

  const handleApply = useCallback(async (path) => {
    if (!userId || !path) return;
    setBusyPath(path);
    setError('');
    try {
      await userApi.updateProfileAvatarDecoration(userId, path);
      await loadProfile();
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (applyError) {
      setError(applyError.message || 'Не удалось применить рамку');
    } finally {
      setBusyPath('');
    }
  }, [userId, loadProfile]);

  const handleRemove = useCallback(async () => {
    if (!userId) return;
    setBusyPath('__remove__');
    setError('');
    try {
      await userApi.removeProfileAvatarDecoration(userId);
      await loadProfile();
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (removeError) {
      setError(removeError.message || 'Не удалось снять рамку');
    } finally {
      setBusyPath('');
    }
  }, [userId, loadProfile]);

  const isBusy = Boolean(busyPath);

  if (!userId) {
    return (
      <div className="avatar-decoration-discovery__state">
        <AutoAwesomeOutlinedIcon sx={{ fontSize: 48, opacity: 0.35 }} />
        <h3>Войдите в аккаунт</h3>
        <p>Чтобы выбрать рамку аватара, нужно быть авторизованным.</p>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="avatar-decoration-discovery__state">
        <AutoAwesomeOutlinedIcon sx={{ fontSize: 48, opacity: 0.35 }} />
        <h3>Рамки не найдены</h3>
        <p>
          {searchQuery.trim()
            ? 'Попробуйте другой запрос или очистите поиск.'
            : 'Каталог рамок пока пуст.'}
        </p>
      </div>
    );
  }

  return (
    <div className="avatar-decoration-discovery">
      {error && <div className="avatar-decoration-discovery__error">{error}</div>}

      <div className="avatar-decoration-discovery__grid">
        {filteredItems.map((item) => {
          const isActive =
            normalizeAvatarDecorationPath(activeDecorationPath)
            === normalizeAvatarDecorationPath(item.path);

          return (
            <AvatarDecorationCard
              key={item.id}
              item={item}
              isActive={isActive}
              isBusy={isBusy}
              previewAvatarUrl={previewAvatarUrl}
              previewAvatarColor={previewAvatarColor}
              previewDisplayName={previewDisplayName}
              previewLogin={previewLogin}
              onApply={handleApply}
              onRemove={handleRemove}
            />
          );
        })}
      </div>
    </div>
  );
};

export default AvatarDecorationDiscovery;
