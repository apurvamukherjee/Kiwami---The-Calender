import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Mirrors src/db/types.ts / src/db/db.ts — Dexie is the source of truth and
// this schema exists so background sync has somewhere to push to later (no
// sync functions are wired yet; see the project spec's deferred list).
//
// `ownerId` is a device UUID for now (src/lib/deviceId.ts), not a real
// identity — every table keys off it instead of an auth-derived userId, so
// swapping in real auth later only changes what gets written into that
// field, not the shape of these tables.
export default defineSchema({
  events: defineTable({
    ownerId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.optional(v.string()),
    allDay: v.optional(v.boolean()),
    color: v.optional(v.string()),
    calendarId: v.optional(v.string()),
    location: v.optional(v.string()),
    isRoutine: v.optional(v.boolean()),
    isFoodSlot: v.optional(v.boolean()),
    streakCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  recurrenceRules: defineTable({
    eventId: v.id("events"),
    type: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("custom")),
    weekdays: v.optional(v.array(v.number())),
    dayOfMonth: v.optional(v.number()),
    interval: v.optional(v.number()),
    customUnit: v.optional(v.union(v.literal("day"), v.literal("week"))),
    endDate: v.optional(v.union(v.string(), v.null())),
    excludedDates: v.array(v.string()),
  }).index("by_event", ["eventId"]),

  occurrenceStatus: defineTable({
    eventId: v.id("events"),
    occurrenceDate: v.string(),
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("missed")),
    resolvedAt: v.optional(v.number()),
  }).index("by_event_date", ["eventId", "occurrenceDate"]),
});
