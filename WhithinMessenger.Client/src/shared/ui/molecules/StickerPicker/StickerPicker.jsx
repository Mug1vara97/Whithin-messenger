import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stickerApi } from '../../../../entities/sticker/api';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import { buildMediaUrl } from '../../../lib/utils/urlHelpers';
import StickerMessage from '../StickerMessage/StickerMessage';
import EmojiPicker from '../EmojiPicker/EmojiPicker';
import { Add, Close, History, InsertEmoticon, UploadFile } from '@mui/icons-material';
import './StickerPicker.css';

const LONG_PRESS_MS = 450;
const STICKER_FILE_ACCEPT = '.webp,.png,.gif,.jpg,.jpeg,.webm,image/webp,image/png,image/gif,image/jpeg,video/webm';
const EMOJI_PANEL_ID = '__emoji__';

const normalizePack = (pack) => ({
  id: pack.id ?? pack.Id,
  title: pack.title ?? pack.Title ?? 'Стикеры',
  coverImagePath: pack.coverImagePath ?? pack.CoverImagePath ?? null,
  createdByUserId: pack.createdByUserId ?? pack.CreatedByUserId ?? null,
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
  onEmojiSelect,
  onInstallPack,
}) => {
  const { user } = useAuthContext();
  const currentUserId = user?.id || user?.userId || user?.Id;

  const [packs, setPacks] = useState([]);
  const [availablePacks, setAvailablePacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [activePanel, setActivePanel] = useState(EMOJI_PANEL_ID);
  const [isLoading, setIsLoading] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isCreatingPack, setIsCreatingPack] = useState(false);
  const [isAddingSticker, setIsAddingSticker] = useState(false);
  const [newPackTitle, setNewPackTitle] = useState('');
  const [error, setError] = useState(null);
  const [previewSticker, setPreviewSticker] = useState(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const addStickerInputRef = useRef(null);
  const uploadZipInputRef = useRef(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewSticker(null);
  }, []);

  useEffect(() => {
    if (!open) {
      closePreview();
      clearLongPressTimer();
    }
  }, [clearLongPressTimer, closePreview, open]);

  useEffect(() => {
    if (!previewSticker) return undefined;

    const onPointerUp = () => {
      closePreview();
    };

    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [closePreview, previewSticker]);

  const handleStickerPointerDown = useCallback((sticker) => (event) => {
    if (event.button !== 0) return;
    longPressTriggeredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setPreviewSticker(sticker);
    }, LONG_PRESS_MS);
  }, [clearLongPressTimer]);

  const handleStickerPointerEnd = useCallback(() => {
    clearLongPressTimer();
    if (longPressTriggeredRef.current) {
      closePreview();
    }
  }, [clearLongPressTimer, closePreview]);

  const handleStickerPointerLeave = useCallback(() => {
    if (longPressTriggeredRef.current) {
      return;
    }
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleStickerClick = useCallback((sticker) => (event) => {
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      longPressTriggeredRef.current = false;
      return;
    }
    onStickerSelect?.(sticker);
  }, [onStickerSelect]);

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
      setActivePanel((current) => {
        if (current === EMOJI_PANEL_ID) return current;
        if (current && normalized.some((pack) => pack.id === current)) return current;
        return EMOJI_PANEL_ID;
      });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Не удалось загрузить стикеры');
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
    setNewPackTitle('');
    try {
      const data = await stickerApi.getAvailablePacks();
      setAvailablePacks((Array.isArray(data) ? data : []).map(normalizePack));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Не удалось загрузить каталог');
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
      setActivePanel(packId);
      setIsCatalogOpen(false);
      onInstallPack?.(packId);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Не удалось добавить стикерпак');
    } finally {
      setIsInstalling(false);
    }
  }, [loadPacks, onInstallPack]);

  const handleCreateEmptyPack = useCallback(async () => {
    const title = newPackTitle.trim();
    if (!title) {
      setError('Укажите название стикерпака');
      return;
    }

    setIsCreatingPack(true);
    setError(null);
    try {
      const pack = await stickerApi.createPack(title);
      const normalized = normalizePack(pack);
      await loadPacks();
      setSelectedPackId(normalized.id);
      setActivePanel(normalized.id);
      setIsCatalogOpen(false);
      setNewPackTitle('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Не удалось создать стикерпак');
    } finally {
      setIsCreatingPack(false);
    }
  }, [loadPacks, newPackTitle]);

  const handleUploadZipPack = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const title = newPackTitle.trim();
    if (!title) {
      setError('Укажите название стикерпака перед загрузкой ZIP');
      return;
    }

    setIsCreatingPack(true);
    setError(null);
    try {
      const pack = await stickerApi.uploadPack(title, file);
      const normalized = normalizePack(pack);
      await loadPacks();
      setSelectedPackId(normalized.id);
      setActivePanel(normalized.id);
      setIsCatalogOpen(false);
      setNewPackTitle('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Не удалось загрузить стикерпак');
    } finally {
      setIsCreatingPack(false);
    }
  }, [loadPacks, newPackTitle]);

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) ?? null,
    [packs, selectedPackId],
  );

  const isEmojiPanel = activePanel === EMOJI_PANEL_ID;
  const activePackId = isEmojiPanel ? selectedPackId : activePanel;

  const isSelectedPackOwned = useMemo(() => {
    const pack = packs.find((item) => item.id === activePackId) ?? selectedPack;
    if (!pack?.createdByUserId || !currentUserId) return false;
    return String(pack.createdByUserId) === String(currentUserId);
  }, [activePackId, currentUserId, packs, selectedPack?.createdByUserId]);

  const activeStickerPack = useMemo(
    () => packs.find((pack) => pack.id === activePackId) ?? selectedPack,
    [activePackId, packs, selectedPack],
  );

  const handleAddStickerToPack = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const targetPackId = activePanel === EMOJI_PANEL_ID ? selectedPackId : activePanel;
    if (!file || !targetPackId) return;

    setIsAddingSticker(true);
    setError(null);
    try {
      const result = await stickerApi.addStickerToPack(targetPackId, file);
      const updatedPack = normalizePack(result.pack ?? result.Pack);
      setPacks((prev) =>
        prev.map((pack) => (pack.id === updatedPack.id ? updatedPack : pack)),
      );
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Не удалось добавить стикер');
    } finally {
      setIsAddingSticker(false);
    }
  }, [activePanel, selectedPackId]);

  if (!open) {
    return null;
  }

  return (
    <>
      <aside
        className="sticker-picker"
        role="complementary"
        aria-label="Эмодзи и стикеры"
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
            {isEmojiPanel ? 'Эмодзи' : (activeStickerPack?.title ?? 'Стикеры')}
          </span>
          <div className="sticker-picker__header-actions">
            {!isEmojiPanel && isSelectedPackOwned && (
              <>
                <input
                  ref={addStickerInputRef}
                  type="file"
                  accept={STICKER_FILE_ACCEPT}
                  className="sticker-picker__hidden-input"
                  onChange={handleAddStickerToPack}
                />
                <button
                  type="button"
                  className="sticker-picker__header-btn"
                  onClick={() => addStickerInputRef.current?.click()}
                  disabled={isAddingSticker}
                  title="Добавить стикер в пак"
                >
                  <Add fontSize="small" />
                </button>
              </>
            )}
            <button type="button" className="sticker-picker__close" onClick={onClose} title="Закрыть">
              <Close fontSize="small" />
            </button>
          </div>
        </div>

        {error && <div className="sticker-picker__error">{error}</div>}

        <div className="sticker-picker__grid-wrap">
          {isEmojiPanel ? (
            <EmojiPicker embedded onEmojiSelect={onEmojiSelect} />
          ) : isLoading ? (
            <div className="sticker-picker__empty">Загрузка...</div>
          ) : packs.length === 0 ? (
            <div className="sticker-picker__empty">
              Нажмите +, чтобы создать или добавить стикерпак
            </div>
          ) : !activeStickerPack?.stickers?.length ? (
            <div className="sticker-picker__empty">
              {isSelectedPackOwned
                ? 'В паке пока нет стикеров. Нажмите + сверху, чтобы добавить.'
                : 'В этом паке пока нет стикеров'}
            </div>
          ) : (
            <div className="sticker-picker__grid">
              {activeStickerPack.stickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  className="sticker-picker__cell"
                  onPointerDown={handleStickerPointerDown(sticker)}
                  onPointerUp={handleStickerPointerEnd}
                  onPointerCancel={handleStickerPointerEnd}
                  onPointerLeave={handleStickerPointerLeave}
                  onClick={handleStickerClick(sticker)}
                  title="Клик — отправить. Удерживайте для предпросмотра."
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
            className={`sticker-picker__pack-btn ${isEmojiPanel ? 'is-selected' : ''}`}
            onClick={() => setActivePanel(EMOJI_PANEL_ID)}
            title="Эмодзи"
          >
            <InsertEmoticon fontSize="small" />
          </button>
          <button
            type="button"
            className="sticker-picker__pack-btn"
            onClick={openCatalog}
            title="Создать или добавить стикерпак"
          >
            <Add fontSize="small" />
          </button>
          {packs.map((pack) => {
            const coverUrl = pack.coverImagePath ? buildMediaUrl(pack.coverImagePath) : null;
            const isSelected = !isEmojiPanel && pack.id === activePackId;
            return (
              <button
                key={pack.id}
                type="button"
                className={`sticker-picker__pack-btn ${isSelected ? 'is-selected' : ''}`}
                onClick={() => {
                  setSelectedPackId(pack.id);
                  setActivePanel(pack.id);
                }}
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

      {previewSticker && (
        <div className="sticker-preview-overlay" role="presentation" aria-hidden="true">
          <StickerMessage sticker={previewSticker} size={300} className="sticker-preview-overlay__sticker" />
        </div>
      )}

      {isCatalogOpen && (
        <div className="sticker-catalog-overlay" onClick={() => setIsCatalogOpen(false)}>
          <div className="sticker-catalog" onClick={(e) => e.stopPropagation()}>
            <div className="sticker-catalog__header">
              <h3>Стикерпаки</h3>
              <button type="button" onClick={() => setIsCatalogOpen(false)}>
                <Close fontSize="small" />
              </button>
            </div>

            <div className="sticker-catalog__create">
              <label className="sticker-catalog__label" htmlFor="sticker-pack-title">
                Создать стикерпак
              </label>
              <input
                id="sticker-pack-title"
                type="text"
                className="sticker-catalog__input"
                placeholder="Название пака"
                value={newPackTitle}
                maxLength={100}
                onChange={(e) => setNewPackTitle(e.target.value)}
              />
              <div className="sticker-catalog__create-actions">
                <button
                  type="button"
                  disabled={isCreatingPack}
                  onClick={handleCreateEmptyPack}
                >
                  Пустой пак
                </button>
                <input
                  ref={uploadZipInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="sticker-picker__hidden-input"
                  onChange={handleUploadZipPack}
                />
                <button
                  type="button"
                  className="sticker-catalog__upload-btn"
                  disabled={isCreatingPack}
                  onClick={() => uploadZipInputRef.current?.click()}
                >
                  <UploadFile fontSize="small" />
                  ZIP-архив
                </button>
              </div>
              <p className="sticker-catalog__hint">
                Любой пользователь может создать пак. Добавлять стикеры в пак может только его создатель.
              </p>
            </div>

            <div className="sticker-catalog__section-title">Каталог</div>
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
