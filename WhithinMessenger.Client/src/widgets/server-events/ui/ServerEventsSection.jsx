import React, { useCallback, useEffect, useMemo, useState } from 'react';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import {
  countActiveEvents,
  normalizeServerEvent,
  pluralizeEvents,
  serverEventApi,
} from '../../../entities/server-event';
import ServerEventModal from './ServerEventModal';
import ServerEventsListModal from './ServerEventsListModal';
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
  const [listOpen, setListOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);

  const upsertEvent = useCallback((raw) => {
    const event = normalizeServerEvent(raw);
    if (!event?.eventId) return;
    setEvents((prev) => {
      const idx = prev.findIndex((e) => String(e.eventId) === String(event.eventId));
      if (idx === -1) {
        return [...prev, event].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...event };
      return next.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    });
  }, []);

  const load = useCallback(async () => {
    if (!connection || connection.state !== 'Connected' || !serverId) {
      return;
    }
    try {
      const list = await serverEventApi.loadEvents(connection, serverId);
      setEvents(list);
    } catch (err) {
      console.warn('ServerEventsSection: load failed', err);
    }
  }, [connection, serverId]);

  useEffect(() => {
    if (!connection || connection.state !== 'Connected' || !serverId) {
      setEvents([]);
      return;
    }
    load();
  }, [connection, serverId, load]);

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
    if (!createRequested) return;
    setCreateOpen(true);
    onCreateRequestHandled?.();
  }, [createRequested, onCreateRequestHandled]);

  const activeCount = useMemo(() => countActiveEvents(events), [events]);
  const label = activeCount > 0 ? pluralizeEvents(activeCount) : 'События';

  const openList = useCallback(() => {
    setListOpen(true);
    load();
  }, [load]);

  return (
    <div className="server-events-nav">
      <button
        type="button"
        className={`server-events-nav-btn ${listOpen ? 'is-active' : ''}`}
        onClick={openList}
      >
        <EventAvailableIcon sx={{ fontSize: 20 }} />
        <span>{label}</span>
      </button>

      <ServerEventsListModal
        isOpen={listOpen}
        onClose={() => setListOpen(false)}
        events={events}
        canManageEvents={canManageEvents}
        connection={connection}
        onCreate={() => {
          setListOpen(false);
          setCreateOpen(true);
        }}
        onEdit={(ev) => {
          setListOpen(false);
          setEditEvent(ev);
        }}
        onSelectChannel={onSelectChannel}
      />

      <ServerEventModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        serverId={serverId}
        categories={categories}
        connection={connection}
        onCreated={() => {
          setCreateOpen(false);
          setListOpen(true);
          load();
        }}
      />

      <ServerEventModal
        isOpen={Boolean(editEvent)}
        onClose={() => setEditEvent(null)}
        mode="edit"
        event={editEvent}
        serverId={serverId}
        categories={categories}
        connection={connection}
        onCreated={() => {
          setEditEvent(null);
          setListOpen(true);
          load();
        }}
      />
    </div>
  );
};

export default ServerEventsSection;
