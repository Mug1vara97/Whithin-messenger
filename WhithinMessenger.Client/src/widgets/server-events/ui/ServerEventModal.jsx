import React, { useEffect, useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import {
  SERVER_EVENT_LOCATION,
  collectServerChannels,
  isTextChannel,
  isVoiceChannel,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  serverEventApi,
} from '../../../entities/server-event';
import './ServerEvents.css';

const LOCATION_OPTIONS = [
  { value: SERVER_EVENT_LOCATION.VOICE, label: 'Голосовой канал' },
  { value: SERVER_EVENT_LOCATION.TEXT, label: 'Текстовый канал' },
  { value: SERVER_EVENT_LOCATION.EXTERNAL, label: 'Внешняя ссылка' },
];

const ServerEventModal = ({
  isOpen,
  onClose,
  mode = 'create',
  event = null,
  serverId,
  categories = [],
  connection,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [locationType, setLocationType] = useState(SERVER_EVENT_LOCATION.VOICE);
  const [channelId, setChannelId] = useState('');
  const [externalLocation, setExternalLocation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const channels = useMemo(() => collectServerChannels(categories), [categories]);
  const filteredChannels = useMemo(() => {
    if (locationType === SERVER_EVENT_LOCATION.VOICE) {
      return channels.filter(isVoiceChannel);
    }
    if (locationType === SERVER_EVENT_LOCATION.TEXT) {
      return channels.filter(isTextChannel);
    }
    return [];
  }, [channels, locationType]);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (mode === 'edit' && event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setStartsAt(toDatetimeLocalValue(event.startsAt));
      setEndsAt(toDatetimeLocalValue(event.endsAt));
      setLocationType(event.locationType || SERVER_EVENT_LOCATION.VOICE);
      setChannelId(event.channelId || '');
      setExternalLocation(event.externalLocation || '');
    } else {
      const soon = new Date(Date.now() + 60 * 60 * 1000);
      setTitle('');
      setDescription('');
      setStartsAt(toDatetimeLocalValue(soon.toISOString()));
      setEndsAt('');
      setLocationType(SERVER_EVENT_LOCATION.VOICE);
      setChannelId('');
      setExternalLocation('');
    }
  }, [isOpen, mode, event]);

  useEffect(() => {
    if (!filteredChannels.length) {
      setChannelId('');
      return;
    }
    if (!filteredChannels.some((c) => String(c.chatId) === String(channelId))) {
      setChannelId(String(filteredChannels[0].chatId));
    }
  }, [filteredChannels, channelId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!connection || connection.state !== 'Connected') {
      setError('Нет соединения с сервером');
      return;
    }
    if (!title.trim()) {
      setError('Укажите название');
      return;
    }
    const startsIso = fromDatetimeLocalValue(startsAt);
    if (!startsIso) {
      setError('Укажите дату начала');
      return;
    }
    const endsIso = endsAt ? fromDatetimeLocalValue(endsAt) : null;
    if (endsAt && !endsIso) {
      setError('Некорректная дата окончания');
      return;
    }

    const payload = {
      serverId,
      eventId: event?.eventId,
      title: title.trim(),
      description: description.trim() || null,
      startsAt: startsIso,
      endsAt: endsIso,
      locationType,
      channelId:
        locationType === SERVER_EVENT_LOCATION.EXTERNAL ? null : channelId || null,
      externalLocation:
        locationType === SERVER_EVENT_LOCATION.EXTERNAL
          ? externalLocation.trim()
          : null,
    };

    setSaving(true);
    try {
      if (mode === 'edit') {
        await serverEventApi.updateEvent(connection, payload);
      } else {
        await serverEventApi.createEvent(connection, payload);
      }
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="server-event-modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <div className="modal-header-text">
              <h2>{mode === 'edit' ? 'Редактировать мероприятие' : 'Создать мероприятие'}</h2>
              <p className="modal-subtitle">Как в Discord: время, место и участники</p>
            </div>
            <button type="button" className="close-button" onClick={onClose} aria-label="Закрыть">
              <FaTimes />
            </button>
          </div>

          <div className="server-event-modal-body">
            <label className="server-event-field">
              <span>Название</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Игровой вечер"
                required
              />
            </label>

            <label className="server-event-field">
              <span>Описание</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={4000}
                rows={3}
                placeholder="Необязательно"
              />
            </label>

            <div className="server-event-field-row">
              <label className="server-event-field">
                <span>Начало</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
              </label>
              <label className="server-event-field">
                <span>Конец</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </label>
            </div>

            <div className="server-event-field">
              <span>Место</span>
              <div className="server-event-location-options">
                {LOCATION_OPTIONS.map((opt) => (
                  <label key={opt.value} className="server-event-radio">
                    <input
                      type="radio"
                      name="locationType"
                      value={opt.value}
                      checked={locationType === opt.value}
                      onChange={() => setLocationType(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {locationType !== SERVER_EVENT_LOCATION.EXTERNAL ? (
              <label className="server-event-field">
                <span>Канал</span>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  required
                >
                  {filteredChannels.length === 0 && (
                    <option value="">Нет подходящих каналов</option>
                  )}
                  {filteredChannels.map((ch) => (
                    <option key={ch.chatId} value={ch.chatId}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="server-event-field">
                <span>Ссылка или адрес</span>
                <input
                  value={externalLocation}
                  onChange={(e) => setExternalLocation(e.target.value)}
                  maxLength={500}
                  placeholder="https://… или место встречи"
                  required
                />
              </label>
            )}

            {error && <div className="server-event-error">{error}</div>}
          </div>

          <div className="server-event-modal-footer">
            <button type="button" className="server-event-btn ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="server-event-btn primary" disabled={saving}>
              {saving ? 'Сохранение…' : mode === 'edit' ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServerEventModal;
