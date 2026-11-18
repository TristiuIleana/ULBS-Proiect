/** A single half-open interval [startMs, endMs) in milliseconds-since-epoch. */
export interface BusyInterval {
  startMs: number;
  endMs: number;
}

/** Definition of one stage used by the algorithm (derived from ServiceStage). */
export interface StageTemplate {
  stageOrder: number;
  durationMinutes: number;
  isBusy: boolean;
}

/** A calculated slot: local ISO-string start time + its UTC epoch. */
export interface AvailableSlot {
  /** ISO-8601 in Europe/Bucharest, e.g. "2026-11-20T10:15:00+02:00" */
  localIso: string;
  /** UTC epoch ms – used internally and returned for the client for convenience */
  utcMs: number;
}

/** Query params for the availability endpoint. */
export interface AvailabilityQuery {
  serviceId: string;
  date: string; // "YYYY-MM-DD" in Europe/Bucharest
  specialistId: string;
}

/** Shift window in UTC epoch ms. */
export interface ShiftWindow {
  startMs: number;
  endMs: number;
}
