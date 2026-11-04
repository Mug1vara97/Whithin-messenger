import React, { useCallback, useEffect, useState } from 'react';
import {
  normalizeServerEvent,
  serverEventApi,
} from '../../../entities/server-event';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import ServerEventModal from './ServerEventModal';
import ServerEventsListModal from './ServerEventsListModal';
import ServerEventDetailModal from './ServerEventDetailModal';
import './ServerEvents.css';

const ServerEventsSection = ({
  serverId,
  serverName = '',
  connection,
  categories = [],
  canManageEvents = false,
  onSelectChannel,
  createRequested = false,
  onCreateRequestHandled,
  onEventsChange,
  openEventId = null,
  onOpenEventHandled,
  listOpenRequested = false,
  onListOpenHandled,
}) => {
  const connectionContext = useConnectionContext();
  const onReconnected = connectionContext?.onReconnected;

  const [events, setEvents] = useState([]);
  const [listOpen, setListOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);

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
    if (!connection || !serverId) {
      setEvents([]);
      return undefined;
    }

    let cancelled = false;
    let retryTimer = null;

    const tryLoad = async () => {
      if (cancelled) return;
      if (connection.state !== 'Connected') {
        retryTimer = window.setTimeout(tryLoad, 400);
        return;
      }
      try {
        const list = await serverEventApi.loadEvents(connection, serverId);
        if (!cancelled) setEvents(list);
      } catch (err) {
        console.warn('ServerEventsSection: load failed', err);
      }
    };

    tryLoad();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [connection, serverId]);

  useEffect(() => {
    if (!onReconnected) return undefined;
    return onReconnected(() => {
      if (connection?.state === 'Connected' && serverId) {
        serverEventApi.loadEvents(connection, serverId).then(setEvents).catch(() => {});
      }
    });
  }, [onReconnected, connection, serverId]);

  useEffect(() => {
    onEventsChange?.(events);
  }, [events, onEventsChange]);

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

  useEffect(() => {
    if (!listOpenRequested) return;
    setListOpen(true);
    load();
    onListOpenHandled?.();
  }, [listOpenRequested, load, onListOpenHandled]);

  useEffect(() => {
    if (!openEventId) return;
    const match = events.find((e) => String(e.eventId) === String(openEventId));
    if (match) {
      setDetailEvent(match);
      setListOpen(false);
      onOpenEventHandled?.();
      return;
    }
    if (events.length === 0) return;
    onOpenEventHandled?.();
  }, [openEventId, events, onOpenEventHandled]);

  return (
    <>
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
        onOpenEvent={(ev) => {
          setListOpen(false);
          setDetailEvent(ev);
        }}
        onEdit={(ev) => {
          setListOpen(false);
          setDetailEvent(null);
          setEditEvent(ev);
        }}
        onSelectChannel={onSelectChannel}
      />

      <ServerEventDetailModal
        isOpen={Boolean(detailEvent)}
        onClose={() => setDetailEvent(null)}
        event={
          detailEvent
            ? events.find((e) => String(e.eventId) === String(detailEvent.eventId)) || detailEvent
            : null
        }
        serverName={serverName}
        canManageEvents={canManageEvents}
        connection={connection}
        onEdit={(ev) => {
          setDetailEvent(null);
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
          load();
        }}
      />
    </>
  );
};

export default ServerEventsSection;
