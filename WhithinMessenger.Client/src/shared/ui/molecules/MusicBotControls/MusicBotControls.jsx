import React, { useState } from 'react';
import { useMusicBot } from '../../../../entities/music-bot';
import {
  MusicNote,
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  Queue,
  VolumeUp,
  Delete,
  Add,
  Remove
} from '@mui/icons-material';
import { IconButton, TextField, Slider, CircularProgress } from '@mui/material';
import './MusicBotControls.css';

const MusicBotControls = ({ roomId, className = '' }) => {
  const {
    isBotInRoom,
    isLoading,
    error,
    botMessage,
    addBot,
    removeBot,
    sendCommand
  } = useMusicBot(roomId);

  const [showPanel, setShowPanel] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [volume, setVolume] = useState(100);

  const handleAddBot = async () => {
    try {
      await addBot();
      setShowPanel(true);
    } catch (err) {
      console.error('Failed to add bot:', err);
    }
  };

  const handleRemoveBot = async () => {
    await removeBot();
    setShowPanel(false);
  };

  const handlePlay = () => {
    if (!urlInput.trim()) {
      return;
    }
    const url = urlInput.trim();
    sendCommand('play', [url]);
    setUrlInput('');
  };

  const handlePause = () => {
    sendCommand('pause');
  };

  const handleResume = () => {
    sendCommand('resume');
  };

  const handleStop = () => {
    sendCommand('stop');
  };

  const handleSkip = () => {
    sendCommand('skip');
  };

  const handleQueue = () => {
    sendCommand('queue');
  };

  const handleClear = () => {
    sendCommand('clear');
  };

  const handleVolumeChange = (event, newValue) => {
    const newVolume = typeof newValue === 'number' ? newValue : newValue[0];
    setVolume(newVolume);
    sendCommand('volume', [newVolume.toString()]);
  };

  if (!isBotInRoom && !showPanel) {
    return (
      <div className={`music-bot-controls ${className}`} style={{ pointerEvents: 'auto', zIndex: 1000 }}>
        <button
          className="music-bot-add-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[MusicBotControls] Add bot button clicked');
            handleAddBot();
          }}
          disabled={isLoading}
          title="Добавить музыкального бота"
          type="button"
          style={{ pointerEvents: 'auto', zIndex: 1001 }}
        >
          {isLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <MusicNote sx={{ fontSize: 24 }} />
          )}
        </button>
        {error && <div className="music-bot-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className={`music-bot-controls ${className} ${showPanel ? 'expanded' : ''}`}>
      <div className="music-bot-header">
        <div className="music-bot-title">
          <MusicNote sx={{ fontSize: 20 }} />
          <span>Музыкальный бот</span>
        </div>
        <div className="music-bot-header-actions">
          {isBotInRoom && (
            <IconButton
              size="small"
              onClick={() => setShowPanel(!showPanel)}
              title={showPanel ? 'Скрыть панель' : 'Показать панель'}
            >
              {showPanel ? <Remove /> : <Add />}
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={handleRemoveBot}
            disabled={isLoading}
            title="Удалить бота"
          >
            <Remove />
          </IconButton>
        </div>
      </div>

      {showPanel && isBotInRoom && (
        <div className="music-bot-panel">
          {botMessage && (
            <div className="music-bot-message">{botMessage}</div>
          )}

          {error && (
            <div className="music-bot-error">{error}</div>
          )}

          <div className="music-bot-input-section">
            <TextField
              fullWidth
              size="small"
              placeholder="URL трека (YouTube, Spotify и т.д.)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePlay();
                }
              }}
              className="music-bot-url-input"
            />
            <IconButton
              onClick={handlePlay}
              disabled={!urlInput.trim()}
              title="Добавить в очередь"
            >
              <PlayArrow />
            </IconButton>
          </div>

          <div className="music-bot-controls-section">
            <IconButton
              onClick={handlePause}
              title="Пауза"
            >
              <Pause />
            </IconButton>
            <IconButton
              onClick={handleResume}
              title="Возобновить"
            >
              <PlayArrow />
            </IconButton>
            <IconButton
              onClick={handleStop}
              title="Остановить"
            >
              <Stop />
            </IconButton>
            <IconButton
              onClick={handleSkip}
              title="Следующий трек"
            >
              <SkipNext />
            </IconButton>
            <IconButton
              onClick={handleQueue}
              title="Показать очередь"
            >
              <Queue />
            </IconButton>
            <IconButton
              onClick={handleClear}
              title="Очистить очередь"
            >
              <Delete />
            </IconButton>
          </div>

          <div className="music-bot-volume-section">
            <VolumeUp sx={{ fontSize: 20 }} />
            <Slider
              value={volume}
              onChange={handleVolumeChange}
              min={0}
              max={100}
              step={1}
              className="music-bot-volume-slider"
            />
            <span className="music-bot-volume-value">{volume}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicBotControls;
