import React, { useEffect, useRef, useState } from 'react';
import {
  FaCalendarAlt,
  FaCheck,
  FaEllipsisH,
  FaHashtag,
  FaLink,
  FaMapMarkerAlt,
  FaUserFriends,
  FaVolumeUp,
} from 'react-icons/fa';
import {
  SERVER_EVENT_INTEREST,
  SERVER_EVENT_LOCATION,
  SERVER_EVENT_STATUS,
  formatInterestedPeople,
  formatStartsIn,
  getEventLocationLabel,
  getEventStatusLabel,
  serverEventApi,
} from '../../../entities/server-event';
import './ServerEvents.css';

const LocationIcon = ({ event }) => {
  if (event?.locationType === SERVER_EVENT_LOCATION.VOICE) return <FaVolumeUp />;
  if (event?.locationType === SERVER_EVENT_LOCATION.TEXT) return <FaHashtag />;
  return <FaMapMarkerAlt />;
};

const ServerEventDetailModal = ({
  isOpen,
  onClose,
  event = null,
  serverName = '',
  canManageEvents = false,
  connection,
  onEdit,
  onSelectChannel,
}) => {
  const [tab, setTab] = useState('details');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setTab('details');
    setError('');
    setMenuOpen(false);
  }, [isOpen, event?.eventId]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  if (!isOpen || !event) return null;

  const isCanceled = event.status === SERVER_EVENT_STATUS.CANCELED;
  const interestedCount = Number(event.interestedCount || 0) + Number(event.goingCount || 0);
  const isInterested =
    event.myInterest === SERVER_EVENT_INTEREST.INTERESTED
    || event.myInterest === SERVER_EVENT_INTEREST.GOING;
  const startsLabel = isCanceled
    ? 'Отменено'
    : getEventStatusLabel(event) === 'Идёт сейчас'
      ? 'Идёт сейчас'
      : formatStartsIn(event.startsAt);
  const serverLabel = serverName || 'Сервер';
  const serverLetter = (serverLabel.trim()[0] || 'S').toUpperCase();
  const creator = event.createdByUsername || 'пользователь';

  const setInterest = async () => {
    if (!connection || connection.state !== 'Connected' || isCanceled || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = isInterested ? null : SERVER_EVENT_INTEREST.INTERESTED;
      await serverEventApi.setRsvp(connection, event.eventId, next);
    } catch (err) {
      setError(err?.message || 'Не удалось обновить статус');
    } finally {
      setBusy(false);
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

  const cancelEvent = async () => {
    if (!canManageEvents || !connection) return;
    if (!window.confirm('Отменить это событие?')) return;
    setMenuOpen(false);
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

  return (
    <div className="server-events-overlay" onClick={onClose}>
      <div
        className="server-events-modal sev-detail"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
      >
        <div className="sev-detail__header">
          <h2 className="sev-detail__heading">{event.title}</h2>
          <div className="sev-detail__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'details'}
              className={`sev-detail__tab ${tab === 'details' ? 'is-active' : ''}`}
              onClick={() => setTab('details')}
            >
              Сведения о событии
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'interested'}
              className={`sev-detail__tab ${tab === 'interested' ? 'is-active' : ''}`}
              onClick={() => setTab('interested')}
            >
              Интересуются: {interestedCount}
            </button>
          </div>
        </div>

        <div className="sev-detail__body">
          {tab === 'details' ? (
            <div className="sev-detail__info">
              <div className="sev-detail__row sev-detail__row--accent">
                <FaCalendarAlt aria-hidden />
                <span>{startsLabel}</span>
              </div>

              <h3 className="sev-detail__title">{event.title}</h3>

              {event.description ? (
                <p className="sev-detail__desc">{event.description}</p>
              ) : null}

              <div className="sev-detail__row">
                <span className="sev-detail__server-icon" aria-hidden>
                  {serverLetter}
                </span>
                <span>{serverLabel}</span>
              </div>

              <button type="button" className="sev-detail__row sev-detail__row--btn" onClick={openLocation}>
                <LocationIcon event={event} />
                <span>{getEventLocationLabel(event)}</span>
              </button>

              <div className="sev-detail__row">
                <FaUserFriends aria-hidden />
                <span>{formatInterestedPeople(interestedCount)}</span>
              </div>

              <div className="sev-detail__row">
                <span className="sev-detail__creator-icon" aria-hidden>
                  {(creator[0] || '?').toUpperCase()}
                </span>
                <span>Создано {creator}</span>
              </div>
            </div>
          ) : (
            <div className="sev-detail__interested">
              <p className="sev-detail__interested-count">{formatInterestedPeople(interestedCount)}</p>
              <p className="sev-detail__interested-hint">
                Список участников появится здесь, когда больше людей отметит интерес.
              </p>
            </div>
          )}

          {error ? <div className="sev-error">{error}</div> : null}
        </div>

        <div className="sev-detail__footer">
          <div className="sev-detail__menu" ref={menuRef}>
            {canManageEvents && !isCanceled ? (
              <>
                <button
                  type="button"
                  className="sev-btn secondary sev-detail__icon-btn"
                  aria-label="Ещё"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <FaEllipsisH />
                </button>
                {menuOpen ? (
                  <div className="sev-detail__menu-pop" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
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
                      disabled={busy}
                      onClick={cancelEvent}
                    >
                      Отменить событие
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="sev-detail__actions">
            <button type="button" className="sev-btn secondary" onClick={copyLink}>
              <FaLink aria-hidden />
              Копировать ссылку
            </button>
            {!isCanceled ? (
              <button
                type="button"
                className={`sev-btn ${isInterested ? 'green' : 'secondary'}`}
                disabled={busy}
                onClick={setInterest}
              >
                {isInterested ? <FaCheck aria-hidden /> : null}
                Интересно
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerEventDetailModal;
