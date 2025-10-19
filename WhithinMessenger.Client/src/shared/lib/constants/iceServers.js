// ICE серверы для WebRTC соединений
export const ICE_SERVERS = [
  {
    urls: ['stun:185.119.59.23:3478']
  },
  {
    urls: ['turn:185.119.59.23:3478?transport=udp'],
    username: 'test',
    credential: 'test123'
  },
  {
    urls: ['turn:185.119.59.23:3478?transport=tcp'],
    username: 'test',
    credential: 'test123'
  }
];

// Альтернативные STUN серверы (закомментированы)
export const ALTERNATIVE_STUN_SERVERS = [
  // {
  //   urls: ['stun:stun.l.google.com:19302']
  // },
  // {
  //   urls: ['stun:stun1.l.google.com:19302']
  // },
  // {
  //   urls: ['stun:stun2.l.google.com:19302']
  // }
];
