const TIMEZONE = "Asia/Jakarta";
const MAX_PER_DAY = 1000;

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Tanggal bisnis hari ini (YYYY-MM-DD) berdasarkan Asia/Jakarta. */
export function todayBizDate(): string {
  return fmt.format(new Date());
}

export function prefixForLoket(loket: number): string {
  return loket === 1 ? "A" : "B";
}

export function codeFor(loket: number, number: number): string {
  const prefix = prefixForLoket(loket);
  return `${prefix}${String(number).padStart(3, "0")}`;
}

export function maxPerDay(): number {
  return MAX_PER_DAY;
}

export function assertLoket(loket: unknown): asserts loket is 1 | 2 {
  if (loket !== 1 && loket !== 2) throw new Error("LOKET_INVALID");
}
