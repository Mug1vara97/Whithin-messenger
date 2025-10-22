import React, { useState } from 'react';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import CallButton from '../CallButton';
import { VoiceCallView } from '../../../../widgets/voice-call';
import './VoiceChannelSelector.css';

const VoiceChannelSelector = ({ 
  channelId, 
  channelName, 
  userId, 
  userName, 
  onClose 
}) => {
  const { isCallActive, getCallInfo } = useGlobalCall();
  const [useNewSystem, setUseNewSystem] = useState(true);
  const [showOldSystem, setShowOldSystem] = useState(false);
  
  // Проверяем, активен ли звонок в этом канале
  const callInfo = getCallInfo();
  const isCurrentChannelCall = isCallActive && callInfo.roomId === channelId;

  const handleToggleSystem = () => {
    setUseNewSystem(!useNewSystem);
    if (!useNewSystem) {
      setShowOldSystem(false);
    }
  };

  const handleShowOldSystem = () => {
    setShowOldSystem(true);
  };

  const handleCloseOldSystem = () => {
    setShowOldSystem(false);
  };

  // Если звонок активен в новом канале, показываем информацию
  if (isCurrentChannelCall) {
    return (
      <div className="voice-channel-active">
        <div className="active-call-info">
          <h3>✅ Звонок активен</h3>
          <p>Звонок работает в фоне. Управление доступно в нижней панели приложения.</p>
          <p className="participants-count">
            Участников: {callInfo.participants?.length || 0}
          </p>
        </div>
        <div className="system-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={useNewSystem}
              onChange={handleToggleSystem}
            />
            <span>Использовать новую систему звонков</span>
          </label>
        </div>
      </div>
    );
  }

  // Если показываем старую систему
  if (showOldSystem) {
    return (
      <div className="voice-channel-old-system">
        <div className="old-system-header">
          <button 
            className="back-button"
            onClick={handleCloseOldSystem}
          >
            ← Назад
          </button>
          <h3>Классический режим звонка</h3>
        </div>
        <VoiceCallView
          channelId={channelId}
          channelName={channelName}
          userId={userId}
          userName={userName}
          onClose={handleCloseOldSystem}
        />
      </div>
    );
  }

  // Основной интерфейс выбора
  return (
    <div className="voice-channel-selector">
      <div className="voice-channel-header">
        <h3>{channelName}</h3>
        <p>Голосовой канал</p>
      </div>

      <div className="system-options">
        <div className="system-option new-system">
          <div className="option-header">
            <h4>🚀 Новая система (Рекомендуется)</h4>
            <p>Звонки работают в фоне при переключении страниц</p>
          </div>
          <div className="option-features">
            <ul>
              <li>✅ Звонки не прерываются при навигации</li>
              <li>✅ Глобальная панель управления</li>
              <li>✅ Улучшенная производительность</li>
              <li>✅ Современный интерфейс</li>
            </ul>
          </div>
          <CallButton
            channelId={channelId}
            channelName={channelName}
            variant="primary"
            size="large"
          />
        </div>

        <div className="system-divider">
          <span>или</span>
        </div>

        <div className="system-option old-system">
          <div className="option-header">
            <h4>📞 Классический режим</h4>
            <p>Традиционный интерфейс звонка</p>
          </div>
          <div className="option-features">
            <ul>
              <li>📱 Полноэкранный интерфейс</li>
              <li>🎛️ Расширенные настройки</li>
              <li>📊 Детальная статистика</li>
              <li>🔄 Совместимость с старыми версиями</li>
            </ul>
          </div>
          <button 
            className="classic-call-button"
            onClick={handleShowOldSystem}
          >
            Открыть классический режим
          </button>
        </div>
      </div>

      <div className="system-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={useNewSystem}
            onChange={handleToggleSystem}
          />
          <span>По умолчанию использовать новую систему</span>
        </label>
      </div>
    </div>
  );
};

export default VoiceChannelSelector;
