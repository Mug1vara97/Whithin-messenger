import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EventAvailable } from '@mui/icons-material';
import {
  SERVER_EVENT_STATUS,
  formatEventWhen,
  normalizeServerEvent,
  serverEventApi,
} from '../../../entities/server-event';
import ServerEventModal from './ServerEventModal';
import ServerEventDetailModal from './ServerEventDetailModal';
import './ServerEvents.css';

const ServerEventsSection = ({
  serverId,
  connection,
  categories = [],
  canManageEvents = false,
  onSelectChannel,
  createRequested = false,
  onCreateRequestHandled,
}) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);

  const upsertEvent = useCallback((raw) => {
    const event = normalizeServerEvent(raw);
    if (!event?.eventId) return;
    setEvents((prev) => {
      const idx = prev.findIndex((e) => String(e.eventId) === String(event.eventId));
      if (idx === -1) return [...prev, event].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      const next = [...prev];
      next[idx] = { ...next[idx], ...event };
      return next.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    });
  }, []);

  const load = useCallback(async () => {
    if (!connection || connection.state !== 'Connected' || !serverId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const list = await serverEventApi.loadEvents(connection, serverId);
      setEvents(list);
    } catch (err) {
      console.warn('ServerEventsSection: load failed', err);
    } finally {
      setLoading(false);
    }
  }, [connection, serverId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!connection) return undefined;

    const onCreated = (payload) => upsertEvent(payload);
    const onUpdated = (payload) => upsertEvent(payload);
    const onCanceled = (payload) => upsertEvent(payload);
    const onRsvp = (payload) => upsertEvent(payload);

    connection.on('ServerEventCreated', onCreated);
    connection.on('ServerEventUpdated', onUpdated);
    connection.on('ServerEventCanceled', onCanceled);
    connection.on('ServerEventRsvpUpdated', onRsvp);

    return () => {
      connection.off('ServerEventCreated', onCreated);
      connection.off('ServerEventUpdated', onUpdated);
      connection.off('ServerEventCanceled', onCanceled);
      connection.off('ServerEventRsvpUpdated', onRsvp);
    };
  }, [connection, upsertEvent]);

  useEffect(() => {
    if (createRequested) {
      setCreateOpen(true);
      onCreateRequestHandled?.();
    }
  }, [createRequested, onCreateRequestHandled]);

  useEffect(() => {
    if (!detailEvent) return;
    const fresh = events.find((e) => String(e.eventId) === String(detailEvent.eventId));
    if (fresh) setDetailEvent(fresh);
  }, [events, detailEvent?.eventId]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => {
      if (e.status === SERVER_EVENT_STATUS.CANCELED) return false;
      const end = e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + 2 * 60 * 60 * 1000;
      return end >= now - 60 * 60 * 1000;
    });
  }, [events]);

  const visible = showAll ? upcoming : upcoming.slice(0, 5);

  return (
    <div className="server-events-section">
      <div className="server-events-header">
        <div className="server-events-title">
          <EventAvailable sx={{ fontSize: 16 }} />
          <span>Мероприятия</span>
        </div>
        {canManageEvents && (
          <button
            type="button"
            className="server-events-add"
            onClick={() => setCreateOpen(true)}
            title="Создать мероприятие"
          >
            +
          </button>
        )}
      </div>

      {loading && upcoming.length === 0 && (
        <div className="server-events-empty">Загрузка…</div>
      )}

      {!loading && upcoming.length === 0 && (
        <div className="server-events-empty">Пока нет мероприятий</div>
      )}

      <ul className="server-events-list">
        {visible.map((event) => (
          <li key={event.eventId}>
            <button
              type="button"
              className="server-event-item"
              onClick={() => setDetailEvent(event)}
            >
              <span className="server-event-item-title">{event.title}</span>
              <span className="server-event-item-when">
                {formatEventWhen(event.startsAt, event.endsAt)}
              </span>
              <span className="server-event-item-rsvp">
                {event.goingCount} пойдут · {event.interestedCount} интересно
              </span>
            </button>
          </li>
        ))}
      </ul>

      {upcoming.length > 5 && (
        <button
          type="button"
          className="server-events-more"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Свернуть' : `Все (${upcoming.length})`}
        </button>
      )}

      <ServerEventModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        serverId={serverId}
        categories={categories}
        connection={connection}
      />

      <ServerEventModal
        isOpen={Boolean(editEvent)}
        onClose={() => setEditEvent(null)}
        mode="edit"
        event={editEvent}
        serverId={serverId}
        categories={categories}
        connection={connection}
      />

      <ServerEventDetailModal
        isOpen={Boolean(detailEvent)}
        onClose={() => setDetailEvent(null)}
        event={detailEvent}
        canManage={canManageEvents}
        connection={connection}
        onEdit={(ev) => {
          setDetailEvent(null);
          setEditEvent(ev);
        }}
        onSelectChannel={onSelectChannel}
      />
    </div>
  );
};

export default ServerEventsSection;
