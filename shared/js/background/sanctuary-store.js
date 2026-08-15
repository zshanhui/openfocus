import settings from './settings';
import {
    getSanctuaryRemainingSeconds,
    isSanctuarySessionActive,
    normalizeSanctuaryDuration,
    SANCTUARY_DEFAULT_SECONDS,
} from '../shared-utils/sanctuary';

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * @typedef {object} SanctuarySettings
 * @property {number} durationSeconds
 * @property {boolean} showOnPopup
 * @property {number} endsAt
 */

/**
 * @returns {SanctuarySettings}
 */
export function getSanctuarySettings() {
    const duration = settings.getSetting('sanctuaryDurationSeconds');
    const endsAt = Number(settings.getSetting('sanctuaryEndsAt')) || 0;
    return {
        durationSeconds: duration == null ? SANCTUARY_DEFAULT_SECONDS : normalizeSanctuaryDuration(duration),
        showOnPopup: Boolean(settings.getSetting('sanctuaryShowOnPopup')),
        endsAt,
    };
}

/**
 * @param {{ durationSeconds?: unknown, showOnPopup?: unknown, endsAt?: unknown }} updates
 * @returns {SanctuarySettings}
 */
export function saveSanctuarySettings(updates = {}) {
    const current = getSanctuarySettings();
    const next = {
        durationSeconds: updates.durationSeconds == null ? current.durationSeconds : normalizeSanctuaryDuration(updates.durationSeconds),
        showOnPopup: updates.showOnPopup == null ? current.showOnPopup : Boolean(updates.showOnPopup),
        endsAt: updates.endsAt == null ? current.endsAt : Number(updates.endsAt) || 0,
    };
    settings.updateSetting('sanctuaryDurationSeconds', next.durationSeconds);
    settings.updateSetting('sanctuaryShowOnPopup', next.showOnPopup);
    settings.updateSetting('sanctuaryEndsAt', next.endsAt);
    return next;
}

/**
 * @param {number} [now]
 * @returns {boolean}
 */
export function isSanctuaryActive(now = Date.now()) {
    return isSanctuarySessionActive(getSanctuarySettings().endsAt, now);
}

/**
 * @param {number} [now]
 * @returns {number}
 */
export function getSanctuaryRemaining(now = Date.now()) {
    return getSanctuaryRemainingSeconds(getSanctuarySettings().endsAt, now);
}

export function clearSanctuarySession() {
    return saveSanctuarySettings({ endsAt: 0 });
}

/**
 * @returns {SanctuarySettings}
 */
export function cloneSanctuarySettings() {
    return clone(getSanctuarySettings());
}
