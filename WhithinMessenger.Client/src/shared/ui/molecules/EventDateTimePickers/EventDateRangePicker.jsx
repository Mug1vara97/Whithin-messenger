import React, { useMemo, useState } from 'react';
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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './EventDateTimePickers.css';

const parseYmd = (ymd) => {
  if (!ymd || typeof ymd !== 'string') return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const toYmd = (date) => format(date, 'yyyy-MM-dd');

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/**
 * Month calendar with from→to range selection inspired by beUI Date Range Picker.
 * https://beui.dev/components/motion/date-range-picker
 */
export function EventDateRangePicker({
  from,
  to,
  onChange,
  disabled = false,
  className = '',
}) {
  const reduce = useReducedMotion() ?? false;
  const fromDate = parseYmd(from);
  const toDate = parseYmd(to);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(fromDate || new Date()));
  const [direction, setDirection] = useState(0);
  const [picking, setPicking] = useState('from'); // 'from' | 'to'

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const goMonth = (delta) => {
    setDirection(delta);
    setViewMonth((m) => (delta > 0 ? addMonths(m, 1) : subMonths(m, 1)));
  };

  const onDayClick = (day) => {
    if (disabled) return;
    const ymd = toYmd(day);

    if (picking === 'from' || !fromDate) {
      onChange?.({ from: ymd, to: toDate && !isBefore(toDate, day) ? to : ymd });
      setPicking('to');
      return;
    }

    // picking end
    if (isBefore(day, fromDate)) {
      onChange?.({ from: ymd, to: from });
      setPicking('to');
      return;
    }

    onChange?.({ from, to: ymd });
    setPicking('from');
  };

  const dayState = (day) => {
    const inMonth = isSameMonth(day, viewMonth);
    const isFrom = fromDate && isSameDay(day, fromDate);
    const isTo = toDate && isSameDay(day, toDate);
    const inRange =
      fromDate &&
      toDate &&
      !isSameDay(fromDate, toDate) &&
      !isBefore(day, fromDate) &&
      !isAfter(day, toDate);
    return { inMonth, isFrom, isTo, inRange, today: isToday(day) };
  };

  const summary =
    fromDate && toDate
      ? isSameDay(fromDate, toDate)
        ? format(fromDate, 'd MMMM yyyy', { locale: ru })
        : `${format(fromDate, 'd MMM', { locale: ru })} — ${format(toDate, 'd MMM yyyy', { locale: ru })}`
      : fromDate
        ? format(fromDate, 'd MMMM yyyy', { locale: ru })
        : 'Выберите даты';

  return (
    <div className={`event-date-range ${className}`.trim()}>
      <div className="event-date-range__summary">
        <span>{summary}</span>
        <span className="event-date-range__hint">
          {picking === 'from' ? 'Начало' : 'Конец'}
        </span>
      </div>

      <div className="event-date-range__nav">
        <button
          type="button"
          className="event-date-range__nav-btn"
          onClick={() => goMonth(-1)}
          disabled={disabled}
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="event-date-range__month-title">
          {format(viewMonth, 'LLLL yyyy', { locale: ru })}
        </div>
        <button
          type="button"
          className="event-date-range__nav-btn"
          onClick={() => goMonth(1)}
          disabled={disabled}
          aria-label="Следующий месяц"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="event-date-range__weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="event-date-range__grid-wrap">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={format(viewMonth, 'yyyy-MM')}
            className="event-date-range__grid"
            custom={direction}
            initial={
              reduce
                ? false
                : { opacity: 0, x: direction >= 0 ? 28 : -28 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduce
                ? undefined
                : { opacity: 0, x: direction >= 0 ? -28 : 28 }
            }
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {days.map((day) => {
              const { inMonth, isFrom, isTo, inRange, today } = dayState(day);
              const classes = [
                'event-date-range__day',
                !inMonth && 'is-outside',
                today && 'is-today',
                inRange && 'is-in-range',
                (isFrom || isTo) && 'is-selected',
                isFrom && 'is-from',
                isTo && 'is-to',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={toYmd(day)}
                  type="button"
                  className={classes}
                  disabled={disabled || !inMonth}
                  onClick={() => onDayClick(day)}
                  aria-label={format(day, 'd MMMM yyyy', { locale: ru })}
                  aria-pressed={Boolean(isFrom || isTo)}
                >
                  <span>{format(day, 'd')}</span>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default EventDateRangePicker;
