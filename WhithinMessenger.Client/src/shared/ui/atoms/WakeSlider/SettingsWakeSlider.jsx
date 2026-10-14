import WakeSlider from './WakeSlider';

const formatPercent = (value) => `${Math.round(Number(value))}%`;

/** Themed Wake Slider for settings volume controls. */
export default function SettingsWakeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  ariaLabel = 'Громкость',
  showValue = true,
  id,
  className = '',
}) {
  return (
    <WakeSlider
      id={id}
      className={`settings-wake-slider${className ? ` ${className}` : ''}`}
      value={value}
      min={min}
      max={max}
      step={step}
      bars={28}
      height={36}
      restHeight={8}
      gap={3}
      fillColor="var(--primary, #5865f2)"
      trackColor="var(--border, #3f4147)"
      crestColor="var(--text, #f2f3f5)"
      sensitivity={1}
      reach={5}
      skew={0.6}
      glide={0.28}
      smoothing={100}
      showValue={showValue}
      formatValue={formatPercent}
      disabled={disabled}
      ariaLabel={ariaLabel}
      onChange={onChange}
    />
  );
}
