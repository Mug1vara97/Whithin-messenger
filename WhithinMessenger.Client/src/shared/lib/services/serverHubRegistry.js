let activeConnection = null;
let activeServerId = null;

export function setServerHubConnection(connection, serverId) {
  activeConnection = connection;
  activeServerId = serverId ?? null;
}

export function clearServerHubConnection(serverId) {
  if (activeServerId == null || String(activeServerId) === String(serverId)) {
    activeConnection = null;
    activeServerId = null;
  }
}

export function getServerHubConnection() {
  return activeConnection;
}

export function getServerHubServerId() {
  return activeServerId;
}
