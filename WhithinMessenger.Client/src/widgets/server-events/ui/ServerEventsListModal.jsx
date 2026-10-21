import React, { useState } from 'react';
import { FaTimes, FaLink, FaVolumeUp, FaMapMarkerAlt, FaHashtag } from 'react-icons/fa';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import {
  SERVER_EVENT_INTEREST,
  SERVER_EVENT_LOCATION,
  SERVER_EVENT_STATUS,
  pluralizeEvents,
  getEventStatusLabel,
  getEventLocationLabel,
  formatEventWhen,
  filterUpcomingEvents,
  filterPastEvents,
  serverEventApi,
} from '../../../entities/server-event';
import './ServerEvents.css';

const LocationIcon = ({ event }) => {
  if (event.locationType === SERVER_EVENT_LOCATION.VOICE) return <FaVolumeUp />;
  if (event.locationType === SERVER_EVENT_LOCATION.TEXT) return <FaHashtag />;
  return <FaMapMarkerAlt />;
};

const EventCard = ({
  event,
  canManageEvents,
  connection,
  busyId,
  setBusyId,
  setError,
  onEdit,
  onSelectChannel,
  onClose,
  past = false,
}) => {
  const isCanceled = event.status === SERVER_EVENT_STATUS.CANCELED;
  const isNew =
    !past &&
    event.createdAt &&
    Date.now() - new Date(event.createdAt).getTime() < 24 * 60 * 60 * 1000;
  const status = getEventStatusLabel(event);
  const interested =
    event.myInterest === SERVER_EVENT_INTEREST.INTERESTED
    || event.myInterest === SERVER_EVENT_INTEREST.GOING;

  const setInterest = async (interest) => {
    if (!connection || connection.state !== 'Connected' || isCanceled) return;
    setBusyId(event.eventId);
    setError('');
    try {
      const next = event.myInterest === interest ? null : interest;
      await serverEventApi.setRsvp(connection, event.eventId, next);
    } catch (err) {
      setError(err?.message || 'Не удалось обновить статус');
    } finally {
      setBusyId(null);
    }
  };

  const cancelEvent = async () => {
    if (!canManageEvents) return;
    if (!window.confirm('Отменить это событие?')) return;
    setBusyId(event.eventId);
    setError('');
    try {
      await serverEventApi.cancelEvent(connection, event.eventId);
    } catch (err) {
      setError(err?.message || 'Не удалось отменить');
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async () => {
    const text =
      event.locationType === SERVER_EVENT_LOCATION.EXTERNAL && event.externalLocation
        ? event.externalLocation
        : `${window.location.origin}/?event=${event.eventId}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError('Не удалось скопировать ссылку');
    }
  };

  const openLocation = () => {
    if (event.locationType === SERVER_EVENT_LOCATION.EXTERNAL && event.externalLocation) {
      if (/^https?:\/\//i.test(event.externalLocation)) {
        window.open(event.externalLocation, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    if (event.channelId && onSelectChannel) {
      onSelectChannel(event.channelId);
      onClose();
    }
  };

  return (
    <article
      className={`sev-card ${past ? 'is-past' : ''} ${isCanceled ? 'is-canceled' : ''}`}
    >
      <div className="sev-card-top">
        <div className={`sev-card-status ${isNew ? 'new' : ''}`}>
          {isNew && status !== 'Скоро начнётся' && status !== 'Идёт сейчас' && (
            <span className="pill">НОВОЕ</span>
          )}
          <EventAvailableIcon sx={{ fontSize: 14 }} />
          {isCanceled ? 'Отменено' : past ? 'Завершено' : status}
        </div>
        <div className="sev-card-meta">
          <span>{(event.goingCount || 0) + (event.interestedCount || 0)}</span>
        </div>
      </div>

      <h3 className="sev-card-title">{event.title}</h3>
      {event.description && <p className="sev-card-desc">{event.description}</p>}
      <p className="sev-card-desc">{formatEventWhen(event.startsAt, event.endsAt)}</p>

      <button type="button" className="sev-card-location" onClick={openLocation}>
        <LocationIcon event={event} />
        {getEventLocationLabel(event)}
      </button>

      <div className="sev-card-actions">
        <button type="button" className="sev-btn ghost small" onClick={copyLink}>
          <FaLink style={{ marginRight: 6 }} />
          Копировать ссылку
        </button>

        {!past && !isCanceled && (
          <button
            type="button"
            className={`sev-btn small ${interested ? 'green' : 'ghost'}`}
            disabled={busyId === event.eventId}
            onClick={() => setInterest(SERVER_EVENT_INTEREST.INTERESTED)}
          >
            Интересно
          </button>
        )}

        {canManageEvents && !isCanceled && !past && (
          <>
            <button type="button" className="sev-btn ghost small" onClick={() => onEdit?.(event)}>
              Изменить
            </button>
            <button
              type="button"
              className="sev-btn danger small"
              disabled={busyId === event.eventId}
              onClick={cancelEvent}
            >
              Отменить
            </button>
          </>
        )}
      </div>
    </article>
  );
};

const ServerEventsListModal = ({
  isOpen,
  onClose,
  events = [],
  canManageEvents = false,
  connection,
  onCreate,
  onEdit,
  onSelectChannel,
}) => {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const upcoming = filterUpcomingEvents(events);
  const past = filterPastEvents(events);

  return (
    <div className="server-events-overlay" onClick={onClose}>
      <div className="server-events-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="server-events-modal-header">
          <h2>
            <EventAvailableIcon fontSize="small" />
            {upcoming.length > 0 ? pluralizeEvents(upcoming.length) : 'События'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canManageEvents && (
              <button type="button" className="sev-btn primary small" onClick={onCreate}>
                Создать событие
              </button>
            )}
            <button type="button" className="server-events-modal-close" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="server-events-modal-body">
          {upcoming.length === 0 && past.length === 0 && (
            <div className="sev-empty">
              Пока нет событий.
              {canManageEvents ? ' Создайте первое!' : ''}
            </div>
          )}

          {upcoming.length > 0 && (
            <>
              <div className="sev-section-label">Предстоящие</div>
              {upcoming.map((event) => (
                <EventCard
                  key={event.eventId}
                  event={event}
                  canManageEvents={canManageEvents}
                  connection={connection}
                  busyId={busyId}
                  setBusyId={setBusyId}
                  setError={setError}
                  onEdit={onEdit}
                  onSelectChannel={onSelectChannel}
                  onClose={onClose}
                />
              ))}
            </>
          )}

          {past.length > 0 && (
            <>
              <div className="sev-section-label">Прошедшие</div>
              {past.map((event) => (
                <EventCard
                  key={event.eventId}
                  event={event}
                  canManageEvents={canManageEvents}
                  connection={connection}
                  busyId={busyId}
                  setBusyId={setBusyId}
                  setError={setError}
                  onEdit={onEdit}
                  onSelectChannel={onSelectChannel}
                  onClose={onClose}
                  past
                />
              ))}
            </>
          )}

          {error && <div className="sev-error">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default ServerEventsListModal;
