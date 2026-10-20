import React, { useCallback, useContext, useEffect, useState } from 'react';
import { botApi } from '../../../../entities/bot/api/botApi';
import { ServerContext } from '../../../lib/contexts/ServerContext';
import './BotDeveloperPanel.css';

const BotDeveloperPanel = () => {
  const serverCtx = useContext(ServerContext);
  const servers = serverCtx?.servers || [];
  const [apps, setApps] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [bots, setBots] = useState([]);
  const [appName, setAppName] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [lastToken, setLastToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [installServerId, setInstallServerId] = useState('');
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadApps = useCallback(async () => {
    try {
      const data = await botApi.listApplications();
      setApps(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить приложения');
    }
  }, []);

  const loadBots = useCallback(async (appId) => {
    if (!appId) {
      setBots([]);
      return;
    }
    try {
      const data = await botApi.listBots(appId);
      setBots(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить ботов');
    }
  }, []);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  useEffect(() => {
    if (selectedAppId) loadBots(selectedAppId);
  }, [selectedAppId, loadBots]);

  useEffect(() => {
    const sid = servers[0]?.serverId || servers[0]?.id;
    if (sid && !installServerId) setInstallServerId(String(sid));
  }, [servers, installServerId]);

  const onCreateApp = async () => {
    setBusy(true);
    setError('');
    try {
      const app = await botApi.createApplication(appName.trim());
      setAppName('');
      await loadApps();
      setSelectedAppId(app.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onCreateBot = async () => {
    if (!selectedAppId) return;
    setBusy(true);
    setError('');
    setLastToken('');
    try {
      const result = await botApi.createBot(selectedAppId, { username: botUsername.trim() });
      setBotUsername('');
      setLastToken(result.token || '');
      setSelectedBotId(result.bot?.id || null);
      await loadBots(selectedAppId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onRotate = async (botId) => {
    setBusy(true);
    setError('');
    try {
      const result = await botApi.rotateToken(botId);
      setLastToken(result.token || '');
      setSelectedBotId(botId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onInstall = async () => {
    if (!selectedBotId || !installServerId) return;
    setBusy(true);
    setError('');
    try {
      await botApi.installBot(selectedBotId, installServerId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onWebhook = async () => {
    if (!selectedBotId || !webhookUrl.trim()) return;
    setBusy(true);
    setError('');
    try {
      await botApi.setWebhook(selectedBotId, webhookUrl.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bot-dev">
      <p className="bot-dev__lead">
        Создайте приложение и бота (как в Telegram BotFather). Токен показывается один раз.
        Установите бота на сервер, чтобы он мог писать в каналы.
      </p>

      {error ? <p className="bot-dev__error">{error}</p> : null}
      {lastToken ? (
        <div className="bot-dev__token">
          <strong>Токен бота (сохраните сейчас):</strong>
          <code>{lastToken}</code>
        </div>
      ) : null}

      <div className="bot-dev__row">
        <input
          className="bot-dev__input"
          placeholder="Название приложения"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
        />
        <button type="button" className="bot-dev__btn" disabled={busy || !appName.trim()} onClick={onCreateApp}>
          Создать приложение
        </button>
      </div>

      <label className="bot-dev__label">
        Приложение
        <select
          className="bot-dev__input"
          value={selectedAppId || ''}
          onChange={(e) => setSelectedAppId(e.target.value || null)}
        >
          <option value="">— выберите —</option>
          {apps.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>
      </label>

      <div className="bot-dev__row">
        <input
          className="bot-dev__input"
          placeholder="username бота"
          value={botUsername}
          onChange={(e) => setBotUsername(e.target.value)}
        />
        <button
          type="button"
          className="bot-dev__btn"
          disabled={busy || !selectedAppId || !botUsername.trim()}
          onClick={onCreateBot}
        >
          Создать бота
        </button>
      </div>

      <ul className="bot-dev__list">
        {bots.map((bot) => (
          <li key={bot.id} className={selectedBotId === bot.id ? 'is-selected' : ''}>
            <button type="button" className="bot-dev__bot-pick" onClick={() => setSelectedBotId(bot.id)}>
              @{bot.username}
            </button>
            <button type="button" className="bot-dev__btn bot-dev__btn--ghost" onClick={() => onRotate(bot.id)}>
              Новый токен
            </button>
          </li>
        ))}
      </ul>

      <label className="bot-dev__label">
        Сервер для установки
        <select
          className="bot-dev__input"
          value={installServerId}
          onChange={(e) => setInstallServerId(e.target.value)}
        >
          <option value="">—</option>
          {(servers || []).map((server) => {
            const id = server.serverId || server.id;
            return (
              <option key={id} value={id}>
                {server.name || server.serverName || id}
              </option>
            );
          })}
        </select>
      </label>
      <button
        type="button"
        className="bot-dev__btn"
        disabled={busy || !selectedBotId || !installServerId}
        onClick={onInstall}
      >
        Установить бота на сервер
      </button>

      <div className="bot-dev__row">
        <input
          className="bot-dev__input"
          placeholder="https://example.com/webhook"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
        />
        <button
          type="button"
          className="bot-dev__btn"
          disabled={busy || !selectedBotId || !webhookUrl.trim()}
          onClick={onWebhook}
        >
          setWebhook
        </button>
      </div>
    </div>
  );
};

export default BotDeveloperPanel;
