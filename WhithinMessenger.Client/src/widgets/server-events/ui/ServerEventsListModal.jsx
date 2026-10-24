import React, { useEffect, useRef, useState } from 'react';
import {
  FaCheck,
  FaEllipsisH,
  FaLink,
  FaUserFriends,
  FaVolumeUp,
  FaMapMarkerAlt,
  FaHashtag,
} from 'react-icons/fa';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import {
  SERVER_EVENT_INTEREST,
  SERVER_EVENT_LOCATION,
  SERVER_EVENT_STATUS,
  pluralizeEvents,
  getEventStatusLabel,
  getEventLocationLabel,
  formatStartsIn,
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
  onOpen,
  onEdit,
  onSelectChannel,
  onClose,
  past = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isCanceled = event.status === SERVER_EVENT_STATUS.CANCELED;
  const isNew =
    !past &&
    event.createdAt &&
    Date.now() - new Date(event.createdAt).getTime() < 24 * 60 * 60 * 1000;
  const status = past
    ? 'Завершено'
    : isCanceled
      ? 'Отменено'
      : getEventStatusLabel(event) === 'Идёт сейчас'
        ? 'Идёт сейчас'
        : formatStartsIn(event.startsAt);
  const interested =
    event.myInterest === SERVER_EVENT_INTEREST.INTERESTED
    || event.myInterest === SERVER_EVENT_INTEREST.GOING;
  const interestCount = (event.goingCount || 0) + (event.interestedCount || 0);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const setInterest = async (e) => {
    e.stopPropagation();
    if (!connection || connection.state !== 'Connected' || isCanceled || past) return;
    setBusyId(event.eventId);
    setError('');
    try {
      const next = interested ? null : SERVER_EVENT_INTEREST.INTERESTED;
      await serverEventApi.setRsvp(connection, event.eventId, next);
    } catch (err) {
      setError(err?.message || 'Не удалось обновить статус');
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (e) => {
    e.stopPropagation();
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

  const openLocation = (e) => {
    e.stopPropagation();
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

  const cancelEvent = async (e) => {
    e.stopPropagation();
    if (!canManageEvents) return;
    if (!window.confirm('Отменить это событие?')) return;
    setMenuOpen(false);
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

  return (
    <article
      className={`sev-card sev-card--discord sev-card--clickable ${past ? 'is-past' : ''} ${isCanceled ? 'is-canceled' : ''}`}
      onClick={() => onOpen?.(event)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(event);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="sev-card__top">
        <div className="sev-card__status">
          {isNew && !isCanceled && !past && <span className="sev-card__pill">НОВОЕ</span>}
          <span className={`sev-card__when ${isCanceled || past ? 'is-muted' : ''}`}>
            {status}
          </span>
        </div>
        <div className="sev-card__meta">
          <span className="sev-card__interest">
            <FaUserFriends aria-hidden />
            {interestCount}
          </span>
        </div>
      </div>

      <h3 className="sev-card__title">{event.title}</h3>
      {event.description ? <p className="sev-card__desc">{event.description}</p> : null}

      <div className="sev-card__footer" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sev-card__location" onClick={openLocation}>
          <LocationIcon event={event} />
          <span>{getEventLocationLabel(event)}</span>
        </button>

        <div className="sev-card__actions">
          {canManageEvents && !isCanceled && !past ? (
            <div className="sev-card__menu" ref={menuRef}>
              <button
                type="button"
                className="sev-btn secondary sev-card__icon-btn"
                aria-label="Ещё"
                aria-expanded={menuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <FaEllipsisH />
              </button>
              {menuOpen ? (
                <div className="sev-card__menu-pop" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit?.(event);
                    }}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="is-danger"
                    disabled={busyId === event.eventId}
                    onClick={cancelEvent}
                  >
                    Отменить событие
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <button type="button" className="sev-btn secondary small" onClick={copyLink}>
            <FaLink aria-hidden />
            Копировать ссылку
          </button>

          {!past && !isCanceled ? (
            <button
              type="button"
              className={`sev-btn small ${interested ? 'green' : 'secondary'}`}
              disabled={busyId === event.eventId}
              onClick={setInterest}
            >
              {interested ? <FaCheck aria-hidden /> : null}
              Интересно
            </button>
          ) : null}
        </div>
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
  onOpenEvent,
  onSelectChannel,
}) => {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const upcoming = filterUpcomingEvents(events);
  const past = filterPastEvents(events);
  const headerCount = upcoming.length > 0 ? upcoming.length : events.length;

  return (
    <div className="server-events-overlay" onClick={onClose}>
      <div
        className="server-events-modal wide sev-list"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="События"
      >
        <div className="sev-list__header">
          <h2 className="sev-list__title">
            <EventAvailableIcon fontSize="small" />
            {headerCount > 0 ? pluralizeEvents(headerCount) : 'События'}
          </h2>
          {canManageEvents ? (
            <button type="button" className="sev-btn primary" onClick={onCreate}>
              Создать событие
            </button>
          ) : null}
        </div>

        <div className="sev-list__body">
          {upcoming.length === 0 && past.length === 0 && (
            <div className="sev-empty">
              Пока нет событий.
              {canManageEvents ? ' Создайте первое!' : ''}
            </div>
          )}

          {upcoming.map((event) => (
            <EventCard
              key={event.eventId}
              event={event}
              canManageEvents={canManageEvents}
              connection={connection}
              busyId={busyId}
              setBusyId={setBusyId}
              setError={setError}
              onOpen={onOpenEvent}
              onEdit={onEdit}
              onSelectChannel={onSelectChannel}
              onClose={onClose}
            />
          ))}

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
                  onOpen={onOpenEvent}
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
