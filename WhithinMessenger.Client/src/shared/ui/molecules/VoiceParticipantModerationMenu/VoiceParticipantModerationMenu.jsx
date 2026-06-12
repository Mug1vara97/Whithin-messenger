import React, { useEffect, useRef, useState } from 'react';
import { moderateVoiceParticipant } from '../../../lib/voice/moderateVoiceParticipant';
import { getServerHubConnection } from '../../../lib/services/serverHubRegistry';
import './VoiceParticipantModerationMenu.css';

export function useVoiceParticipantModeration({
  channelId,
  currentUserId,
  canMuteMembers = false,
  serverId,
}) {
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, participant: null });
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu.visible) return undefined;

    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenu({ visible: false, x: 0, y: 0, participant: null });
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenu({ visible: false, x: 0, y: 0, participant: null });
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menu.visible]);

  const closeMenu = () => setMenu({ visible: false, x: 0, y: 0, participant: null });

  const handleParticipantContextMenu = (event, participant, channelParticipant) => {
    if (!canMuteMembers || !channelId || !serverId) return;

    const targetUserId = participant?.id || participant?.odUserId || participant?.userId;
    if (!targetUserId || String(targetUserId) === String(currentUserId || '')) return;

    const connection = getServerHubConnection();
    if (!connection || connection.state !== 'Connected') return;

    event.preventDefault();
    event.stopPropagation();
    setMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      participant: channelParticipant || participant,
    });
  };

  const runModeration = async (options) => {
    const participant = menu.participant;
    if (!participant) return;

    const connection = getServerHubConnection();
    const targetUserId = participant.odUserId || participant.userId || participant.id;

    try {
      await moderateVoiceParticipant({
        connection,
        serverId,
        channelId,
        targetUserId,
        muteMic: options.muteMic,
        deafen: options.deafen,
      });
    } catch (error) {
      console.error('Voice moderation failed:', error);
      alert(error?.message || 'Не удалось применить модерацию');
    } finally {
      closeMenu();
    }
  };

  const menuNode = menu.visible && menu.participant ? (
    <div
      ref={menuRef}
      className="voice-participant-context-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.participant.isServerMuted ? (
        <button type="button" onClick={() => runModeration({ muteMic: false })}>
          Разрешить включить микрофон
        </button>
      ) : (
        <button type="button" onClick={() => runModeration({ muteMic: true })}>
          Выключить микрофон
        </button>
      )}
      {menu.participant.isServerDeafened ? (
        <button type="button" onClick={() => runModeration({ deafen: false })}>
          Разрешить включить звук
        </button>
      ) : (
        <button type="button" onClick={() => runModeration({ deafen: true })}>
          Выключить звук
        </button>
      )}
    </div>
  ) : null;

  return { handleParticipantContextMenu, moderationMenu: menuNode };
}
