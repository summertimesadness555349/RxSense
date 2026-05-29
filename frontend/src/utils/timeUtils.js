// Bangla relative time + day label utilities for the symptom chat.

const BN_MONTHS = [
  'জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন',
  'জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর',
];

function hhmm(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

/** "এইমাত্র", "৫ মিনিট আগে", "গতকাল ১৪:৩০", "১২ মে ২০২৬" etc. */
export function relativeTime(isoString) {
  if (!isoString) return '';
  const now  = new Date();
  const then = new Date(isoString);
  const diffMs   = now - then;
  const diffSec  = Math.floor(diffMs / 1000);
  const diffMin  = Math.floor(diffSec  / 60);
  const diffHour = Math.floor(diffMin  / 60);
  const diffDay  = Math.floor(diffHour / 24);

  if (diffSec  <  60) return 'এইমাত্র';
  if (diffMin  <  60) return `${diffMin} মিনিট আগে`;
  if (diffHour <  24) return `${diffHour} ঘণ্টা আগে`;
  if (diffDay  ===  1) return `গতকাল ${hhmm(then)}`;
  if (diffDay  <    7) return `${diffDay} দিন আগে, ${hhmm(then)}`;
  return `${then.getDate()} ${BN_MONTHS[then.getMonth()]} ${then.getFullYear()}`;
}

/** Label for the day-separator line: "আজ", "গতকাল", "১২ মে ২০২৬" */
export function dayLabel(isoString) {
  if (!isoString) return '';
  const now  = new Date();
  const then = new Date(isoString);

  if (isSameDay(now, then)) return 'আজ';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(yesterday, then)) return 'গতকাল';

  return `${then.getDate()} ${BN_MONTHS[then.getMonth()]} ${then.getFullYear()}`;
}

/** Returns true when msg and prevMsg are from different calendar days. */
export function needsDaySeparator(isoString, prevIsoString) {
  if (!prevIsoString) return false;
  const a = new Date(isoString);
  const b = new Date(prevIsoString);
  return !isSameDay(a, b);
}
