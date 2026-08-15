import {
    SANCTUARY_DEFAULT_SECONDS,
    SANCTUARY_MAX_SECONDS,
    SANCTUARY_MIN_SECONDS,
    formatSanctuaryDuration,
    getSanctuaryRemainingSeconds,
    isSanctuarySessionActive,
    normalizeSanctuaryDuration,
    sanctuaryHoursMinutesToSeconds,
} from '../../shared/js/shared-utils/sanctuary';

describe('sanctuary helpers', () => {
    it('clamps duration to 5 hours and allows a saved 0:00', () => {
        expect(sanctuaryHoursMinutesToSeconds(1, 0)).toBe(SANCTUARY_DEFAULT_SECONDS);
        expect(sanctuaryHoursMinutesToSeconds(0, 0)).toBe(0);
        expect(sanctuaryHoursMinutesToSeconds(0, 1)).toBe(SANCTUARY_MIN_SECONDS);
        expect(sanctuaryHoursMinutesToSeconds(5, 0)).toBe(SANCTUARY_MAX_SECONDS);
        expect(sanctuaryHoursMinutesToSeconds(5, 1)).toBe(SANCTUARY_MAX_SECONDS);
        expect(sanctuaryHoursMinutesToSeconds(9, 59)).toBe(SANCTUARY_MAX_SECONDS);
        expect(normalizeSanctuaryDuration(18001)).toBe(SANCTUARY_MAX_SECONDS);
        expect(normalizeSanctuaryDuration(-12)).toBe(0);
        expect(formatSanctuaryDuration(0)).toBe('0 min');
        expect(formatSanctuaryDuration(60)).toBe('1 min');
        expect(formatSanctuaryDuration(3600)).toBe('1 hour');
        expect(formatSanctuaryDuration(3660)).toBe('1 hr 1 min');
        expect(formatSanctuaryDuration(18000)).toBe('5 hr');
    });

    it('treats a future endsAt as an active session', () => {
        const now = 1_700_000_000_000;
        expect(getSanctuaryRemainingSeconds(now + 1500, now)).toBe(2);
        expect(isSanctuarySessionActive(now + 1000, now)).toBeTrue();
        expect(isSanctuarySessionActive(now, now)).toBeFalse();
        expect(isSanctuarySessionActive(0, now)).toBeFalse();
    });
});
