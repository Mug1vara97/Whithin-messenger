import React, { useCallback, useEffect, useRef, useState } from 'react';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import { userApi } from '../../../../entities/user/api';
import { MEDIA_BASE_URL } from '../../../lib/constants/apiEndpoints';
import {
  DODO_NAMEPLATE_PATH,
  NAMEPLATE_ACCEPT,
  NAMEPLATE_SPEC_HINT,
  TEST_NAMEPLATE_PATH,
  validateNameplateFile,
} from '../../../lib/utils/nameplateHelpers';
import UserNameplate from '../../atoms/UserNameplate';
import UserAvatar from '../../atoms/UserAvatar';
import {
  AVATAR_DECORATION_ACCEPT,
  AVATAR_DECORATION_SPEC_HINT,
  TEST_AVATAR_DECORATION_PATH,
  validateAvatarDecorationFile,
} from '../../../lib/utils/avatarDecorationHelpers';
import './ProfileCustomizeSection.css';

const ACCENT_PRESETS = [
  '#5865f2',
  '#eb459e',
  '#57f287',
  '#fee75c',
  '#ed4245',
  '#faa61a',
  '#00b0f4',
  '#9b59b6',
];

const BANNER_PRESETS = [
  '#5865f2',
  '#eb459e',
  '#1abc9c',
  '#2c3e50',
  '#e67e22',
  '#8e44ad',
  '#16a085',
  '#c0392b',
];

const clamp255 = (value) => Math.max(0, Math.min(255, Number(value) || 0));

const rgbToHex = (r, g, b) => {
  const part = (n) => clamp255(n).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
};

const hexToRgb = (hex) => {
  const raw = String(hex || '').replace('#', '').trim();
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    };
  }
  if (raw.length === 6) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }
  return { r: 88, g: 101, b: 242 };
};

const normalizeHex = (hex) => {
  if (!hex || !String(hex).startsWith('#')) return null;
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r, g, b).toLowerCase();
};

const isHexColor = (value) => Boolean(normalizeHex(value));

const ProfileColorPicker = ({ value, onApply, disabled, presets = [] }) => {
  const normalizedValue = normalizeHex(value) || '#5865f2';
  const [rgb, setRgb] = useState(() => hexToRgb(normalizedValue));
  const [pickerValue, setPickerValue] = useState(normalizedValue);

  useEffect(() => {
    const next = normalizeHex(value) || '#5865f2';
    setRgb(hexToRgb(next));
    setPickerValue(next);
  }, [value]);

  const applyHex = (hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return;
    setRgb(hexToRgb(normalized));
    setPickerValue(normalized);
    onApply(normalized);
  };

  const handleRgbFieldChange = (channel, nextValue) => {
    setRgb((prev) => ({ ...prev, [channel]: clamp255(nextValue) }));
  };

  const handleApplyRgb = () => {
    applyHex(rgbToHex(rgb.r, rgb.g, rgb.b));
  };

  const handlePickerChange = (event) => {
    applyHex(event.target.value);
  };

  const isPresetActive = (preset) => normalizeHex(preset) === normalizedValue;
  const isCustomActive = !presets.some((preset) => isPresetActive(preset));

  return (
    <div className="profile-customize__color-picker">
      <div className="profile-customize__swatches">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            className={`profile-customize__swatch ${isPresetActive(color) ? 'is-active' : ''}`}
            style={{ backgroundColor: color }}
            disabled={disabled}
            onClick={() => applyHex(color)}
            aria-label={`Цвет ${color}`}
          >
            {isPresetActive(color) && <CheckIcon sx={{ fontSize: 16 }} />}
          </button>
        ))}
      </div>

      <div className="profile-customize__rgb-row">
        <label className="profile-customize__picker-label">
          <input
            type="color"
            className="profile-customize__picker-input"
            value={pickerValue}
            disabled={disabled}
            onChange={handlePickerChange}
            aria-label="Выбор цвета"
          />
          <span
            className={`profile-customize__picker-preview ${isCustomActive ? 'is-active' : ''}`}
            style={{ backgroundColor: pickerValue }}
          />
        </label>

        <div className="profile-customize__rgb-fields">
          {(['r', 'g', 'b']).map((channel) => (
            <label key={channel} className="profile-customize__rgb-field">
              <span>{channel.toUpperCase()}</span>
              <input
                type="number"
                min={0}
                max={255}
                value={rgb[channel]}
                disabled={disabled}
                onChange={(e) => handleRgbFieldChange(channel, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyRgb();
                  }
                }}
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          className="profile-customize__rgb-apply"
          disabled={disabled}
          onClick={handleApplyRgb}
        >
          Применить RGB
        </button>
      </div>

      <p className="setting-description profile-customize__hex-value">
        Текущий: <code>{normalizedValue}</code>
      </p>
    </div>
  );
};

const resolveMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const ProfileCustomizeSection = ({ userId, username, active, onProfileUpdated }) => {
  const [profile, setProfile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const nameplateInputRef = useRef(null);
  const avatarDecorationInputRef = useRef(null);

  const accentColor = profile?.avatarColor || '#5865f2';
  const bannerColor = isHexColor(profile?.banner) ? profile.banner : null;

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await userApi.getProfile(userId);
      setProfile(data);
      onProfileUpdated?.(data);
    } catch (error) {
      console.error('Error loading profile for customize:', error);
    }
  }, [userId, onProfileUpdated]);

  useEffect(() => {
    if (active && userId) {
      loadProfile();
      setActionError('');
    }
  }, [active, userId, loadProfile]);

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      const { url } = await userApi.uploadProfileAvatar(file);
      await userApi.updateProfileAvatar(userId, url);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось загрузить аватар');
    } finally {
      setUploadBusy(false);
      event.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      await userApi.removeProfileAvatar(userId);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось удалить аватар');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleBannerUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      const { url } = await userApi.uploadProfileBanner(file);
      await userApi.updateProfileBanner(userId, url);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось загрузить баннер');
    } finally {
      setUploadBusy(false);
      event.target.value = '';
    }
  };

  const handleBannerColor = async (color) => {
    if (!userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      await userApi.updateProfileBanner(userId, color);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось обновить баннер');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleRemoveBanner = async () => {
    if (!userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      await userApi.removeProfileBanner(userId);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось удалить баннер');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleAccentChange = async (color) => {
    if (!userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      await userApi.updateAvatarColor(userId, color);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось обновить цвет');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleApplyTestNameplate = async (path = TEST_NAMEPLATE_PATH) => {
    if (!userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      await userApi.updateProfileNameplate(userId, path);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось применить табличку');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleNameplateUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      await validateNameplateFile(file);
      const { url } = await userApi.uploadProfileNameplate(file);
      await userApi.updateProfileNameplate(userId, url);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось загрузить табличку');
    } finally {
      setUploadBusy(false);
      event.target.value = '';
    }
  };

  const handleRemoveNameplate = async () => {
    if (!userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      await userApi.removeProfileNameplate(userId);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось удалить табличку');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleApplyTestAvatarDecoration = async (path = TEST_AVATAR_DECORATION_PATH) => {
    if (!userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      await userApi.updateProfileAvatarDecoration(userId, path);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось применить рамку аватара');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleAvatarDecorationUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      validateAvatarDecorationFile(file);
      const { url } = await userApi.uploadProfileAvatarDecoration(file);
      await userApi.updateProfileAvatarDecoration(userId, url);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось загрузить рамку аватара');
    } finally {
      setUploadBusy(false);
      event.target.value = '';
    }
  };

  const handleRemoveAvatarDecoration = async () => {
    if (!userId) return;
    setUploadBusy(true);
    setActionError('');
    try {
      await userApi.removeProfileAvatarDecoration(userId);
      await loadProfile();
    } catch (error) {
      setActionError(error.message || 'Не удалось удалить рамку аватара');
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div className="setting-section profile-customize">
      <h3>Оформление профиля</h3>
      {actionError && <div className="account-error">{actionError}</div>}

      <div className="profile-customize__preview">
        <div
          className="profile-customize__preview-banner"
          style={{
            backgroundColor: bannerColor || accentColor,
            backgroundImage: profile?.banner?.startsWith('/uploads/')
              ? `url(${resolveMediaUrl(profile.banner)})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="profile-customize__preview-avatar-wrap">
          <UserAvatar
            username={username}
            avatarUrl={profile?.avatar}
            avatarColor={accentColor}
            avatarDecoration={profile?.avatarDecoration}
            size={72}
          />
        </div>
      </div>

      <div className="setting-item profile-customize__block">
        <h4 className="setting-subheading profile-customize__heading">
          <PhotoCameraOutlinedIcon sx={{ fontSize: 16 }} />
          Аватар
        </h4>
        <div className="profile-customize__actions">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarUpload}
          />
          <button
            type="button"
            className="profile-customize__btn-primary"
            disabled={uploadBusy}
            onClick={() => avatarInputRef.current?.click()}
          >
            Загрузить фото
          </button>
          {profile?.avatar && (
            <button
              type="button"
              className="profile-customize__btn-secondary"
              disabled={uploadBusy}
              onClick={handleRemoveAvatar}
            >
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              Удалить
            </button>
          )}
        </div>
      </div>

      <div className="setting-item profile-customize__block">
        <h4 className="setting-subheading profile-customize__heading">
          <PaletteOutlinedIcon sx={{ fontSize: 16 }} />
          Цвет акцента
        </h4>
        <p className="setting-description">Для аватара без фото и градиента баннера</p>
        <ProfileColorPicker
          value={accentColor}
          presets={ACCENT_PRESETS}
          disabled={uploadBusy}
          onApply={handleAccentChange}
        />
      </div>

      <div className="setting-item profile-customize__block">
        <h4 className="setting-subheading">Баннер</h4>
        <p className="setting-description">Цвет или изображение в шапке профиля</p>
        <ProfileColorPicker
          value={bannerColor || BANNER_PRESETS[0]}
          presets={BANNER_PRESETS}
          disabled={uploadBusy}
          onApply={handleBannerColor}
        />
        <div className="profile-customize__actions">
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleBannerUpload}
          />
          <button
            type="button"
            className="profile-customize__btn-primary"
            disabled={uploadBusy}
            onClick={() => bannerInputRef.current?.click()}
          >
            Загрузить изображение
          </button>
          {profile?.banner && (
            <button
              type="button"
              className="profile-customize__btn-secondary"
              disabled={uploadBusy}
              onClick={handleRemoveBanner}
            >
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              Сбросить
            </button>
          )}
        </div>
      </div>

      <div className="setting-item profile-customize__block">
        <h4 className="setting-subheading">Табличка имени</h4>
        <p className="setting-description">
          Анимированный фон за именем в списке участников и голосовых каналах.
          {' '}
          {NAMEPLATE_SPEC_HINT}
        </p>
        <div className="profile-customize__nameplate-preview">
          <UserNameplate nameplate={profile?.nameplate} className="profile-customize__nameplate-demo">
            <span className="profile-customize__nameplate-label">{username || 'Пользователь'}</span>
          </UserNameplate>
        </div>
        <div className="profile-customize__actions">
          <input
            ref={nameplateInputRef}
            type="file"
            accept={NAMEPLATE_ACCEPT}
            hidden
            onChange={handleNameplateUpload}
          />
          <button
            type="button"
            className="profile-customize__btn-primary"
            disabled={uploadBusy}
            onClick={() => nameplateInputRef.current?.click()}
          >
            Загрузить свою
          </button>
          <button
            type="button"
            className="profile-customize__btn-secondary"
            disabled={uploadBusy}
            onClick={() => handleApplyTestNameplate(TEST_NAMEPLATE_PATH)}
          >
            Сакура
          </button>
          <button
            type="button"
            className="profile-customize__btn-secondary"
            disabled={uploadBusy}
            onClick={() => handleApplyTestNameplate(DODO_NAMEPLATE_PATH)}
          >
            Dodo
          </button>
          {profile?.nameplate && (
            <button
              type="button"
              className="profile-customize__btn-secondary"
              disabled={uploadBusy}
              onClick={handleRemoveNameplate}
            >
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              Убрать
            </button>
          )}
        </div>
      </div>

      <div className="setting-item profile-customize__block">
        <h4 className="setting-subheading">Рамка аватара</h4>
        <p className="setting-description">
          Анимированная обводка вокруг аватара, как в Discord.
          {' '}
          {AVATAR_DECORATION_SPEC_HINT}
        </p>
        <div className="profile-customize__decoration-preview">
          <UserAvatar
            username={username}
            avatarUrl={profile?.avatar}
            avatarColor={accentColor}
            avatarDecoration={profile?.avatarDecoration}
            size={80}
          />
        </div>
        <div className="profile-customize__actions">
          <input
            ref={avatarDecorationInputRef}
            type="file"
            accept={AVATAR_DECORATION_ACCEPT}
            hidden
            onChange={handleAvatarDecorationUpload}
          />
          <button
            type="button"
            className="profile-customize__btn-primary"
            disabled={uploadBusy}
            onClick={() => avatarDecorationInputRef.current?.click()}
          >
            Загрузить MP4/WebM/PNG
          </button>
          <button
            type="button"
            className="profile-customize__btn-secondary"
            disabled={uploadBusy}
            onClick={() => handleApplyTestAvatarDecoration()}
          >
            Тестовая рамка
          </button>
          {profile?.avatarDecoration && (
            <button
              type="button"
              className="profile-customize__btn-secondary"
              disabled={uploadBusy}
              onClick={handleRemoveAvatarDecoration}
            >
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              Убрать
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileCustomizeSection;
