export function Equalizer({ paused }) {
  return (
    <span className={`equalizer${paused ? ' equalizer--paused' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
