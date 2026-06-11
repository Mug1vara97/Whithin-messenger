import React, { useCallback, useRef, useState } from 'react';
import { useCallStore } from '../../../lib/stores/callStore';
import './SpatialAudioStage.css';

const SpatialAudioStage = ({ currentUserId }) => {
  const mapRef = useRef(null);
  const [draggingUserId, setDraggingUserId] = useState(null);

  const spatialAudioEnabled = useCallStore((s) => s.spatialAudioEnabled);
  const showSpatialAudioStage = useCallStore((s) => s.showSpatialAudioStage);
  const participants = useCallStore((s) => s.participants);
  const spatialPositionsVersion = useCallStore((s) => s.spatialPositionsVersion);
  const participantSpatialPositions = useCallStore((s) => s.participantSpatialPositions);
  const toggleSpatialAudio = useCallStore((s) => s.toggleSpatialAudio);
  const toggleSpatialAudioStage = useCallStore((s) => s.toggleSpatialAudioStage);
  const setParticipantSpatialPosition = useCallStore((s) => s.setParticipantSpatialPosition);

  const remoteParticipants = participants.filter(
    (p) => String(p.userId || p.id) !== String(currentUserId)
  );

  const updatePositionFromPointer = useCallback(
    (userId, clientX, clientY) => {
      const rect = mapRef.current?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      setParticipantSpatialPosition(userId, nx, ny);
    },
    [setParticipantSpatialPosition]
  );

  const onPointerMove = useCallback(
    (event) => {
      if (!draggingUserId) return;
      updatePositionFromPointer(draggingUserId, event.clientX, event.clientY);
    },
    [draggingUserId, updatePositionFromPointer]
  );

  const endDrag = useCallback(() => {
    setDraggingUserId(null);
  }, []);

  if (!showSpatialAudioStage) {
    return null;
  }

  return (
    <div
      className="spatial-stage"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div className="spatial-stage__header">
        <div>
          <p className="spatial-stage__title">Пространственный звук</p>
          <p className="spatial-stage__hint">
            Перетащите участников: вверх — дальше, вниз — ближе. Слева/справа — панорама.
          </p>
        </div>
        <div className="spatial-stage__actions">
          <button
            type="button"
            className={`spatial-stage__toggle${spatialAudioEnabled ? ' spatial-stage__toggle--on' : ''}`}
            onClick={() => toggleSpatialAudio()}
          >
            {spatialAudioEnabled ? '3D вкл.' : '3D выкл.'}
          </button>
          <button
            type="button"
            className="spatial-stage__close"
            onClick={() => toggleSpatialAudioStage(false)}
            aria-label="Скрыть карту"
          >
            ×
          </button>
        </div>
      </div>

      <div className="spatial-stage__map" ref={mapRef}>
        <div className="spatial-stage__grid" aria-hidden />
        <div className="spatial-stage__depth spatial-stage__depth--far">Далеко</div>
        <div className="spatial-stage__depth spatial-stage__depth--near">Близко</div>

        {remoteParticipants.map((participant) => {
          const userId = participant.userId || participant.id;
          const pos = participantSpatialPositions.get(userId) || { nx: 0.5, ny: 0.45 };
          const label = participant.name || participant.userName || 'Участник';
          const initial = label.charAt(0).toUpperCase();

          return (
            <button
              key={`${userId}-${spatialPositionsVersion}`}
              type="button"
              className={`spatial-stage__avatar${draggingUserId === userId ? ' spatial-stage__avatar--dragging' : ''}`}
              style={{
                left: `${pos.nx * 100}%`,
                top: `${pos.ny * 100}%`,
              }}
              title={label}
              onPointerDown={(event) => {
                event.preventDefault();
                setDraggingUserId(userId);
                updatePositionFromPointer(userId, event.clientX, event.clientY);
              }}
            >
              {participant.avatar ? (
                <img src={participant.avatar} alt="" className="spatial-stage__avatar-img" />
              ) : (
                <span
                  className="spatial-stage__avatar-fallback"
                  style={{ backgroundColor: participant.avatarColor || '#5865f2' }}
                >
                  {initial}
                </span>
              )}
            </button>
          );
        })}

        <div className="spatial-stage__listener" title="Вы">
          <span>Вы</span>
        </div>
      </div>

      {!spatialAudioEnabled && (
        <p className="spatial-stage__status">Обычный стерео-звук. Нажмите «3D вкл.» для пространственного режима.</p>
      )}
      {spatialAudioEnabled && (
        <p className="spatial-stage__status spatial-stage__status--on">
          Пространственный режим активен (HRTF + затухание по дистанции).
        </p>
      )}
    </div>
  );
};

export default SpatialAudioStage;
