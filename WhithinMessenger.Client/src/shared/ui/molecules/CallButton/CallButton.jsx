import React, { useState } from 'react';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import { useAuth } from '../../../lib/hooks/useAuth';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneDisabledIcon from '@mui/icons-material/PhoneDisabled';
import './CallButton.css';

const CallButton = ({ 
  channelId, 
  channelName, 
  className = '', 
  size = 'medium',
  variant = 'primary' 
}) => {
  const { isCallActive, startCall, endCall, getCallInfo } = useGlobalCall();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Проверяем, активен ли звонок в этом канале
  const callInfo = getCallInfo();
  const isCurrentChannelCall = isCallActive && callInfo.roomId === channelId;

  const handleCallAction = async () => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    setIsLoading(true);
    
    try {
      if (isCurrentChannelCall) {
        // Завершаем текущий звонок
        await endCall();
      } else {
        // Начинаем новый звонок
        const success = await startCall(channelId, channelName);
        if (!success) {
          console.error('Failed to start call');
        }
      }
    } catch (error) {
      console.error('Call action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (isLoading) {
      return 'Подключение...';
    }
    
    if (isCurrentChannelCall) {
      return 'Завершить звонок';
    }
    
    return 'Начать звонок';
  };

  const getButtonIcon = () => {
    if (isCurrentChannelCall) {
      return <PhoneDisabledIcon />;
    }
    return <PhoneIcon />;
  };

  return (
    <button
      className={`call-button ${className} ${size} ${variant} ${isCurrentChannelCall ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
      onClick={handleCallAction}
      disabled={isLoading}
      title={getButtonText()}
    >
      <span className="call-button-icon">
        {getButtonIcon()}
      </span>
      <span className="call-button-text">
        {getButtonText()}
      </span>
    </button>
  );
};

export default CallButton;
