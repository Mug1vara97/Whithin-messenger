import React, { useCallback, useEffect, useState } from 'react';
import Slider from '@mui/material/Slider';
import { participantVolumeStorage } from '../../../lib/utils/participantVolumeStorage';
import { useCallStore } from '../../../lib/stores/callStore';
import './ParticipantVolumeSettings.css';

const ParticipantVolumeSettings = () => {
  const [entries, setEntries] = useState(() => participantVolumeStorage.getAllEntries());

  const refresh = useCallback(() => {
    setEntries(participantVolumeStorage.getAllEntries());
  }, []);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('participantVolumesChanged', onChange);
    return () => window.removeEventListener('participantVolumesChanged', onChange);
  }, [refresh]);

  const handleVolumeChange = (userId, value) => {
    const entry = entries.find((item) => item.userId === userId);
    useCallStore.getState().setParticipantVolume(userId, value, entry?.userName);
    refresh();
  };

  const handleRemove = (userId) => {
    participantVolumeStorage.remove(userId);
    useCallStore.getState().setParticipantVolume(userId, 100, null, { persist: false });
    refresh();
  };

  const handleResetAll = () => {
    const ids = entries.map((entry) => entry.userId);
    participantVolumeStorage.clearAll();
    ids.forEach((userId) => {
      useCallStore.getState().setParticipantVolume(userId, 100, null, { persist: false });
    });
    refresh();
  };

  if (!entries.length) {
    return (
      <div className="participant-volume-settings">
        <p className="setting-description">
          Здесь появятся участники, для которых вы меняли громкость в звонке. Пока записей нет.
        </p>
      </div>
    );
  }

  return (
    <div className="participant-volume-settings">
      <p className="setting-description">
        Сохранённые уровни громкости применяются при следующем звонке с этим участником.
        Во время звонка громкость можно менять на карточке участника.
      </p>
      <ul className="participant-volume-list">
        {entries.map((entry) => (
          <li key={entry.userId} className="participant-volume-row">
            <div className="participant-volume-row__info">
              <span className="participant-volume-row__name">
                {entry.userName || `Участник ${entry.userId}`}
              </span>
              <span className="participant-volume-row__percent">{entry.volume}%</span>
            </div>
            <Slider
              className="participant-volume-row__slider"
              value={entry.volume}
              min={0}
              max={100}
              step={1}
              size="small"
              onChange={(_, value) => handleVolumeChange(entry.userId, value)}
              aria-label={`Громкость ${entry.userName || entry.userId}`}
            />
            <button
              type="button"
              className="participant-volume-row__remove"
              onClick={() => handleRemove(entry.userId)}
              title="Удалить запись и сбросить на 100%"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="hotkey-reset-btn" onClick={handleResetAll}>
        Сбросить все
      </button>
    </div>
  );
};

export default ParticipantVolumeSettings;
