import { create } from 'zustand';

const useVoiceCallStore = create((set) => ({
  // Состояние звонка
  isInCall: false,
  isCallMinimized: false,
  currentRoomId: null,
  participants: [],
  
  // Состояние микрофона/наушников
  isMuted: false,
  isGlobalAudioMuted: false,
  
  // Состояние видео
  isVideoEnabled: false,
  
  // Действия
  joinCall: (roomId) => {
    console.log('voiceCallStore: joinCall called with roomId:', roomId);
    set({ 
      isInCall: true, 
      currentRoomId: roomId,
      isCallMinimized: false 
    });
    console.log('voiceCallStore: isInCall set to true');
  },
  
  leaveCall: () => {
    set({ 
      isInCall: false, 
      currentRoomId: null,
      isCallMinimized: false,
      participants: []
    });
  },
  
  minimizeCall: () => {
    console.log('voiceCallStore: minimizeCall called');
    set({ isCallMinimized: true });
    console.log('voiceCallStore: isCallMinimized set to true');
  },
  
  restoreCall: () => {
    set({ isCallMinimized: false });
  },
  
  updateParticipants: (participants) => {
    set({ participants });
  },
  
  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },
  
  toggleGlobalAudio: () => {
    set((state) => ({ isGlobalAudioMuted: !state.isGlobalAudioMuted }));
  },
  
  toggleVideo: () => {
    set((state) => ({ isVideoEnabled: !state.isVideoEnabled }));
  },
}));

export default useVoiceCallStore;
