import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import HeadsetOutlinedIcon from '@mui/icons-material/HeadsetOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { volumeStorage } from '../../../lib/utils/volumeStorage';
import {
  outputGainToPercent,
  OUTPUT_VOLUME_PERCENT_MAX,
  percentToOutputGain,
} from '../../../lib/utils/callAudioMasterBus';
import { NoiseSuppressionManager } from '../../../lib/utils/noiseSuppression';
import { useCallStore } from '../../../lib/stores/callStore';
import { VoiceActivityDetector, VOICE_ACTIVATION_VAD_OPTIONS } from '../../../lib/utils/voiceActivityDetector';
import {
  createSpeechBandAnalyserChain,
  measureSpeechBandLevel,
} from '../../../lib/utils/voiceLevelAnalysis';
import {
  applyAudioContextSinkId,
  applyOutputAudioDevice,
  getAudioInputMediaConstraints,
  getEffectiveMicThreshold,
  getInputGainMultiplier,
  micThresholdToNoiseGateOpenDb,
  micThresholdToSensitivity,
  sensitivityToMicThreshold,
} from '../../../lib/utils/voiceCallAudioSettings';
import './AudioSettingsSection.css';

const LEVEL_BAR_COUNT = 42;
const MIC_LEVEL_MAX = 200;

function formatPercent(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

function getDeviceLabel(device, fallback) {
  const label = device?.label?.trim();
  return label || fallback;
}

function readNoiseSuppressionEnabled() {
  try {
    const saved = localStorage.getItem('noiseSuppression');
    return saved ? JSON.parse(saved) : false;
  } catch {
    return false;
  }
}

export function AudioSettingsSection({ active = true }) {
  const noiseSuppressionMode = useCallStore((state) => state.noiseSuppressionMode);

  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const [inputDeviceId, setInputDeviceId] = useState(() => volumeStorage.getInputDeviceId());
  const [outputDeviceId, setOutputDeviceId] = useState(() => volumeStorage.getOutputDeviceId());
  const [inputVolume, setInputVolume] = useState(() => volumeStorage.getInputVolume());
  const [outputVolume, setOutputVolume] = useState(() => volumeStorage.getOutputVolume());
  const [micSensitivity, setMicSensitivity] = useState(() =>
    micThresholdToSensitivity(volumeStorage.getMicThreshold()),
  );
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(readNoiseSuppressionEnabled);
  const [echoCancellation, setEchoCancellation] = useState(() => volumeStorage.getEchoCancellation());
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const testStreamRef = useRef(null);
  const testAudioContextRef = useRef(null);
  const testAnalyserRef = useRef(null);
  const testOutputGainRef = useRef(null);
  const testMonitorGateRef = useRef(null);
  const testMonitorAudioRef = useRef(null);
  const testMonitorUsesContextSinkRef = useRef(false);
  const testNoiseManagerRef = useRef(null);
  const testVadRef = useRef(null);
  const testRafRef = useRef(null);
  const isMicTestingRef = useRef(false);
  const startMicTestRef = useRef(null);

  const applyTestVoiceProcessing = useCallback(() => {
    const baseThreshold = sensitivityToMicThreshold(micSensitivity);
    const effectiveThreshold = getEffectiveMicThreshold(baseThreshold, inputVolume);

    testVadRef.current?.setThreshold?.(effectiveThreshold);
    testNoiseManagerRef.current?.setMicrophoneGain?.(getInputGainMultiplier(inputVolume));
    testNoiseManagerRef.current?.setNoiseGateThreshold?.(
      micThresholdToNoiseGateOpenDb(baseThreshold),
    );
  }, [inputVolume, micSensitivity]);

  const applyTestMonitorLevels = useCallback(() => {
    if (testOutputGainRef.current) {
      testOutputGainRef.current.gain.value = outputVolume;
    }
  }, [outputVolume]);

  const applyTestOutputDevice = useCallback(async () => {
    const audioContext = testAudioContextRef.current;
    if (testMonitorUsesContextSinkRef.current && audioContext) {
      await applyAudioContextSinkId(audioContext, outputDeviceId);
      return;
    }

    const monitorAudio = testMonitorAudioRef.current;
    if (!monitorAudio) return;
    await applyOutputAudioDevice(outputDeviceId, [monitorAudio]);
  }, [outputDeviceId]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Labels stay hidden until permission is granted.
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(devices.filter((device) => device.kind === 'audioinput'));
      setOutputDevices(devices.filter((device) => device.kind === 'audiooutput'));
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    void refreshDevices();

    const onDeviceChange = () => {
      void refreshDevices();
    };

    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
    };
  }, [active, refreshDevices]);

  useEffect(() => {
    const onNoiseSuppressionChanged = (event) => {
      const enabled = Boolean(event.detail?.enabled);
      setNoiseSuppressionEnabled(enabled);
      if (isMicTestingRef.current) {
        void startMicTestRef.current?.();
      }
    };

    window.addEventListener('noiseSuppressionChanged', onNoiseSuppressionChanged);
    return () => {
      window.removeEventListener('noiseSuppressionChanged', onNoiseSuppressionChanged);
    };
  }, []);

  const stopMicTest = useCallback(() => {
    if (testRafRef.current) {
      cancelAnimationFrame(testRafRef.current);
      testRafRef.current = null;
    }

    testVadRef.current?.cleanup?.();
    testVadRef.current = null;

    testNoiseManagerRef.current?.cleanup?.();
    testNoiseManagerRef.current = null;

    testStreamRef.current?.getTracks().forEach((track) => track.stop());
    testStreamRef.current = null;

    const monitorAudio = testMonitorAudioRef.current;
    if (monitorAudio) {
      monitorAudio.pause();
      monitorAudio.srcObject = null;
      monitorAudio.remove();
    }
    testMonitorAudioRef.current = null;
    testMonitorUsesContextSinkRef.current = false;
    testOutputGainRef.current = null;
    testMonitorGateRef.current = null;

    if (testAudioContextRef.current && testAudioContextRef.current.state !== 'closed') {
      void testAudioContextRef.current.close().catch(() => {});
    }
    testAudioContextRef.current = null;
    testAnalyserRef.current = null;
    setMicLevel(0);
    setIsMicTesting(false);
    isMicTestingRef.current = false;
  }, []);

  const startMicTest = useCallback(async () => {
    stopMicTest();
    setIsMicTesting(true);
    isMicTestingRef.current = true;

    try {
      const audio = {
        ...getAudioInputMediaConstraints().audio,
        echoCancellation: echoCancellation !== false,
        suppressLocalAudioPlayback: true,
      };
      if (inputDeviceId && inputDeviceId !== 'default') {
        audio.deviceId = { exact: inputDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      testStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });
      testAudioContextRef.current = audioContext;

      const noiseManager = new NoiseSuppressionManager();
      const initialized = await noiseManager.initialize(stream, audioContext);
      if (!initialized) {
        throw new Error('Failed to initialize noise suppression pipeline');
      }
      testNoiseManagerRef.current = noiseManager;

      if (noiseSuppressionEnabled) {
        const enabled = await noiseManager.enable(noiseSuppressionMode || 'rnnoise');
        if (!enabled) {
          console.warn('Mic test: noise suppression enable failed, using passthrough');
        }
      }

      applyTestVoiceProcessing();

      const processedStream = noiseManager.getProcessedStream();
      if (!processedStream) {
        throw new Error('No processed stream for mic test');
      }

      const monitorSource = audioContext.createMediaStreamSource(processedStream);
      const outputGainNode = audioContext.createGain();
      const monitorGateNode = audioContext.createGain();

      outputGainNode.gain.value = outputVolume;
      monitorGateNode.gain.value = 0;

      monitorSource.connect(outputGainNode);
      outputGainNode.connect(monitorGateNode);

      const usesContextSink = await applyAudioContextSinkId(audioContext, outputDeviceId);
      testMonitorUsesContextSinkRef.current = usesContextSink;

      if (usesContextSink) {
        monitorGateNode.connect(audioContext.destination);
      } else {
        const monitorDestination = audioContext.createMediaStreamDestination();
        monitorGateNode.connect(monitorDestination);

        const monitorAudio = document.createElement('audio');
        monitorAudio.autoplay = true;
        monitorAudio.playsInline = true;
        monitorAudio.style.display = 'none';
        monitorAudio.srcObject = monitorDestination.stream;
        document.body.appendChild(monitorAudio);
        testMonitorAudioRef.current = monitorAudio;

        await applyOutputAudioDevice(outputDeviceId, [monitorAudio]);
        await monitorAudio.play().catch(() => {});
      }

      testOutputGainRef.current = outputGainNode;
      testMonitorGateRef.current = monitorGateNode;

      const meterSource = audioContext.createMediaStreamSource(stream);
      const meterChain = createSpeechBandAnalyserChain(audioContext, meterSource);
      testAnalyserRef.current = meterChain.analyser;

      const baseThreshold = sensitivityToMicThreshold(micSensitivity);
      const effectiveThreshold = getEffectiveMicThreshold(baseThreshold, inputVolume);
      const vad = new VoiceActivityDetector({
        audioContext,
        threshold: effectiveThreshold,
        ...VOICE_ACTIVATION_VAD_OPTIONS,
        onSpeakingChange: (isSpeaking) => {
          const gate = testMonitorGateRef.current;
          const ctx = testAudioContextRef.current;
          if (!gate || !ctx || ctx.state === 'closed') return;
          const t = ctx.currentTime;
          gate.gain.cancelScheduledValues(t);
          gate.gain.setTargetAtTime(isSpeaking ? 1 : 0, t, 0.008);
        },
      });
      await vad.start(stream, audioContext);
      testVadRef.current = vad;

      const data = new Uint8Array(meterChain.analyser.frequencyBinCount);

      const tick = () => {
        const analyser = testAnalyserRef.current;
        const ctx = testAudioContextRef.current;
        if (!analyser || !ctx) return;
        analyser.getByteFrequencyData(data);
        const average = measureSpeechBandLevel(data, analyser.fftSize, ctx.sampleRate);
        setMicLevel(average);
        testRafRef.current = requestAnimationFrame(tick);
      };

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      tick();
    } catch (error) {
      console.warn('Mic test failed:', error);
      stopMicTest();
    }
  }, [
    applyTestVoiceProcessing,
    echoCancellation,
    inputDeviceId,
    noiseSuppressionEnabled,
    noiseSuppressionMode,
    outputDeviceId,
    outputVolume,
    stopMicTest,
  ]);

  startMicTestRef.current = startMicTest;

  const prevNoiseSuppressionModeRef = useRef(noiseSuppressionMode);

  useEffect(() => {
    if (!isMicTesting) {
      prevNoiseSuppressionModeRef.current = noiseSuppressionMode;
      return;
    }
    if (prevNoiseSuppressionModeRef.current === noiseSuppressionMode) return;
    prevNoiseSuppressionModeRef.current = noiseSuppressionMode;
    void startMicTest();
  }, [isMicTesting, noiseSuppressionMode, startMicTest]);

  useEffect(() => {
    if (!isMicTesting) return;
    applyTestVoiceProcessing();
  }, [isMicTesting, applyTestVoiceProcessing]);

  useEffect(() => {
    if (!isMicTesting) return;
    applyTestMonitorLevels();
  }, [isMicTesting, applyTestMonitorLevels]);

  useEffect(() => {
    if (!isMicTesting) return;
    void applyTestOutputDevice();
  }, [isMicTesting, applyTestOutputDevice]);

  useEffect(() => {
    if (!active) {
      stopMicTest();
    }
  }, [active, stopMicTest]);

  useEffect(() => () => stopMicTest(), [stopMicTest]);

  const activeBars = useMemo(
    () => Math.round((micLevel / 255) * LEVEL_BAR_COUNT),
    [micLevel],
  );

  const thresholdBars = useMemo(() => {
    const baseThreshold = sensitivityToMicThreshold(micSensitivity);
    const effectiveThreshold = getEffectiveMicThreshold(baseThreshold, inputVolume);
    return Math.round((effectiveThreshold / MIC_LEVEL_MAX) * LEVEL_BAR_COUNT);
  }, [micSensitivity, inputVolume]);

  const outputVolumePercent = outputGainToPercent(outputVolume);

  return (
    <div className="audio-settings">
      <div className="audio-settings__grid">
        <div className="audio-settings__column">
          <label className="audio-settings__label" htmlFor="audio-input-device">
            Микрофон
          </label>
          <div className="audio-settings__select-wrap">
            <MicNoneOutlinedIcon className="audio-settings__select-icon" fontSize="small" />
            <select
              id="audio-input-device"
              className="audio-settings__select"
              value={inputDeviceId}
              onChange={(event) => {
                const next = event.target.value;
                setInputDeviceId(next);
                volumeStorage.setInputDeviceId(next);
                if (isMicTesting) {
                  void startMicTest();
                }
              }}
            >
              <option value="default">Системный микрофон</option>
              {inputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {getDeviceLabel(device, 'Микрофон')}
                </option>
              ))}
            </select>
            <KeyboardArrowDownIcon className="audio-settings__select-chevron" fontSize="small" />
          </div>

          <div className="audio-settings__slider-block">
            <div className="audio-settings__slider-head">
              <span>Громкость микрофона</span>
            </div>
            <div className="settings-volume-control">
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(inputVolume * 100)}
                className="settings-volume-control__range"
                onChange={(event) => {
                  const next = Number(event.target.value) / 100;
                  setInputVolume(next);
                  volumeStorage.setInputVolume(next);
                }}
              />
              <span className="settings-volume-control__value">{formatPercent(inputVolume)}</span>
            </div>
          </div>
        </div>

        <div className="audio-settings__column">
          <label className="audio-settings__label" htmlFor="audio-output-device">
            Динамик
          </label>
          <div className="audio-settings__select-wrap">
            <HeadsetOutlinedIcon className="audio-settings__select-icon" fontSize="small" />
            <select
              id="audio-output-device"
              className="audio-settings__select"
              value={outputDeviceId}
              onChange={(event) => {
                const next = event.target.value;
                setOutputDeviceId(next);
                volumeStorage.setOutputDeviceId(next);
              }}
            >
              <option value="default">Системные динамики</option>
              {outputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {getDeviceLabel(device, 'Динамик')}
                </option>
              ))}
            </select>
            <KeyboardArrowDownIcon className="audio-settings__select-chevron" fontSize="small" />
          </div>

          <div className="audio-settings__slider-block">
            <div className="audio-settings__slider-head">
              <span>Громкость динамика</span>
            </div>
            <div className="settings-volume-control">
              <input
                type="range"
                min="0"
                max={OUTPUT_VOLUME_PERCENT_MAX}
                value={outputVolumePercent}
                className="settings-volume-control__range"
                onChange={(event) => {
                  const next = percentToOutputGain(event.target.value);
                  setOutputVolume(next);
                  volumeStorage.setOutputVolume(next);
                }}
              />
              <span className="settings-volume-control__value">{outputVolumePercent}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="audio-settings__test-row">
        <button
          type="button"
          className={`settings-btn settings-btn--primary audio-settings__test-btn${isMicTesting ? ' is-active' : ''}`}
          onClick={() => {
            if (isMicTesting) {
              stopMicTest();
              return;
            }
            void startMicTest();
          }}
        >
          {isMicTesting ? 'Остановить проверку' : 'Проверка микрофона'}
        </button>
        <div className="audio-settings__meter" aria-hidden="true">
          {Array.from({ length: LEVEL_BAR_COUNT }, (_, index) => {
            const isActive = index < activeBars;
            const isThreshold = index === thresholdBars;
            return (
              <span
                key={index}
                className={[
                  'audio-settings__meter-bar',
                  isActive ? 'is-active' : '',
                  isThreshold ? 'is-threshold' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            );
          })}
        </div>
      </div>

      <div className="audio-settings__sensitivity">
        <div className="audio-settings__sensitivity-head">
          <div className="audio-settings__sensitivity-title-row">
            <span className="audio-settings__sensitivity-title">Чувствительность ввода</span>
            <span className="audio-settings__sensitivity-value">{micSensitivity}%</span>
          </div>
          <p className="audio-settings__sensitivity-desc">
            Порог передачи голоса в звонке и при проверке микрофона. Ниже порога микрофон не
            передаёт звук собеседникам.
          </p>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={micSensitivity}
          className="audio-settings__range audio-settings__range--sensitivity"
          style={{ '--sensitivity-percent': `${micSensitivity}%` }}
          onChange={(event) => {
            const next = Number(event.target.value);
            setMicSensitivity(next);
            volumeStorage.setMicThreshold(sensitivityToMicThreshold(next));
          }}
        />
      </div>

      <label className="audio-settings__toggle" htmlFor="audio-echo-cancellation">
        <span className="audio-settings__toggle-info">
          <span className="audio-settings__toggle-title">Эхоподавление</span>
          <span className="audio-settings__toggle-desc">
            Убирает звук собеседников с микрофона. Для гарнитуры выберите её же в поле «Динамик».
          </span>
        </span>
        <span className="settings-switch">
          <input
            id="audio-echo-cancellation"
            type="checkbox"
            checked={echoCancellation}
            onChange={(event) => {
              const enabled = event.target.checked;
              setEchoCancellation(enabled);
              volumeStorage.setEchoCancellation(enabled);
              if (isMicTesting) {
                void startMicTest();
              }
            }}
          />
          <span className="settings-switch__slider" />
        </span>
      </label>
    </div>
  );
}

export default AudioSettingsSection;
