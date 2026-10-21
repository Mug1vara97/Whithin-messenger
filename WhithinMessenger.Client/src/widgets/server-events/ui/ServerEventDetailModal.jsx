import React, { useState } from 'react';
import { FaTimes, FaHashtag, FaVolumeUp, FaLink } from 'react-icons/fa';
import {
  SERVER_EVENT_INTEREST,
  SERVER_EVENT_LOCATION,
  SERVER_EVENT_STATUS,
  formatEventWhen,
  serverEventApi,
} from '../../../entities/server-event';
import './ServerEvents.css';

const ServerEventDetailModal = ({
  isOpen,
  onClose,
  event,
  canManage,
  connection,
  onEdit,
  onSelectChannel,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !event) return null;

  const isCanceled = event.status === SERVER_EVENT_STATUS.CANCELED;

  const setInterest = async (interest) => {
    if (!connection || connection.state !== 'Connected' || isCanceled) return;
    setBusy(true);
    setError('');
    try {
      const next =
        event.myInterest === interest ? null : interest;
      await serverEventApi.setRsvp(connection, event.eventId, next);
    } catch (err) {
      setError(err?.message || 'Не удалось обновить RSVP');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!connection || !canManage) return;
    if (!window.confirm('Отменить мероприятие?')) return;
    setBusy(true);
    setError('');
    try {
      await serverEventApi.cancelEvent(connection, event.eventId);
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось отменить');
    } finally {
      setBusy(false);
    }
  };

  const openLocation = () => {
    if (event.locationType === SERVER_EVENT_LOCATION.EXTERNAL && event.externalLocation) {
      const url = /^https?:\/\//i.test(event.externalLocation)
        ? event.externalLocation
        : null;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    if (event.channelId && onSelectChannel) {
      onSelectChannel(event.channelId);
      onClose();
    }
  };

  const LocationIcon =
    event.locationType === SERVER_EVENT_LOCATION.VOICE
      ? FaVolumeUp
      : event.locationType === SERVER_EVENT_LOCATION.TEXT
        ? FaHashtag
        : FaLink;

  const locationLabel =
    event.locationType === SERVER_EVENT_LOCATION.EXTERNAL
      ? event.externalLocation
      : event.channelName
        ? `#${event.channelName}`
        : 'Канал';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="server-event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-text">
            <h2>{event.title}</h2>
            <p className="modal-subtitle">
              {formatEventWhen(event.startsAt, event.endsAt)}
              {isCanceled ? ' · Отменено' : ''}
            </p>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Закрыть">
            <FaTimes />
          </button>
        </div>

        <div className="server-event-modal-body">
          {event.description && (
            <p className="server-event-description">{event.description}</p>
          )}

          <button
            type="button"
            className="server-event-location-btn"
            onClick={openLocation}
            disabled={
              event.locationType !== SERVER_EVENT_LOCATION.EXTERNAL && !event.channelId
            }
          >
            <LocationIcon aria-hidden />
            <span>{locationLabel}</span>
          </button>

          {!isCanceled && (
            <div className="server-event-rsvp">
              <button
                type="button"
                className={`server-event-btn ${event.myInterest === SERVER_EVENT_INTEREST.INTERESTED ? 'primary' : 'ghost'}`}
                disabled={busy}
                onClick={() => setInterest(SERVER_EVENT_INTEREST.INTERESTED)}
              >
                Интересно · {event.interestedCount}
              </button>
              <button
                type="button"
                className={`server-event-btn ${event.myInterest === SERVER_EVENT_INTEREST.GOING ? 'primary' : 'ghost'}`}
                disabled={busy}
                onClick={() => setInterest(SERVER_EVENT_INTEREST.GOING)}
              >
                Пойду · {event.goingCount}
              </button>
            </div>
          )}

          {error && <div className="server-event-error">{error}</div>}
        </div>

        {canManage && !isCanceled && (
          <div className="server-event-modal-footer">
            <button type="button" className="server-event-btn danger" onClick={handleCancel} disabled={busy}>
              Отменить
            </button>
            <button
              type="button"
              className="server-event-btn primary"
              onClick={() => {
                onEdit?.(event);
              }}
              disabled={busy}
            >
              Изменить
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerEventDetailModal;
