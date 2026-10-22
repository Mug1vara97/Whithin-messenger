import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaTimes,
  FaVolumeUp,
  FaMapMarkerAlt,
  FaBroadcastTower,
} from 'react-icons/fa';
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
  const [coverPreview, setCoverPreview] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const coverInputRef = useRef(null);

  const voiceChannels = useMemo(
    () => collectServerChannels(categories).filter(isVoiceChannel),
    [categories]
  );

  const selectedChannel = useMemo(
    () => voiceChannels.find((c) => String(c.chatId) === String(channelId)),
    [voiceChannels, channelId]
  );

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setDone(false);
    setStep(0);
    setCoverPreview(null);

    if (mode === 'edit' && event) {
      const isExternal = event.locationType === SERVER_EVENT_LOCATION.EXTERNAL;
      setLocationKind(isExternal ? 'external' : 'voice');
      setChannelId(event.channelId || '');
      setExternalLocation(event.externalLocation || '');
      setTitle(event.title || '');
      setDescription(event.description || '');
      setStartDate(toDateInputValue(event.startsAt));
      setStartTime(toTimeInputValue(event.startsAt));
      return;
    }

    const start = defaultStart();
    setLocationKind('voice');
    setChannelId(voiceChannels[0]?.chatId ? String(voiceChannels[0].chatId) : '');
    setExternalLocation('');
    setTitle('');
    setDescription('');
    setStartDate(toDateInputValue(start.toISOString()));
    setStartTime(toTimeInputValue(start.toISOString()));
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
    const endsAt = startsAt
      ? new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000).toISOString()
      : null;
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
    if (!startsAt) return 'Укажите дату и время начала';
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

  const onCoverChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Обложка должна быть изображением');
      return;
    }
    const url = URL.createObjectURL(file);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setError('');
  };

  const preview = {
    title: title.trim() || 'Без названия',
    description: description.trim(),
    when: formatEventWhen(combineDateAndTime(startDate, startTime), null),
    location:
      locationKind === 'external'
        ? externalLocation.trim()
        : selectedChannel?.name || 'Голосовой канал',
    cover: coverPreview,
  };

  return (
    <div className="server-events-overlay" onClick={onClose}>
      <div
        className="server-events-modal wide sev-wizard"
        onClick={(e) => e.stopPropagation()}
      >
        {!done && (
          <div className="sev-wizard-top">
            <div className="sev-steps" role="tablist" aria-label="Шаги создания события">
              {STEPS.map((label, idx) => (
                <div
                  key={label}
                  className={`sev-step ${idx === step ? 'active' : ''} ${idx < step ? 'done' : ''}`}
                  aria-current={idx === step ? 'step' : undefined}
                >
                  <span className="sev-step__bar" aria-hidden />
                  <span className="sev-step__label">{label}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="server-events-modal-close sev-wizard-close"
              onClick={onClose}
              aria-label="Закрыть"
            >
              <FaTimes />
            </button>
          </div>
        )}

        <div className="server-events-modal-body sev-wizard-body">
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
                  <h3 className="sev-wizard-title">Где пройдёт ваше событие?</h3>
                  <p className="sev-wizard-sub">Чтобы все знали, где его искать.</p>

                  <div className="sev-option disabled" aria-disabled>
                    <span className="sev-option__radio" aria-hidden />
                    <span className="sev-option__icon" aria-hidden>
                      <FaBroadcastTower />
                    </span>
                    <div className="sev-option__text">
                      <div className="sev-option-title">Трибуна</div>
                      <div className="sev-option-desc">
                        Отлично подходит для голосовых событий крупных сообществ.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`sev-option ${locationKind === 'voice' ? 'selected' : ''}`}
                    onClick={() => setLocationKind('voice')}
                  >
                    <span
                      className={`sev-option__radio ${locationKind === 'voice' ? 'is-on' : ''}`}
                      aria-hidden
                    />
                    <span className="sev-option__icon" aria-hidden>
                      <FaVolumeUp />
                    </span>
                    <div className="sev-option__text">
                      <div className="sev-option-title">Голосовой канал</div>
                      <div className="sev-option-desc">
                        Голос, видео, показ экрана и стриминг Go Live.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`sev-option ${locationKind === 'external' ? 'selected' : ''}`}
                    onClick={() => setLocationKind('external')}
                  >
                    <span
                      className={`sev-option__radio ${locationKind === 'external' ? 'is-on' : ''}`}
                      aria-hidden
                    />
                    <span className="sev-option__icon" aria-hidden>
                      <FaMapMarkerAlt />
                    </span>
                    <div className="sev-option__text">
                      <div className="sev-option-title">В другом месте</div>
                      <div className="sev-option-desc">
                        Текстовый канал, внешняя ссылка или место проведения.
                      </div>
                    </div>
                  </button>

                  {locationKind === 'voice' ? (
                    <label className="sev-field">
                      <span>
                        Выбрать канал <span className="req">*</span>
                      </span>
                      <div className="sev-channel-select">
                        <span className="sev-channel-select__icon" aria-hidden>
                          <FaVolumeUp />
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
                      </div>
                      <p className="sev-field-hint">
                        События в приватном канале будут видны только тем, у кого есть к нему
                        доступ.
                      </p>
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
                      placeholder="Чему посвящено ваше событие?"
                    />
                  </label>

                  <div className="event-datetime-row">
                    <div className="sev-field sev-field--inline">
                      <span>
                        Дата начала <span className="req">*</span>
                      </span>
                      <EventDateRangePicker
                        label="Дата начала"
                        from={startDate}
                        onChange={({ from }) => {
                          setStartDate(from || '');
                        }}
                        className="sev-datetime-control"
                      />
                    </div>
                    <div className="sev-field sev-field--inline">
                      <span>
                        Время начала <span className="req">*</span>
                      </span>
                      <EventTimeWheelPicker
                        label="Время начала"
                        value={startTime}
                        onChange={setStartTime}
                        minuteStep={1}
                        className="sev-datetime-control"
                      />
                    </div>
                  </div>

                  <label className="sev-field">
                    <span>
                      Частота события <span className="req">*</span>
                    </span>
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
                      placeholder="Расскажите о своём событии подробнее. Поддерживаются разметка текста, перенос строк и ссылки."
                    />
                  </label>

                  <div className="sev-field">
                    <span>Обложка</span>
                    <p className="sev-field-hint sev-field-hint--cover">
                      Рекомендуем использовать изображение размером не менее 800 пикселей в ширину
                      и 320 пикселей в высоту.
                    </p>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={onCoverChange}
                    />
                    {coverPreview ? (
                      <div className="sev-cover-preview">
                        <img src={coverPreview} alt="Обложка события" />
                        <div className="sev-cover-preview__actions">
                          <button
                            type="button"
                            className="sev-btn primary"
                            onClick={() => coverInputRef.current?.click()}
                          >
                            Заменить
                          </button>
                          <button
                            type="button"
                            className="sev-btn ghost"
                            onClick={() => {
                              setCoverPreview((prev) => {
                                if (prev) URL.revokeObjectURL(prev);
                                return null;
                              });
                              if (coverInputRef.current) coverInputRef.current.value = '';
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="sev-btn primary sev-cover-upload"
                        onClick={() => coverInputRef.current?.click()}
                      >
                        Загрузить обложку
                      </button>
                    )}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h3 className="sev-wizard-title">Всё верно?</h3>
                  <p className="sev-wizard-sub">Проверьте сведения перед публикацией.</p>
                  <div className="sev-preview-card">
                    {preview.cover && (
                      <div className="sev-preview-cover">
                        <img src={preview.cover} alt="" />
                      </div>
                    )}
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

        <div className={`server-events-modal-footer ${step > 0 && !done ? 'has-back' : ''}`}>
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
              {step > 0 && (
                <button
                  type="button"
                  className="sev-btn link"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Назад
                </button>
              )}
              <div className="sev-footer-actions">
                <button type="button" className="sev-btn secondary" onClick={onClose}>
                  Отмена
                </button>
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServerEventModal;
