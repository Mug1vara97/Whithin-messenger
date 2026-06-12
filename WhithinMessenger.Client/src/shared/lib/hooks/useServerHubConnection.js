import { useEffect, useState } from 'react';
import {
  getServerHubConnection,
  getServerHubServerId,
} from '../services/serverHubRegistry';

/** Reactive ServerHub connection for the active server (set by ServerPanel). */
export const useServerHubConnection = (serverId) => {
  const [connection, setConnection] = useState(null);

  useEffect(() => {
    if (!serverId) {
      setConnection(null);
      return undefined;
    }

    const sync = () => {
      const hub = getServerHubConnection();
      const hubServerId = getServerHubServerId();
      if (hub && hubServerId != null && String(hubServerId) === String(serverId)) {
        setConnection((prev) => (prev === hub ? prev : hub));
      } else {
        setConnection((prev) => (prev === null ? prev : null));
      }
    };

    sync();
    const timer = window.setInterval(sync, 400);
    return () => window.clearInterval(timer);
  }, [serverId]);

  return connection;
};
