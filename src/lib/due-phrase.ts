import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  startOfDay,
  startOfMonth,
} from "date-fns";

import { localDateAndTimeToIso, localDateToDueValue } from "@/lib/tasks";

/**
 * A due date read out of a task name as it is typed: "Call mum tmr", "Pay rent
 * by friday", "Dentist sep 12 at 3pm". The match says where the words sit so
 * the field can draw a box around them, and `dueAt` is what those words mean
 * in the app's own due encoding (a `yyyy-MM-dd` day, or an ISO instant when a
 * time was given).
 */
export interface DuePhraseMatch {
  /** Offsets into the title, `end` exclusive; the box is drawn between them. */
  start: number;
  end: number;
  /** The matched words exactly as typed, for telling one phrase from another. */
  text: string;
  dueAt: string;
}

/* One of these per way of saying a day. The regex runs over the whole name
   with the `i` flag (rather than over a lowercased copy, whose offsets can
   differ), and `resolve` turns the captures into a local calendar day. Words
   short enough to be something else -- "sat", "mon", "sun" -- are `endOnly`:
   they count only as the last thing typed, which is where a date goes. */
interface DayPattern {
  regex: RegExp;
  endOnly?: (match: RegExpExecArray) => boolean;
  resolve: (match: RegExpExecArray, today: Date) => Date | null;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tues: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thurs: 4, thur: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sept: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const COUNTS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

// Longest first, so "thursday" is not read as "thu" plus "rsday".
const WEEKDAY_WORDS = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join("|");
const MONTH_WORDS = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const COUNT_WORDS = Object.keys(COUNTS).join("|");

// Letters and digits on either side end a word; an apostrophe does not, so
// "tmr's" is not a date.
const BEFORE = String.raw`(?<![\p{L}\p{N}'’])`;
const AFTER = String.raw`(?![\p{L}\p{N}'’])`;

function pattern(source: string): RegExp {
  return new RegExp(`${BEFORE}(?:${source})${AFTER}`, "giu");
}

/** The coming such weekday, never today: "monday" on a Monday is a week off. */
function nextWeekday(today: Date, weekday: number): Date {
  const ahead = (weekday - today.getDay() + 7) % 7 || 7;
  return addDays(today, ahead);
}

function localDay(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day);
  return date.getMonth() === month && date.getDate() === day ? date : null;
}

/** A month and day with no year mean the next time that date comes round. */
function upcomingMonthDay(today: Date, month: number, day: number, year?: number): Date | null {
  if (year !== undefined) return localDay(year, month, day);
  const thisYear = localDay(today.getFullYear(), month, day);
  if (thisYear && thisYear >= today) return thisYear;
  // Feb 29 in a common year: wait for the next leap year rather than give up.
  for (let offset = 1; offset <= 8; offset += 1) {
    const candidate = localDay(today.getFullYear() + offset, month, day);
    if (candidate) return candidate;
  }
  return null;
}

/** "the 15th": this month if still ahead, else the next month that has one. */
function upcomingDayOfMonth(today: Date, day: number): Date | null {
  for (let offset = 0; offset <= 12; offset += 1) {
    const month = addMonths(startOfMonth(today), offset);
    const candidate = localDay(month.getFullYear(), month.getMonth(), day);
    if (candidate && candidate >= today) return candidate;
  }
  return null;
}

const DAY_PATTERNS: DayPattern[] = [
  {
    regex: pattern(String.raw`today|tonight`),
    resolve: (_, today) => today,
  },
  {
    // "tmr", "tmrw" and "tmw" are nobody's name, so they can sit anywhere;
    // "tom" is left out on purpose.
    regex: pattern(String.raw`day\s+after\s+(?:tomm?orr?ow|tmrw|tmr|tmw)|tomm?orr?ow|tmrw|tmr|tmw`),
    resolve: (match, today) => addDays(today, /^day/i.test(match[0]) ? 2 : 1),
  },
  {
    regex: pattern(String.raw`(?:(this|next|coming)\s+)?(${WEEKDAY_WORDS})`),
    endOnly: (match) => match[1] === undefined && match[2].length <= 5,
    resolve: (match, today) => nextWeekday(today, WEEKDAYS[match[2].toLowerCase()]),
  },
  {
    regex: pattern(String.raw`(this|next)\s+weekend`),
    resolve: (match, today) => {
      const saturday = nextWeekday(today, 6);
      return match[1].toLowerCase() === "next" ? addWeeks(saturday, 1) : saturday;
    },
  },
  {
    regex: pattern(String.raw`next\s+(week|month|year)`),
    resolve: (match, today) => {
      switch (match[1].toLowerCase()) {
        case "week":
          return nextWeekday(today, 1);
        case "month":
          return startOfMonth(addMonths(today, 1));
        default:
          return new Date(today.getFullYear() + 1, 0, 1);
      }
    },
  },
  {
    regex: pattern(String.raw`in\s+(\d{1,3}|${COUNT_WORDS})\s+(days?|weeks?|months?|years?)`),
    resolve: (match, today) => {
      const count = COUNTS[match[1].toLowerCase()] ?? Number(match[1]);
      if (count < 1) return null;
      switch (match[2].toLowerCase().replace(/s$/, "")) {
        case "day":
          return addDays(today, count);
        case "week":
          return addWeeks(today, count);
        case "month":
          return addMonths(today, count);
        default:
          return addYears(today, count);
      }
    },
  },
  {
    // "sep 12", "september 12th, 2027"
    regex: pattern(String.raw`(${MONTH_WORDS})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?`),
    resolve: (match, today) =>
      upcomingMonthDay(
        today,
        MONTHS[match[1].toLowerCase()],
        Number(match[2]),
        match[3] ? Number(match[3]) : undefined,
      ),
  },
  {
    // "12 sep", "12th of september 2027"
    regex: pattern(String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(${MONTH_WORDS})\.?(?:,?\s+(\d{4}))?`),
    resolve: (match, today) =>
      upcomingMonthDay(
        today,
        MONTHS[match[2].toLowerCase()],
        Number(match[1]),
        match[3] ? Number(match[3]) : undefined,
      ),
  },
  {
    regex: pattern(String.raw`(\d{4})-(\d{2})-(\d{2})`),
    resolve: (match) => localDay(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  },
  {
    // "the 15th": a bare ordinal is too often a floor or a place in a queue.
    regex: pattern(String.raw`the\s+(\d{1,2})(?:st|nd|rd|th)`),
    resolve: (match, today) => upcomingDayOfMonth(today, Number(match[1])),
  },
];

// "3pm", "3:30 pm", "15:00", "noon". A bare hour ("at 5") is left alone: five
// in the morning and five in the afternoon are both plausible.
const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?|(\d{1,2}):(\d{2})|noon|midday`;
const TIME_AFTER_DAY = new RegExp(String.raw`(?:,?\s+(?:at|@)\s*|,?\s+)(?:${TIME})${AFTER}`, "iuy");
// "at 3pm" anywhere; a bare "3pm" only as the last thing typed.
const TIME_ALONE = pattern(String.raw`(?:(at|@)\s*)?(?:${TIME})`);
const LEADING_WORD = /(^|\s)(?:on|by|due)\s+$/iu;

/** The 24-hour "HH:mm" a time match means, or null for an impossible one. */
function timeOfDay(match: RegExpExecArray, offset: number): string | null {
  const [hour12, minute12, meridiem, hour24, minute24] = match.slice(offset, offset + 5);
  let hours: number;
  let minutes: number;

  if (meridiem) {
    hours = Number(hour12);
    minutes = Number(minute12 ?? "0");
    if (hours < 1 || hours > 12) return null;
    if (meridiem.toLowerCase() === "p" && hours < 12) hours += 12;
    if (meridiem.toLowerCase() === "a" && hours === 12) hours = 0;
  } else if (hour24) {
    hours = Number(hour24);
    minutes = Number(minute24);
    if (hours > 23) return null;
  } else {
    hours = 12;
    minutes = 0;
  }

  if (minutes > 59) return null;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}`;
}

interface Candidate {
  start: number;
  end: number;
  day: Date;
  time: string | null;
}

function isAtEnd(text: string, end: number): boolean {
  return text.slice(end).trim() === "";
}

/**
 * Reads the due date out of a task name, if it holds one. The last date in the
 * name wins -- that is where a date is written -- and the match reaches back
 * over an "on", "by" or "due" in front of it, so "Pay rent by friday" gives
 * "Pay rent". A name that is only a date is not a match: there would be
 * nothing left to call the task.
 */
export function parseDuePhrase(text: string, now = new Date()): DuePhraseMatch | null {
  const today = startOfDay(now);
  let best: Candidate | null = null;

  // The phrase reaching furthest right wins, and of two ending together the
  // longer: "tmr at 3pm" is one phrase, not the "at 3pm" inside it.
  const consider = (candidate: Candidate) => {
    if (
      !best ||
      candidate.end > best.end ||
      (candidate.end === best.end && candidate.start < best.start)
    )
      best = candidate;
  };

  for (const { regex, endOnly, resolve } of DAY_PATTERNS) {
    regex.lastIndex = 0;
    for (let match = regex.exec(text); match; match = regex.exec(text)) {
      const day = resolve(match, today);
      if (!day) continue;

      let end = match.index + match[0].length;
      let time: string | null = null;
      TIME_AFTER_DAY.lastIndex = end;
      const timeMatch = TIME_AFTER_DAY.exec(text);
      if (timeMatch) {
        time = timeOfDay(timeMatch, 1);
        if (time) end += timeMatch[0].length;
      }

      if (endOnly?.(match) && !isAtEnd(text, end)) continue;
      consider({ start: match.index, end, day, time });
    }
  }

  // A time on its own means today, or tomorrow once today's has gone by.
  TIME_ALONE.lastIndex = 0;
  for (let match = TIME_ALONE.exec(text); match; match = TIME_ALONE.exec(text)) {
    const time = timeOfDay(match, 2);
    if (!time) continue;
    if (match[1] === undefined && !isAtEnd(text, match.index + match[0].length)) continue;
    const [hours, minutes] = time.split(":").map(Number);
    const at = new Date(today);
    at.setHours(hours, minutes, 0, 0);
    consider({
      start: match.index,
      end: match.index + match[0].length,
      day: at <= now ? addDays(today, 1) : today,
      time,
    });
  }

  if (!best) return null;
  const { start: matchStart, end, day, time } = best as Candidate;

  const leading = LEADING_WORD.exec(text.slice(0, matchStart));
  const start = leading ? leading.index + leading[1].length : matchStart;

  const dueAt = time ? localDateAndTimeToIso(day, time) : localDateToDueValue(day);
  if (!dueAt) return null;

  const match = { start, end, text: text.slice(start, end), dueAt };
  return removeDuePhrase(text, match) ? match : null;
}

/** The name with the phrase taken out and the gap closed, for saving. */
export function removeDuePhrase(text: string, match: Pick<DuePhraseMatch, "start" | "end">): string {
  let before = text.slice(0, match.start);
  const after = text.slice(match.end);
  // "Buy milk, tmr" should not leave the comma behind.
  if (after.trim() === "") before = before.replace(/[\s,;:\-–—]+$/u, "");
  return `${before} ${after}`.replace(/\s+/gu, " ").trim();
}
