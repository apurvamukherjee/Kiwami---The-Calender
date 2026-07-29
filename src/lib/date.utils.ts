import dayjs from "dayjs";

export function todayKey(d: Date = new Date()): string {
  return dayjs(d).format("YYYY-MM-DD");
}

// Local (no-timezone-suffix) ISO datetime — this is a single-device local-first
// app, so a plain "YYYY-MM-DDTHH:mm:00" that dayjs/Date parse as local time is
// simpler and sufficient; no UTC conversion needed anywhere.
export function combineDateTime(date: string, time: string): string {
  return `${date}T${time}:00`;
}
