import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import './EventDateTimePickers.css';

const EASE_OUT = [0.16, 1, 0.3, 1];
const SPRING_PRESS = { type: 'spring', stiffness: 500, damping: 30, mass: 0.6 };

const parseYmd = (ymd) => {
  if (!ymd || typeof ymd !== 'string') return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const toYmd = (date) => format(date, 'yyyy-MM-dd');

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const formatShort = (date) =>
  date ? format(date, 'd MMM yyyy', { locale: ru }) : 'Выберите дату';

const formatTriggerRange = (fromDate, toDate) => {
  if (!fromDate) return 'Выберите даты';
  if (!toDate || isSameDay(fromDate, toDate)) {
    return format(fromDate, 'd MMM yyyy', { locale: ru });
  }
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  if (sameYear) {
    return `${format(fromDate, 'd MMM', { locale: ru })} – ${format(toDate, 'd MMM yyyy', { locale: ru })}`;
  }
  return `${format(fromDate, 'd MMM yyyy', { locale: ru })} – ${format(toDate, 'd MMM yyyy', { locale: ru })}`;
};

const dayCountInclusive = (fromDate, toDate) => {
  if (!fromDate || !toDate) return 0;
  const ms = startOfDay(toDate).getTime() - startOfDay(fromDate).getTime();
  return Math.floor(ms / 86400000) + 1;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Date range picker matching beUI Date Range Picker (dropdown composition).
 * https://beui.dev/components/motion/date-range-picker
 */
export function EventDateRangePicker({
  from,
  to,
  onChange,
  disabled = false,
  className = '',
  label = 'Даты события',
}) {
  const reduce = useReducedMotion() ?? false;
  const fromDate = parseYmd(from);
  const toDate = parseYmd(to);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const headingId = useId();
  const helpId = useId();

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(fromDate || new Date()));
  const [direction, setDirection] = useState(0);
  const [view, setView] = useState('days'); // days | months | years
  const [preview, setPreview] = useState(null);
  const [pickingEnd, setPickingEnd] = useState(Boolean(fromDate && !toDate));

  const shownTo = useMemo(() => {
    if (toDate) return toDate;
    if (pickingEnd && fromDate && preview) {
      return isBefore(preview, fromDate) ? fromDate : preview;
    }
    return toDate;
  }, [toDate, pickingEnd, fromDate, preview]);

  const shownFrom = useMemo(() => {
    if (pickingEnd && fromDate && preview && isBefore(preview, fromDate)) {
      return preview;
    }
    return fromDate;
  }, [pickingEnd, fromDate, preview]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const weeks = useMemo(() => {
    const rows = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [days]);

  const year = viewMonth.getFullYear();
  const yearPage = Math.floor(year / 12) * 12;
  const yearPageEnd = yearPage + 11;

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const d = new Date(year, i, 1);
        return { id: i, label: format(d, 'LLL', { locale: ru }), date: d };
      }),
    [year]
  );

  const years = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const y = yearPage + i;
        return { id: y, label: String(y) };
      }),
    [yearPage]
  );

  const goMonth = (delta) => {
    setDirection(delta);
    setViewMonth((m) => (delta > 0 ? addMonths(m, 1) : subMonths(m, 1)));
    setView('days');
  };

  const selectDay = (day) => {
    if (disabled) return;
    const ymd = toYmd(day);

    if (!fromDate || (fromDate && toDate) || !pickingEnd) {
      onChange?.({ from: ymd, to: ymd });
      setPickingEnd(true);
      setPreview(null);
      return;
    }

    if (isBefore(day, fromDate)) {
      onChange?.({ from: ymd, to: from });
    } else {
      onChange?.({ from, to: ymd });
    }
    setPickingEnd(false);
    setPreview(null);
  };

  const clear = () => {
    onChange?.({ from: '', to: '' });
    setPickingEnd(false);
    setPreview(null);
  };

  const completeCount = fromDate && toDate ? dayCountInclusive(fromDate, toDate) : 0;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (fromDate) setViewMonth(startOfMonth(fromDate));
  }, [from]); // eslint-disable-line react-hooks/exhaustive-deps

  const footerLabel = completeCount
    ? `${completeCount} ${pluralDays(completeCount)} выбрано`
    : fromDate && pickingEnd
      ? 'Выберите дату окончания'
      : 'Выберите дату начала';

  const dayMeta = useCallback(
    (day) => {
      const inMonth = isSameMonth(day, viewMonth);
      const isFrom = shownFrom && isSameDay(day, shownFrom);
      const isTo = shownTo && isSameDay(day, shownTo);
      const endpoint = isFrom || isTo;
      const inRange =
        shownFrom &&
        shownTo &&
        !isBefore(day, shownFrom) &&
        !isAfter(day, shownTo);
      return { inMonth, isFrom, isTo, endpoint, inRange, today: isToday(day) };
    },
    [viewMonth, shownFrom, shownTo]
  );

  return (
    <div
      className={`be-date-range ${className}`.trim()}
      ref={rootRef}
      data-open={open || undefined}
      data-disabled={disabled || undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className="be-date-range__trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarDays size={16} aria-hidden className="be-date-range__trigger-icon" />
        <span className="be-date-range__trigger-label">
          <span className="be-date-range__trigger-prefix">{label}:</span>{' '}
          {formatTriggerRange(fromDate, toDate)}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`be-date-range__trigger-chevron${open ? ' is-open' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="be-date-range__panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby={headingId}
            aria-describedby={helpId}
            initial={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: reduce ? 0 : -4,
              scale: reduce ? 1 : 0.98,
              transition: { duration: 0.12, ease: EASE_OUT },
            }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <div className="be-date-range__summary">
              <div className="be-date-range__summary-col">
                <p className="be-date-range__summary-label">Дата начала</p>
                <p className="be-date-range__summary-value">{formatShort(fromDate)}</p>
              </div>
              <ArrowRight size={14} className="be-date-range__summary-arrow" aria-hidden />
              <div className="be-date-range__summary-col">
                <p className="be-date-range__summary-label">Дата окончания</p>
                <p
                  className={`be-date-range__summary-value${!toDate ? ' is-muted' : ''}`}
                >
                  {formatShort(toDate)}
                </p>
              </div>
            </div>

            <div className="be-date-range__header">
              <div className="be-date-range__header-titles">
                <button
                  type="button"
                  className={`be-date-range__month-btn${view === 'months' ? ' is-active' : ''}`}
                  aria-label="Выбрать месяц"
                  aria-expanded={view === 'months'}
                  disabled={disabled}
                  onClick={() => setView((v) => (v === 'months' ? 'days' : 'months'))}
                >
                  {format(viewMonth, 'LLLL', { locale: ru })}
                  <ChevronDown size={12} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`be-date-range__year-btn${view === 'years' ? ' is-active' : ''}`}
                  aria-label="Выбрать год"
                  aria-expanded={view === 'years'}
                  disabled={disabled}
                  onClick={() => setView((v) => (v === 'years' ? 'days' : 'years'))}
                >
                  {view === 'years' ? `${yearPage}–${yearPageEnd}` : year}
                  <ChevronDown size={12} aria-hidden />
                </button>
              </div>
              <div className="be-date-range__header-nav">
                <button
                  type="button"
                  className="be-date-range__icon-btn"
                  aria-label={
                    view === 'years'
                      ? 'Предыдущие годы'
                      : view === 'months'
                        ? 'Предыдущий год'
                        : 'Предыдущий месяц'
                  }
                  disabled={disabled}
                  onClick={() => {
                    if (view === 'years') {
                      setDirection(-1);
                      setViewMonth((m) => new Date(m.getFullYear() - 12, m.getMonth(), 1));
                      return;
                    }
                    if (view === 'months') {
                      setDirection(-1);
                      setViewMonth((m) => new Date(m.getFullYear() - 1, m.getMonth(), 1));
                      return;
                    }
                    goMonth(-1);
                  }}
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="be-date-range__icon-btn"
                  aria-label={
                    view === 'years'
                      ? 'Следующие годы'
                      : view === 'months'
                        ? 'Следующий год'
                        : 'Следующий месяц'
                  }
                  disabled={disabled}
                  onClick={() => {
                    if (view === 'years') {
                      setDirection(1);
                      setViewMonth((m) => new Date(m.getFullYear() + 12, m.getMonth(), 1));
                      return;
                    }
                    if (view === 'months') {
                      setDirection(1);
                      setViewMonth((m) => new Date(m.getFullYear() + 1, m.getMonth(), 1));
                      return;
                    }
                    goMonth(1);
                  }}
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            </div>

            <h3 id={headingId} className="be-date-range__sr-only">
              {format(viewMonth, 'LLLL yyyy', { locale: ru })}
            </h3>
            <p id={helpId} className="be-date-range__sr-only">
              Стрелки перемещают по датам. Enter или пробел выбирают дату.
            </p>

            <div className="be-date-range__grid-wrap">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={`${view}-${format(viewMonth, 'yyyy-MM')}-${yearPage}`}
                  initial={
                    reduce ? false : { opacity: 0, x: direction >= 0 ? 18 : -18 }
                  }
                  animate={{ opacity: 1, x: 0 }}
                  exit={
                    reduce
                      ? undefined
                      : { opacity: 0, x: direction >= 0 ? -18 : 18 }
                  }
                  transition={{ duration: reduce ? 0.1 : 0.18, ease: EASE_OUT }}
                >
                  {view === 'days' ? (
                    <>
                      <div className="be-date-range__weekdays" aria-hidden>
                        {WEEKDAYS.map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </div>
                      <div
                        className="be-date-range__grid"
                        role="grid"
                        onMouseLeave={() => setPreview(null)}
                      >
                        {weeks.map((week) =>
                          week.map((day, dayIndex) => {
                            const { inMonth, isFrom, isTo, endpoint, inRange, today } =
                              dayMeta(day);
                            if (!inMonth) {
                              return (
                                <div
                                  key={toYmd(day)}
                                  className="be-date-range__cell is-outside"
                                  role="gridcell"
                                />
                              );
                            }

                            const rangeStart =
                              inRange &&
                              (dayIndex === 0 || (shownFrom && isSameDay(day, shownFrom)));
                            const rangeEnd =
                              inRange &&
                              (dayIndex === 6 ||
                                (shownTo && isSameDay(day, shownTo)) ||
                                !shownTo);

                            return (
                              <div
                                key={toYmd(day)}
                                role="gridcell"
                                className={[
                                  'be-date-range__cell',
                                  inRange && 'is-in-range',
                                  rangeStart && 'is-range-start',
                                  rangeEnd && 'is-range-end',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                onMouseEnter={() => {
                                  if (pickingEnd && fromDate && !toDate) setPreview(day);
                                }}
                              >
                                <span
                                  className="be-date-range__range-bg"
                                  aria-hidden
                                  style={{
                                    opacity: inRange ? 1 : 0,
                                    left:
                                      endpoint &&
                                      shownFrom &&
                                      isSameDay(day, shownFrom)
                                        ? '50%'
                                        : 0,
                                    right:
                                      endpoint &&
                                      shownTo &&
                                      isSameDay(day, shownTo)
                                        ? '50%'
                                        : endpoint &&
                                            shownFrom &&
                                            !shownTo &&
                                            isSameDay(day, shownFrom)
                                          ? '50%'
                                          : 0,
                                  }}
                                />
                                <motion.button
                                  type="button"
                                  className={[
                                    'be-date-range__day',
                                    endpoint && 'is-endpoint',
                                    isFrom && 'is-from',
                                    isTo && 'is-to',
                                    today && !endpoint && 'is-today',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  disabled={disabled}
                                  aria-label={format(day, 'd MMMM yyyy', { locale: ru })}
                                  aria-current={today ? 'date' : undefined}
                                  whileTap={reduce ? undefined : { scale: 0.9 }}
                                  transition={SPRING_PRESS}
                                  onClick={() => selectDay(day)}
                                >
                                  {format(day, 'd')}
                                </motion.button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  ) : null}

                  {view === 'months' ? (
                    <div className="be-date-range__choices" role="listbox" aria-label="Месяц">
                      {months.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          role="option"
                          aria-selected={m.id === viewMonth.getMonth()}
                          className={`be-date-range__choice${m.id === viewMonth.getMonth() ? ' is-selected' : ''}`}
                          onClick={() => {
                            setDirection(0);
                            setViewMonth(new Date(year, m.id, 1));
                            setView('days');
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {view === 'years' ? (
                    <div className="be-date-range__choices" role="listbox" aria-label="Год">
                      {years.map((y) => (
                        <button
                          key={y.id}
                          type="button"
                          role="option"
                          aria-selected={y.id === year}
                          className={`be-date-range__choice${y.id === year ? ' is-selected' : ''}`}
                          onClick={() => {
                            setDirection(0);
                            setViewMonth(new Date(y.id, viewMonth.getMonth(), 1));
                            setView('days');
                          }}
                        >
                          {y.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="be-date-range__footer">
              <p className="be-date-range__selection">{footerLabel}</p>
              <button
                type="button"
                className="be-date-range__clear"
                aria-label="Очистить диапазон дат"
                disabled={disabled || !fromDate}
                onClick={clear}
              >
                Очистить
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function pluralDays(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

export default EventDateRangePicker;
