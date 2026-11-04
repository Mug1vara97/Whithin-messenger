import {
  normalizeServerEvent,
  SERVER_EVENT_INTEREST,
} from '../model/types';

export const serverEventApi = {
  async loadEvents(connection, serverId) {
    if (!connection || !serverId) {
      return [];
    }

    if (connection.state !== 'Connected') {
      return [];
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };

      const timeout = setTimeout(() => {
        finish(reject, new Error('Timeout loading server events'));
      }, 15000);

      const onLoaded = (events) => {
        const list = Array.isArray(events)
          ? events.map(normalizeServerEvent).filter(Boolean)
          : [];
        finish(resolve, list);
      };

      const onError = (message) => {
        // Ignore unrelated hub errors while waiting; only fail if we still haven't loaded.
        if (typeof message === 'string' && /мероприят/i.test(message)) {
          finish(reject, new Error(message));
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        connection.off('ServerEventsLoaded', onLoaded);
        connection.off('Error', onError);
      };

      connection.on('ServerEventsLoaded', onLoaded);
      connection.on('Error', onError);
      connection.invoke('GetServerEvents', serverId).catch((err) => {
        finish(reject, err);
      });
    });
  },

  createEvent(connection, payload) {
    return connection.invoke(
      'CreateServerEvent',
      payload.serverId,
      payload.title,
      payload.description || null,
      payload.startsAt,
      payload.endsAt || null,
      payload.locationType,
      payload.channelId || null,
      payload.externalLocation || null
    );
  },

  updateEvent(connection, payload) {
    return connection.invoke(
      'UpdateServerEvent',
      payload.eventId,
      payload.title,
      payload.description || null,
      payload.startsAt,
      payload.endsAt || null,
      payload.locationType,
      payload.channelId || null,
      payload.externalLocation || null
    );
  },

  cancelEvent(connection, eventId) {
    return connection.invoke('CancelServerEvent', eventId);
  },

  setRsvp(connection, eventId, interest) {
    const value =
      interest === SERVER_EVENT_INTEREST.GOING || interest === SERVER_EVENT_INTEREST.INTERESTED
        ? interest
        : null;
    return connection.invoke('SetServerEventRsvp', eventId, value);
  },
};
