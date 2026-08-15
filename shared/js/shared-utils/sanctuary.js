import { secondsToHoursMinutes } from './site-groups';

export const SANCTUARY_MIN_SECONDS = 60;
export const SANCTUARY_MAX_SECONDS = 5 * 60 * 60;
export const SANCTUARY_DEFAULT_SECONDS = 60 * 60;
export const ALARM_SANCTUARY_EXPIRY = 'sanctuary-expiry';

/**
 * @param {unknown} hours
 * @param {unknown} minutes
 * @returns {number}
 */
export function sanctuaryHoursMinutesToSeconds(hours, minutes) {
    let h = Math.max(0, Math.min(5, Math.floor(Number(hours) || 0)));
    let m = Math.max(0, Math.min(59, Math.floor(Number(minutes) || 0)));
    if (h >= 5) {
        h = 5;
        m = 0;
    }
    return Math.min(SANCTUARY_MAX_SECONDS, h * 3600 + m * 60);
}

/**
 * @param {unknown} seconds
 * @returns {number}
 */
export function normalizeSanctuaryDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return Math.min(SANCTUARY_MAX_SECONDS, total);
}

/**
 * @param {unknown} endsAt
 * @param {number} [now]
 * @returns {number}
 */
export function getSanctuaryRemainingSeconds(endsAt, now = Date.now()) {
    const end = Number(endsAt);
    if (!Number.isFinite(end) || end <= 0) {
        return 0;
    }
    return Math.max(0, Math.ceil((end - now) / 1000));
}

/**
 * @param {unknown} endsAt
 * @param {number} [now]
 * @returns {boolean}
 */
export function isSanctuarySessionActive(endsAt, now = Date.now()) {
    return getSanctuaryRemainingSeconds(endsAt, now) > 0;
}

/**
 * @param {number} seconds
 * @returns {string}
 */
export function formatSanctuaryDuration(seconds) {
    const { hours, minutes } = secondsToHoursMinutes(normalizeSanctuaryDuration(seconds));
    if (hours && minutes) {
        return `${hours} hr ${minutes} min`;
    }
    if (hours) {
        return hours === 1 ? '1 hour' : `${hours} hr`;
    }
    if (minutes) {
        return minutes === 1 ? '1 min' : `${minutes} min`;
    }
    return '0 min';
}
