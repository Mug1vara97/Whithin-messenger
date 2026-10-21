import React, { useEffect, useMemo, useState } from 'react';
import { FaTimes, FaVolumeUp, FaMapMarkerAlt } from 'react-icons/fa';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import {
  SERVER_EVENT_LOCATION,
  collectServerChannels,
  isVoiceChannel,
  toDateInputValue,
  toTimeInputValue,
  combineDateAndTime,
  formatEventWhen,
  serverEventApi,
} from '../../../entities/server-event';
import {
  EventDateRangePicker,
  EventTimeWheelPicker,
} from '../../../shared/ui/molecules/EventDateTimePickers';
import './ServerEvents.css';

const STEPS = ['Место', 'Сведения о событии', 'Просмотреть'];

const defaultStart = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d;
};

const defaultEnd = (start) => {
  const d = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return d;
};

const ServerEventModal = ({
  isOpen,
  onClose,
  mode = 'create',
  event = null,
  serverId,
  categories = [],
  connection,
  onCreated,
}) => {
  const [step, setStep] = useState(0);
  const [locationKind, setLocationKind] = useState('voice'); // voice | external
  const [channelId, setChannelId] = useState('');
  const [externalLocation, setExternalLocation] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const voiceChannels = useMemo(
    () => collectServerChannels(categories).filter(isVoiceChannel),
    [categories]
  );

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setDone(false);
    setStep(0);

    if (mode === 'edit' && event) {
      const isExternal = event.locationType === SERVER_EVENT_LOCATION.EXTERNAL;
      setLocationKind(isExternal ? 'external' : 'voice');
      setChannelId(event.channelId || '');
      setExternalLocation(event.externalLocation || '');
      setTitle(event.title || '');
      setDescription(event.description || '');
      setStartDate(toDateInputValue(event.startsAt));
      setStartTime(toTimeInputValue(event.startsAt));
      setEndDate(toDateInputValue(event.endsAt || event.startsAt));
      setEndTime(toTimeInputValue(event.endsAt || event.startsAt));
      return;
    }

    const start = defaultStart();
    const end = defaultEnd(start);
    setLocationKind('voice');
    setChannelId(voiceChannels[0]?.chatId ? String(voiceChannels[0].chatId) : '');
    setExternalLocation('');
    setTitle('');
    setDescription('');
    setStartDate(toDateInputValue(start.toISOString()));
    setStartTime(toTimeInputValue(start.toISOString()));
    setEndDate(toDateInputValue(end.toISOString()));
    setEndTime(toTimeInputValue(end.toISOString()));
  }, [isOpen, mode, event, voiceChannels]);

  useEffect(() => {
    if (locationKind !== 'voice' || !voiceChannels.length) return;
    if (!voiceChannels.some((c) => String(c.chatId) === String(channelId))) {
      setChannelId(String(voiceChannels[0].chatId));
    }
  }, [locationKind, voiceChannels, channelId]);

  if (!isOpen) return null;

  const buildPayload = () => {
    const startsAt = combineDateAndTime(startDate, startTime);
    const endsAt = combineDateAndTime(endDate, endTime);
    const locationType =
      locationKind === 'external'
        ? SERVER_EVENT_LOCATION.EXTERNAL
        : SERVER_EVENT_LOCATION.VOICE;

    return {
      serverId,
      eventId: event?.eventId,
      title: title.trim(),
      description: description.trim() || null,
      startsAt,
      endsAt,
      locationType,
      channelId: locationKind === 'voice' ? channelId || null : null,
      externalLocation:
        locationKind === 'external' ? externalLocation.trim() : null,
    };
  };

  const validateStep0 = () => {
    if (locationKind === 'voice') {
      if (!channelId) return 'Выберите голосовой канал';
      return null;
    }
    if (!externalLocation.trim()) return 'Укажите место проведения';
    return null;
  };

  const validateStep1 = () => {
    if (!title.trim()) return 'Укажите тему события';
    const startsAt = combineDateAndTime(startDate, startTime);
    const endsAt = combineDateAndTime(endDate, endTime);
    if (!startsAt) return 'Укажите дату и время начала';
    if (!endsAt) return 'Укажите дату и время окончания';
    if (new Date(endsAt) <= new Date(startsAt)) {
      return 'Время окончания должно быть позже начала';
    }
    return null;
  };

  const goNext = () => {
    setError('');
    if (step === 0) {
      const err = validateStep0();
      if (err) {
        setError(err);
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
    }
  };

  const submit = async () => {
    setError('');
    const err0 = validateStep0();
    const err1 = validateStep1();
    if (err0 || err1) {
      setError(err0 || err1);
      setStep(err0 ? 0 : 1);
      return;
    }
    if (!connection || connection.state !== 'Connected') {
      setError('Нет соединения с сервером');
      return;
    }

    const payload = buildPayload();
    setSaving(true);
    try {
      if (mode === 'edit') {
        await serverEventApi.updateEvent(connection, payload);
        onCreated?.();
        onClose();
      } else {
        await serverEventApi.createEvent(connection, payload);
        setDone(true);
      }
    } catch (e) {
      setError(e?.message || 'Не удалось сохранить событие');
    } finally {
      setSaving(false);
    }
  };

  const preview = {
    title: title.trim() || 'Без названия',
    description: description.trim(),
    when: formatEventWhen(
      combineDateAndTime(startDate, startTime),
      combineDateAndTime(endDate, endTime)
    ),
    location:
      locationKind === 'external'
        ? externalLocation.trim()
        : voiceChannels.find((c) => String(c.chatId) === String(channelId))?.name ||
          'Голосовой канал',
  };

  return (
    <div className="server-events-overlay" onClick={onClose}>
      <div className="server-events-modal wide" onClick={(e) => e.stopPropagation()}>
        {!done && (
          <>
            <div className="server-events-modal-header">
              <h2>{mode === 'edit' ? 'Изменить событие' : 'Создать событие'}</h2>
              <button type="button" className="server-events-modal-close" onClick={onClose}>
                <FaTimes />
              </button>
            </div>
            <div className="sev-steps">
              {STEPS.map((label, idx) => (
                <div
                  key={label}
                  className={`sev-step ${idx === step ? 'active' : ''} ${idx < step ? 'done' : ''}`}
                >
                  {label}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="server-events-modal-body">
          {done ? (
            <div className="sev-success">
              <div className="sev-confetti" aria-hidden>
                {Array.from({ length: 18 }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      left: `${8 + (i * 5) % 84}%`,
                      background: ['#5865f2', '#57f287', '#fee75c', '#eb459e', '#00a8fc'][i % 5],
                      animationDelay: `${(i % 6) * 0.08}s`,
                    }}
                  />
                ))}
              </div>
              <div className="sev-success-icon">
                <EventAvailableIcon />
              </div>
              <h3>Готово</h3>
              <p>Событие создано. Расскажи друзьям или отметь «Интересно» в списке.</p>
            </div>
          ) : (
            <>
              {step === 0 && (
                <>
                  <h3 className="sev-wizard-title">Где пройдет ваше событие?</h3>
                  <p className="sev-wizard-sub">Чтобы все знали, где его искать.</p>

                  <div className="sev-option disabled" aria-disabled>
                    <input type="radio" disabled />
                    <div>
                      <div className="sev-option-title">Трибуна</div>
                      <div className="sev-option-desc">
                        Пока недоступно. Отлично подходит для крупных голосовых событий.
                      </div>
                    </div>
                  </div>

                  <label className={`sev-option ${locationKind === 'voice' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="loc"
                      checked={locationKind === 'voice'}
                      onChange={() => setLocationKind('voice')}
                    />
                    <div>
                      <div className="sev-option-title">
                        <FaVolumeUp style={{ marginRight: 6 }} />
                        Голосовой канал
                      </div>
                      <div className="sev-option-desc">
                        Голос, видео и демонстрация экрана
                      </div>
                    </div>
                  </label>

                  <label className={`sev-option ${locationKind === 'external' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="loc"
                      checked={locationKind === 'external'}
                      onChange={() => setLocationKind('external')}
                    />
                    <div>
                      <div className="sev-option-title">
                        <FaMapMarkerAlt style={{ marginRight: 6 }} />
                        В другом месте
                      </div>
                      <div className="sev-option-desc">
                        Текстовый канал, внешняя ссылка или место проведения
                      </div>
                    </div>
                  </label>

                  {locationKind === 'voice' ? (
                    <label className="sev-field">
                      <span>
                        Голосовой канал <span className="req">*</span>
                      </span>
                      <select
                        value={channelId}
                        onChange={(e) => setChannelId(e.target.value)}
                      >
                        {voiceChannels.length === 0 && (
                          <option value="">Нет голосовых каналов</option>
                        )}
                        {voiceChannels.map((ch) => (
                          <option key={ch.chatId} value={ch.chatId}>
                            {ch.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="sev-field">
                      <span>
                        Укажите место <span className="req">*</span>
                      </span>
                      <input
                        value={externalLocation}
                        onChange={(e) => setExternalLocation(e.target.value)}
                        placeholder="Введите место, ссылку, что-нибудь."
                        maxLength={500}
                      />
                    </label>
                  )}
                </>
              )}

              {step === 1 && (
                <>
                  <h3 className="sev-wizard-title">Чему посвящено ваше событие?</h3>
                  <p className="sev-wizard-sub">Опишите подробнее своё событие.</p>

                  <label className="sev-field">
                    <span>
                      Тема события <span className="req">*</span>
                    </span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={200}
                    />
                  </label>

                  <div className="sev-field">
                    <span>
                      Даты события <span className="req">*</span>
                    </span>
                    <EventDateRangePicker
                      from={startDate}
                      to={endDate}
                      onChange={({ from, to }) => {
                        setStartDate(from);
                        setEndDate(to);
                      }}
                    />
                  </div>

                  <div className="event-datetime-pair">
                    <EventTimeWheelPicker
                      label={
                        <>
                          Время начала <span className="req">*</span>
                        </>
                      }
                      value={startTime}
                      onChange={setStartTime}
                      minuteStep={5}
                    />
                    <EventTimeWheelPicker
                      label={
                        <>
                          Время окончания <span className="req">*</span>
                        </>
                      }
                      value={endTime}
                      onChange={setEndTime}
                      minuteStep={5}
                    />
                  </div>

                  <label className="sev-field">
                    <span>Частота события</span>
                    <select value="none" disabled>
                      <option value="none">Не повторяется</option>
                    </select>
                  </label>

                  <label className="sev-field">
                    <span>Описание</span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={4000}
                      placeholder="Расскажите о своём событии подробнее."
                    />
                  </label>
                </>
              )}

              {step === 2 && (
                <>
                  <h3 className="sev-wizard-title">Всё верно?</h3>
                  <p className="sev-wizard-sub">Проверьте сведения перед публикацией.</p>
                  <div className="sev-preview-card">
                    <h3>{preview.title}</h3>
                    <p>{preview.when}</p>
                    <p>{preview.location}</p>
                    {preview.description && <p>{preview.description}</p>}
                  </div>
                </>
              )}

              {error && <div className="sev-error">{error}</div>}
            </>
          )}
        </div>

        <div className="server-events-modal-footer">
          {done ? (
            <button
              type="button"
              className="sev-btn primary"
              onClick={() => {
                onCreated?.();
                onClose();
              }}
            >
              Готово
            </button>
          ) : (
            <>
              <button type="button" className="sev-btn ghost spacer" onClick={onClose}>
                Отмена
              </button>
              {step > 0 && (
                <button type="button" className="sev-btn ghost" onClick={() => setStep((s) => s - 1)}>
                  Назад
                </button>
              )}
              {step < 2 ? (
                <button type="button" className="sev-btn primary" onClick={goNext}>
                  Далее
                </button>
              ) : (
                <button
                  type="button"
                  className="sev-btn primary"
                  onClick={submit}
                  disabled={saving}
                >
                  {saving ? 'Сохранение…' : mode === 'edit' ? 'Сохранить' : 'Создать событие'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServerEventModal;
