import { describe, it, expect } from "vitest";
import { parseNoteText } from "./parseNoteText";

// Reference date fixed so "tomorrow"/"next friday"-style relative phrases
// resolve deterministically. 2024-01-01 is a Monday.
const REF = new Date("2024-01-01T09:00:00");

describe("parseNoteText", () => {
  it("extracts a dated + timed phrase and strips it from the title", () => {
    const r = parseNoteText("Call mom tomorrow at 5pm", REF);
    expect(r.title).toBe("Call mom");
    expect(r.allDay).toBe(false);
    expect(r.dueDate).toBe("2024-01-02T17:00:00");
  });

  it("marks allDay when only a date is recognized, no time", () => {
    const r = parseNoteText("Pay rent on Jan 5", REF);
    expect(r.allDay).toBe(true);
    expect(r.dueDate).toBe("2024-01-05T00:00:00");
    expect(r.title).toBe("Pay rent on");
  });

  it("leaves the title untouched and dueDate unset when nothing is recognized", () => {
    const r = parseNoteText("Buy milk", REF);
    expect(r.title).toBe("Buy milk");
    expect(r.dueDate).toBeUndefined();
    expect(r.allDay).toBe(false);
  });

  it("extracts links without stripping them from the title", () => {
    const r = parseNoteText("Check https://example.com tomorrow", REF);
    expect(r.links).toEqual(["https://example.com"]);
    expect(r.title).toBe("Check https://example.com");
    expect(r.dueDate).toBe("2024-01-02T00:00:00");
  });

  it("falls back to the raw text as the title when stripping the date leaves nothing", () => {
    const r = parseNoteText("tomorrow 5pm", REF);
    expect(r.title).toBe("tomorrow 5pm");
    expect(r.dueDate).toBe("2024-01-02T17:00:00");
  });
});
