import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const formatQualityLabel = (level) => {
  if (level?.height) return `${level.height}p`;
  if (level?.bitrate) return `${Math.round(level.bitrate / 1000)}k`;
  return 'Авто';
};

const attachReadyListener = (video, notifyReady) => {
  if (!video) return () => {};

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    notifyReady();
    return () => {};
  }

  let notified = false;
  const handleReady = () => {
    if (notified) return;
    notified = true;
    notifyReady();
  };

  video.addEventListener('loadeddata', handleReady, { once: true });
  video.addEventListener('canplay', handleReady, { once: true });
  video.addEventListener('loadedmetadata', handleReady, { once: true });

  return () => {
    video.removeEventListener('loadeddata', handleReady);
    video.removeEventListener('canplay', handleReady);
    video.removeEventListener('loadedmetadata', handleReady);
  };
};

const manifestIsReachable = async (manifestUrl) => {
  if (!manifestUrl) return false;

  try {
    const response = await fetch(manifestUrl, { method: 'HEAD', credentials: 'include' });
    return response.ok;
  } catch {
    return false;
  }
};

export function useVideoHls(videoRef, { hlsSrc, fallbackSrc, onError, onReady }) {
  const hlsRef = useRef(null);
  const fallbackSrcRef = useRef(fallbackSrc);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const [qualities, setQualities] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [usesHls, setUsesHls] = useState(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    fallbackSrcRef.current = fallbackSrc;
  }, [fallbackSrc]);

  const refreshAfterDomMove = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const savedTime = video.currentTime;
    const wasPlaying = !video.paused;
    const hls = hlsRef.current;

    const resumePlayback = () => {
      if (savedTime > 0) {
        try {
          video.currentTime = savedTime;
        } catch {
          /* ignore */
        }
      }
      if (wasPlaying) {
        void video.play().catch(() => {});
      }
    };

    if (hls) {
      hls.detachMedia();
      hls.attachMedia(video);
      hls.startLoad(-1);
      resumePlayback();
      return;
    }

    const progressiveSrc = video.currentSrc || video.src || fallbackSrcRef.current;
    if (!progressiveSrc) return;

    if (!video.src) {
      video.src = progressiveSrc;
    }
    video.load();

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      resumePlayback();
      return;
    }

    video.addEventListener('loadeddata', resumePlayback, { once: true });
  }, [videoRef]);

  const applyQuality = useCallback((levelIndex) => {
    const hls = hlsRef.current;
    if (!hls) return;

    hls.currentLevel = levelIndex;
    setSelectedQuality(levelIndex);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    let detachReadyListener = () => {};
    let networkErrors = 0;

    const cleanupHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setUsesHls(false);
      setQualities([]);
      setSelectedQuality(-1);
    };

    const notifyReady = () => {
      if (!cancelled) {
        onReadyRef.current?.();
      }
    };

    const playProgressive = () => {
      cleanupHls();
      if (!fallbackSrc) {
        onErrorRef.current?.(new Error('Video source is missing'));
        return;
      }

      video.src = fallbackSrc;
      video.load();
      detachReadyListener = attachReadyListener(video, notifyReady);
    };

    const startHls = (manifestUrl) => {
      cleanupHls();
      video.removeAttribute('src');
      video.load();

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          startLevel: -1,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          capLevelToPlayerSize: true,
        });

        hlsRef.current = hls;
        setUsesHls(true);
        networkErrors = 0;

        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          const nextQualities = data.levels.map((level, index) => ({
            index,
            height: level.height || 0,
            bitrate: level.bitrate || 0,
            label: formatQualityLabel(level),
          }));
          setQualities(nextQualities.sort((a, b) => (b.height || 0) - (a.height || 0)));
          setSelectedQuality(hls.currentLevel);
          notifyReady();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          setSelectedQuality(data.level);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            networkErrors += 1;
            if (networkErrors < 2) {
              hls.startLoad();
              return;
            }
            playProgressive();
            return;
          }

          if (!data.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }

          if (data.fatal) {
            playProgressive();
          }
        });

        hls.loadSource(manifestUrl);
        hls.attachMedia(video);
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = manifestUrl;
        setUsesHls(true);
        setQualities([{ index: 0, height: 0, bitrate: 0, label: 'Авто' }]);
        setSelectedQuality(-1);
        detachReadyListener = attachReadyListener(video, notifyReady);

        video.addEventListener(
          'error',
          () => {
            playProgressive();
          },
          { once: true }
        );
        return;
      }

      playProgressive();
    };

    const bootstrap = async () => {
      cleanupHls();
      video.removeAttribute('src');
      video.load();

      const manifestUrl = hlsSrc || null;

      if (fallbackSrc) {
        playProgressive();
        return;
      }

      if (manifestUrl && (await manifestIsReachable(manifestUrl))) {
        if (cancelled) return;
        startHls(manifestUrl);
        return;
      }

      if (cancelled) return;
      onErrorRef.current?.(new Error('Video source is missing'));
    };

    void bootstrap();

    return () => {
      cancelled = true;
      detachReadyListener();
      cleanupHls();
      video.removeAttribute('src');
      video.load();
    };
  }, [fallbackSrc, hlsSrc, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const handleWaiting = () => {
      if (!video.paused) {
        setIsBuffering(true);
      }
    };
    const handleCanPlay = () => setIsBuffering(false);
    const handlePlaying = () => setIsBuffering(false);

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [videoRef, hlsSrc, fallbackSrc]);

  const qualityLabel =
    selectedQuality === -1 || !qualities.length
      ? 'Авто'
      : qualities.find((item) => item.index === selectedQuality)?.label || 'Авто';

  return {
    applyQuality,
    isBuffering,
    qualities,
    qualityLabel,
    refreshAfterDomMove,
    selectedQuality,
    usesHls,
  };
}
