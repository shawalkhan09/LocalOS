import type { GymConfig } from "@localos/config-schema";
import { DateTime } from "luxon";
import { localTimeToInstant, localWeekday } from "./availability.js";
import { ApiError } from "./errors.js";
import { clientConfig } from "./config.js";

export interface BookableSessionTimeParams {
  service: GymConfig["services"][number];
  startTime: DateTime | Date;
  endTime: DateTime | Date;
  now?: DateTime;
}

export function assertBookableSessionTime(params: BookableSessionTimeParams): void {
  const { service, startTime, endTime, now } = params;
  const timezone = clientConfig.business.timezone;

  const start = startTime instanceof DateTime ? startTime.setZone(timezone) : DateTime.fromJSDate(startTime, { zone: 'utc' }).setZone(timezone);
  const end = endTime instanceof DateTime ? endTime.setZone(timezone) : DateTime.fromJSDate(endTime, { zone: 'utc' }).setZone(timezone);
  const currentTime = now ?? DateTime.now().setZone(timezone);

  // Rule 1: startTime is not in the past
  if (start < currentTime) {
    throw new ApiError(400, "That time has already passed. Please choose a later time.");
  }

  // Rule 2: startTime is not beyond the advance booking window
  const today = currentTime.startOf("day");
  const latestBookable = today.plus({ days: clientConfig.booking.advanceBookingDays });
  const startDay = start.startOf("day");
  if (startDay > latestBookable) {
    throw new ApiError(400, "That date is too far ahead to book.");
  }

  // Rule 3: startTime and endTime fall within business hours for that weekday
  const date = start.toISODate();
  if (!date) {
    throw new ApiError(400, "Invalid start time.");
  }
  const weekday = localWeekday(date, timezone);
  const hoursSlot = clientConfig.businessHours.find((slot) => slot.day === weekday);
  if (!hoursSlot) {
    throw new ApiError(400, "We are closed at that time.");
  }

  const openTime = localTimeToInstant(date, timezone, hoursSlot.openTime);
  const closeTime = localTimeToInstant(date, timezone, hoursSlot.closeTime);

  if (start < openTime || end > closeTime) {
    throw new ApiError(400, "We are closed at that time.");
  }

  // Rule 4: duration matches service.durationMinutes
  const durationMinutes = Math.round(end.diff(start, "minutes").minutes);
  if (durationMinutes !== service.durationMinutes) {
    throw new ApiError(400, "That booking length doesn't match the service.");
  }
}

export interface BookableClassOccurrenceParams {
  gymClass: GymConfig["classes"][number];
  occurrenceDate: string;
  now?: DateTime;
}

export function assertBookableClassOccurrence(params: BookableClassOccurrenceParams): void {
  const { gymClass, occurrenceDate, now } = params;
  const timezone = clientConfig.business.timezone;
  const currentTime = now ?? DateTime.now().setZone(timezone);

  // Rule 1: occurrenceDate is on a weekday the class runs
  const weekday = localWeekday(occurrenceDate, timezone);
  const scheduleForDay = gymClass.schedule.find((slot) => slot.day === weekday);
  if (!scheduleForDay) {
    throw new ApiError(400, "That class doesn't run on that day.");
  }

  // Rule 2: occurrenceDate is not before today and not beyond advance booking window
  const today = currentTime.startOf("day");
  const latestBookable = today.plus({ days: clientConfig.booking.advanceBookingDays });
  const occurrenceDayStart = DateTime.fromISO(occurrenceDate, { zone: timezone }).startOf("day");
  if (occurrenceDayStart < today || occurrenceDayStart > latestBookable) {
    throw new ApiError(400, "That date is not available to book.");
  }

  // Rule 3: the class start instant is not before now
  const classStartInstant = localTimeToInstant(occurrenceDate, timezone, scheduleForDay.startTime);
  if (classStartInstant < currentTime) {
    throw new ApiError(400, "That class has already started.");
  }
}
