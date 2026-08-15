import settings from '../../shared/js/background/settings';
import AllowedSites from '../../shared/js/background/components/allowed-sites';
import SiteGroups from '../../shared/js/background/components/site-groups';
import { getAllowedSites } from '../../shared/js/background/allowed-sites-store';
import { getSiteGroups } from '../../shared/js/background/site-groups-store';
import { ALWAYS_BLOCK_GROUP_ID, DEFAULT_GROUP_ID, DEFAULT_GROUP_MAX_SECONDS } from '../../shared/js/shared-utils/site-groups';

function mockSettings(initial = {}) {
    const settingsStorage = new Map(Object.entries(initial));
    spyOn(settings, 'ready').and.returnValue(Promise.resolve());
    spyOn(settings, 'getSetting').and.callFake((name) => settingsStorage.get(name));
    spyOn(settings, 'updateSetting').and.callFake((name, value) => {
        settingsStorage.set(name, value);
    });
    return settingsStorage;
}

describe('allowed sites store', () => {
    let allowedSites;

    beforeEach(async () => {
        mockSettings({
            allowedSites: [],
            siteGroupsInitialized: true,
            siteGroups: [
                { id: DEFAULT_GROUP_ID, name: 'Default', maxSecondsPerDay: DEFAULT_GROUP_MAX_SECONDS, domains: [] },
                { id: ALWAYS_BLOCK_GROUP_ID, name: 'Always Block', maxSecondsPerDay: 0, domains: ['youtube.com'] },
            ],
        });
        allowedSites = new AllowedSites({ settings });
        await allowedSites._ready;
    });

    it('adds valid sites, skips duplicates, and reports conflicts and broad patterns', async () => {
        const first = await allowedSites.handleAdd({
            text: 'khanacademy.org\n*.youtube.com\n*.com',
        });
        expect(first.added).toEqual(['khanacademy.org']);
        expect(first.errors).toEqual([
            { line: '*.com', reason: 'tooBroad' },
            { line: '*.youtube.com', reason: 'conflict', domain: 'youtube.com', groupName: 'Always Block' },
        ]);
        expect(getAllowedSites()).toEqual(['khanacademy.org']);

        const duplicate = await allowedSites.handleAdd({ text: 'https://khanacademy.org/math' });
        expect(duplicate.added).toEqual([]);
        expect(duplicate.errors).toEqual([]);
        expect(duplicate.saved).toBeTrue();
        expect(getAllowedSites()).toEqual(['khanacademy.org']);
    });

    it('removes one site and clears the list', async () => {
        await allowedSites.handleAdd({ text: 'khanacademy.org\ndocs.google.com' });
        expect(getAllowedSites()).toEqual(['docs.google.com', 'khanacademy.org']);

        await allowedSites.handleRemove({ pattern: 'khanacademy.org' });
        expect(getAllowedSites()).toEqual(['docs.google.com']);

        await allowedSites.handleClear();
        expect(getAllowedSites()).toEqual([]);
    });
});

describe('adding a grouped site that is already allowed', () => {
    let siteGroups;

    beforeEach(async () => {
        mockSettings({
            allowedSites: ['*.youtube.com', 'khanacademy.org'],
            siteGroupsInitialized: true,
            siteGroups: [
                { id: DEFAULT_GROUP_ID, name: 'Default', maxSecondsPerDay: DEFAULT_GROUP_MAX_SECONDS, domains: [] },
                { id: ALWAYS_BLOCK_GROUP_ID, name: 'Always Block', maxSecondsPerDay: 0, domains: [] },
            ],
            groupUsage: {},
        });
        siteGroups = new SiteGroups({ settings });
        await siteGroups._ready;
    });

    it('asks before removing overlapping allowed entries, then moves the site on confirm', async () => {
        const preview = await siteGroups.handleAddDomain({
            groupId: ALWAYS_BLOCK_GROUP_ID,
            domain: 'youtube.com',
        });
        expect(preview.saved).toBeFalse();
        expect(preview.needsAllowedConfirm).toBeTrue();
        expect(preview.overlappingAllowed).toEqual(['*.youtube.com']);
        expect(getAllowedSites()).toEqual(['*.youtube.com', 'khanacademy.org']);
        expect(getSiteGroups().find((group) => group.id === ALWAYS_BLOCK_GROUP_ID).domains).toEqual([]);

        const confirmed = await siteGroups.handleAddDomain({
            groupId: ALWAYS_BLOCK_GROUP_ID,
            domain: 'youtube.com',
            replaceAllowed: true,
        });
        expect(confirmed.saved).toBeTrue();
        expect(getAllowedSites()).toEqual(['khanacademy.org']);
        expect(getSiteGroups().find((group) => group.id === ALWAYS_BLOCK_GROUP_ID).domains).toEqual(['youtube.com']);
    });
});
