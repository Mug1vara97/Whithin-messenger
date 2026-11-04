import { useState, useCallback, useEffect } from 'react';
import { createParticipant } from '../../../entities/video-call/model/types';
import { AVATAR_FRAME_NAMES } from '../avatarDecorations/avatarFrameNames';
import { getLocalAvatarFramePath } from '../avatarDecorations/avatarFramePaths';
import { TEST_AVATAR_DECORATION_PATH } from '../utils/avatarDecorationHelpers';

const TEST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Helen', 'Ivan', 'Julia'];
const AVATAR_COLORS = ['#5865f2', '#3ba55d', '#faa81a', '#ed4245', '#eb459e'];
const TEST_AVATAR_FRAMES = [
  TEST_AVATAR_DECORATION_PATH,
  ...Object.keys(AVATAR_FRAME_NAMES).map((frameId) => getLocalAvatarFramePath(frameId)),
];

export const useCallGridTestMode = () => {
  const [testMode, setTestMode] = useState(false);
  const [testParticipants, setTestParticipants] = useState([]);

  const handleAddTestParticipant = useCallback(() => {
    setTestMode(true);
    setTestParticipants((prev) => {
      const id = `test-${Date.now()}-${prev.length}`;
      const name = `${TEST_NAMES[prev.length % TEST_NAMES.length]} ${prev.length + 1}`;
      const newParticipant = createParticipant(id, name, null, 'online', 'participant');
      newParticipant.isMuted = Math.random() > 0.5;
      newParticipant.isAudioEnabled = true;
      newParticipant.isSpeaking = false;
      newParticipant.isVideoEnabled = false;
      newParticipant.avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      newParticipant.avatarDecoration =
        TEST_AVATAR_FRAMES[prev.length % TEST_AVATAR_FRAMES.length];
      return [...prev, newParticipant];
    });
  }, []);

  const handleRemoveTestParticipant = useCallback(() => {
    setTestParticipants((prev) => prev.slice(0, -1));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        setTestMode((prev) => {
          const next = !prev;
          console.log('Test mode toggled:', next);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const appendTestParticipants = useCallback(
    (participantsList) => {
      if (!testMode || testParticipants.length === 0) {
        return participantsList;
      }
      return [...participantsList, ...testParticipants];
    },
    [testMode, testParticipants]
  );

  return {
    testMode,
    testParticipants,
    handleAddTestParticipant,
    handleRemoveTestParticipant,
    appendTestParticipants,
  };
};
