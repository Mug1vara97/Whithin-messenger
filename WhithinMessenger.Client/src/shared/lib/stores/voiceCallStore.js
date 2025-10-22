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
    set({ 
      isInCall: true, 
      currentRoomId: roomId,
      isCallMinimized: false 
    });
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
    set({ isCallMinimized: true });
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
