import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { stickerApi } from '../../../../entities/sticker/api';
import { buildMediaUrl } from '../../../lib/utils/urlHelpers';
import StickerMessage from '../StickerMessage/StickerMessage';
import { Add, Close, History } from '@mui/icons-material';
import './StickerPicker.css';

const normalizePack = (pack) => ({
  id: pack.id ?? pack.Id,
  title: pack.title ?? pack.Title ?? 'Стикеры',
  coverImagePath: pack.coverImagePath ?? pack.CoverImagePath ?? null,
  stickers: (pack.stickers ?? pack.Stickers ?? []).map((sticker) => ({
    id: sticker.id ?? sticker.Id,
    stickerPackId: sticker.stickerPackId ?? sticker.StickerPackId,
    filePath: sticker.filePath ?? sticker.FilePath ?? '',
    contentType: sticker.contentType ?? sticker.ContentType ?? 'image/webp',
    sortOrder: sticker.sortOrder ?? sticker.SortOrder ?? 0,
  })),
});

const StickerPicker = ({
  open,
  width,
  onResizeStart,
  onClose,
  onStickerSelect,
  onInstallPack,
}) => {
  const [packs, setPacks] = useState([]);
  const [availablePacks, setAvailablePacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState(null);

  const loadPacks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await stickerApi.getInstalledPacks();
      const normalized = (Array.isArray(data) ? data : []).map(normalizePack);
      setPacks(normalized);
      setSelectedPackId((current) => {
        if (current && normalized.some((pack) => pack.id === current)) {
          return current;
        }
        return normalized[0]?.id ?? null;
      });
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить стикеры');
      setPacks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setIsCatalogOpen(false);
      return;
    }
    loadPacks();
  }, [open, loadPacks]);

  const openCatalog = useCallback(async () => {
    setIsCatalogOpen(true);
    setError(null);
    try {
      const data = await stickerApi.getAvailablePacks();
      setAvailablePacks((Array.isArray(data) ? data : []).map(normalizePack));
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить каталог');
      setAvailablePacks([]);
    }
  }, []);

  const handleInstall = useCallback(async (packId) => {
    setIsInstalling(true);
    setError(null);
    try {
      await stickerApi.installPack(packId);
      await loadPacks();
      setSelectedPackId(packId);
      setIsCatalogOpen(false);
      onInstallPack?.(packId);
    } catch (err) {
      setError(err?.message || 'Не удалось добавить стикерпак');
    } finally {
      setIsInstalling(false);
    }
  }, [loadPacks, onInstallPack]);

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) ?? null,
    [packs, selectedPackId],
  );

  if (!open) {
    return null;
  }

  return (
    <>
      <aside
        className="sticker-picker"
        role="complementary"
        aria-label="Выбор стикеров"
        style={width ? { width, flexBasis: width } : undefined}
      >
        <div
          className="sticker-picker__resize-handle"
          onMouseDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели стикеров"
          title="Потяните, чтобы изменить ширину"
        />
        <div className="sticker-picker__header">
          <span className="sticker-picker__title">
            {selectedPack?.title ?? 'Стикеры'}
          </span>
          <button type="button" className="sticker-picker__close" onClick={onClose} title="Закрыть">
            <Close fontSize="small" />
          </button>
        </div>

        {error && <div className="sticker-picker__error">{error}</div>}

        <div className="sticker-picker__grid-wrap">
          {isLoading ? (
            <div className="sticker-picker__empty">Загрузка...</div>
          ) : packs.length === 0 ? (
            <div className="sticker-picker__empty">
              Нажмите +, чтобы добавить стикерпак
            </div>
          ) : !selectedPack?.stickers?.length ? (
            <div className="sticker-picker__empty">В этом паке пока нет стикеров</div>
          ) : (
            <div className="sticker-picker__grid">
              {selectedPack.stickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  className="sticker-picker__cell"
                  onClick={() => onStickerSelect?.(sticker)}
                  title="Отправить стикер"
                >
                  <StickerMessage sticker={sticker} size={64} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sticker-picker__packs">
          <button
            type="button"
            className="sticker-picker__pack-btn"
            onClick={openCatalog}
            title="Добавить стикерпак"
          >
            <Add fontSize="small" />
          </button>
          {packs.map((pack) => {
            const coverUrl = pack.coverImagePath ? buildMediaUrl(pack.coverImagePath) : null;
            const isSelected = pack.id === selectedPackId;
            return (
              <button
                key={pack.id}
                type="button"
                className={`sticker-picker__pack-btn ${isSelected ? 'is-selected' : ''}`}
                onClick={() => setSelectedPackId(pack.id)}
                title={pack.title}
              >
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="sticker-picker__pack-cover" />
                ) : (
                  <History fontSize="small" />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {isCatalogOpen && (
        <div className="sticker-catalog-overlay" onClick={() => setIsCatalogOpen(false)}>
          <div className="sticker-catalog" onClick={(e) => e.stopPropagation()}>
            <div className="sticker-catalog__header">
              <h3>Добавить стикерпак</h3>
              <button type="button" onClick={() => setIsCatalogOpen(false)}>
                <Close fontSize="small" />
              </button>
            </div>
            <div className="sticker-catalog__list">
              {availablePacks.length === 0 ? (
                <div className="sticker-picker__empty">Нет доступных стикерпаков</div>
              ) : (
                availablePacks.map((pack) => (
                  <div key={pack.id} className="sticker-catalog__item">
                    <div className="sticker-catalog__info">
                      <strong>{pack.title}</strong>
                      <span>{pack.stickers.length} стикеров</span>
                    </div>
                    <button
                      type="button"
                      disabled={isInstalling}
                      onClick={() => handleInstall(pack.id)}
                    >
                      Добавить
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StickerPicker;
