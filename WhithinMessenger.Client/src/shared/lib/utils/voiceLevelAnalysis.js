/** Speech-focused band — ignores sub-bass rumble and high-frequency click transients. */
export const SPEECH_BAND_MIN_HZ = 200;
export const SPEECH_BAND_MAX_HZ = 3200;

export function getSpeechBandBinRange(fftSize, sampleRate) {
  const nyquistBin = Math.floor(fftSize / 2) - 1;
  const binWidth = sampleRate / fftSize;
  const lowBin = Math.max(1, Math.floor(SPEECH_BAND_MIN_HZ / binWidth));
  const highBin = Math.min(nyquistBin, Math.ceil(SPEECH_BAND_MAX_HZ / binWidth));
  return { lowBin, highBin };
}

export function measureSpeechBandLevel(frequencyData, fftSize, sampleRate) {
  if (!frequencyData?.length || !fftSize || !sampleRate) return 0;

  const { lowBin, highBin } = getSpeechBandBinRange(fftSize, sampleRate);
  if (highBin < lowBin) return 0;

  let sum = 0;
  for (let i = lowBin; i <= highBin; i += 1) {
    sum += frequencyData[i];
  }

  return sum / (highBin - lowBin + 1);
}

export function createSpeechBandAnalyserChain(audioContext, sourceNode) {
  const highPass = audioContext.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = SPEECH_BAND_MIN_HZ;
  highPass.Q.value = 0.707;

  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = SPEECH_BAND_MAX_HZ;
  lowPass.Q.value = 0.707;

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;

  sourceNode.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(analyser);

  return { highPass, lowPass, analyser };
}
