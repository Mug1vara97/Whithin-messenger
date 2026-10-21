import {
  normalizeServerEvent,
  SERVER_EVENT_INTEREST,
} from '../model/types';

export const serverEventApi = {
  async loadEvents(connection, serverId) {
    if (!connection || connection.state !== 'Connected' || !serverId) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout loading server events'));
      }, 15000);

      const onLoaded = (events) => {
        cleanup();
        const list = Array.isArray(events) ? events.map(normalizeServerEvent).filter(Boolean) : [];
        resolve(list);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        connection.off('ServerEventsLoaded', onLoaded);
      };

      connection.on('ServerEventsLoaded', onLoaded);
      connection.invoke('GetServerEvents', serverId).catch((err) => {
        cleanup();
        reject(err);
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
