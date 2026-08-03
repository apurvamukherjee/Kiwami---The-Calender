import * as chrono from "chrono-node";
import dayjs from "dayjs";
import { combineDateTime } from "./date.utils";

export interface ParsedNoteText {
  title: string;
  dueDate?: string; // ISO local datetime (see date.utils.ts), same shape as EventDto.startTime
  allDay: boolean;
  links: string[];
}

const URL_RE = /https?:\/\/[^\s]+/gi;

// Pure text -> {title, dueDate, allDay, links} extraction for the Notes
// composer's live preview. Date/time comes from chrono-node, which parses
// entirely offline (no network call) — matches Kiwami's 100%-local
// guarantee. Location is deliberately NOT extracted here: there's no
// reliable offline signal for "this word is a place" without a geocoding
// API call, so it stays a manual field in the composer instead of a guess
// that would misfire constantly.
export function parseNoteText(raw: string, referenceDate: Date = new Date()): ParsedNoteText {
  const links = raw.match(URL_RE) ?? [];

  const results = chrono.parse(raw, referenceDate);
  if (results.length === 0) {
    return { title: raw.trim(), allDay: false, links };
  }

  // First match only — a note describes one moment, not a recurring rule
  // ("every Monday" isn't expanded; see CLAUDE.md's Notes scope-outs).
  const result = results[0];
  const allDay = !result.start.isCertain("hour");
  const parsedDate = result.start.date();
  const dateKey = dayjs(parsedDate).format("YYYY-MM-DD");
  const timeKey = allDay ? "00:00" : dayjs(parsedDate).format("HH:mm");
  const dueDate = combineDateTime(dateKey, timeKey);

  // Strip only the matched date/time phrase out of the title — links stay
  // inline (stripping them would look like the composer silently deleted
  // part of what was typed).
  const title = (raw.slice(0, result.index) + raw.slice(result.index + result.text.length))
    .replace(/\s{2,}/g, " ")
    .trim();

  return { title: title || raw.trim(), dueDate, allDay, links };
}
