import settings from '../../shared/js/background/settings';
import Sanctuary from '../../shared/js/background/components/sanctuary';
import AllowedSites from '../../shared/js/background/components/allowed-sites';
import SiteGroups from '../../shared/js/background/components/site-groups';
import { refreshSanctuaryRules } from '../../shared/js/background/dnr-sanctuary';
import { getAllowedSites } from '../../shared/js/background/allowed-sites-store';
import { getSiteGroups } from '../../shared/js/background/site-groups-store';
import { ALWAYS_BLOCK_GROUP_ID, DEFAULT_GROUP_ID, DEFAULT_GROUP_MAX_SECONDS } from '../../shared/js/shared-utils/site-groups';
import {
    SANCTUARY_ALLOW_RULE_ID_START,
    SANCTUARY_BLOCK_MAIN_RULE_ID,
    SANCTUARY_BLOCK_SUBRESOURCE_RULE_ID,
    getMatchDetails,
} from '../../shared/js/background/dnr-utils';
import { SANCTUARY_ALLOW_PRIORITY, SANCTUARY_BLOCK_PRIORITY } from '@duckduckgo/ddg2dnr/lib/rulePriorities';
import { ALARM_SANCTUARY_EXPIRY } from '../../shared/js/shared-utils/sanctuary';

function mockSettings(initial = {}) {
    const settingsStorage = new Map(Object.entries(initial));
    spyOn(settings, 'ready').and.returnValue(Promise.resolve());
    spyOn(settings, 'getSetting').and.callFake((name) => settingsStorage.get(name));
    spyOn(settings, 'updateSetting').and.callFake((name, value) => {
        settingsStorage.set(name, value);
    });
    return settingsStorage;
}

function lastAddedRules(spy) {
    const calls = spy.calls.allArgs();
    return calls[calls.length - 1]?.[0]?.addRules || [];
}

describe('sanctuary DNR rules', () => {
    let updateDynamicRules;

    beforeEach(() => {
        mockSettings();
        updateDynamicRules = spyOn(chrome.declarativeNetRequest, 'updateDynamicRules').and.resolveTo();
        spyOn(chrome.declarativeNetRequest, 'isRegexSupported').and.resolveTo({ isSupported: true });
    });

    it('installs a main-frame catch-all plus requestDomain and regex allows', async () => {
        await refreshSanctuaryRules(['khanacademy.org', '*.youtube.com', '*.edu', '*docs*']);
        const rules = lastAddedRules(updateDynamicRules);
        const main = rules.find((rule) => rule.id === SANCTUARY_BLOCK_MAIN_RULE_ID);
        const sub = rules.find((rule) => rule.id === SANCTUARY_BLOCK_SUBRESOURCE_RULE_ID);
        const allowByDomain = rules.find((rule) => rule.condition.requestDomains);
        const regexAllows = rules.filter((rule) => rule.action.type === 'allow' && rule.condition.regexFilter);

        expect(main.priority).toBe(SANCTUARY_BLOCK_PRIORITY);
        expect(main.action).toEqual({
            type: 'redirect',
            redirect: { extensionPath: '/html/blocked.html' },
        });
        expect(main.condition.regexFilter).toBe('^https?://');
        expect(main.condition.resourceTypes).toEqual(['main_frame']);
        expect(sub).toBeUndefined();

        expect(allowByDomain.id).toBe(SANCTUARY_ALLOW_RULE_ID_START);
        expect(allowByDomain.priority).toBe(SANCTUARY_ALLOW_PRIORITY);
        expect(allowByDomain.action.type).toBe('allow');
        expect(allowByDomain.condition.requestDomains).toEqual(['khanacademy.org', 'youtube.com']);
        expect(allowByDomain.condition.resourceTypes).toEqual(['main_frame']);

        expect(regexAllows.map((rule) => rule.condition.regexFilter)).toEqual([
            '^https?://([^/?#:@]*@)?[^/?#]*\\.edu(:[0-9]+)?([/?#]|$)',
            '^https?://([^/?#:@]*@)?[^/?#]*docs[^/?#]*(:[0-9]+)?([/?#]|$)',
        ]);
        expect(await getMatchDetails(SANCTUARY_BLOCK_MAIN_RULE_ID)).toEqual({ type: 'sanctuaryBlock' });
        expect(await getMatchDetails(SANCTUARY_ALLOW_RULE_ID_START)).toEqual({ type: 'sanctuaryAllow' });
    });
});

describe('sanctuary session', () => {
    let settingsStorage;
    let sanctuary;
    let allowedSites;
    let updateDynamicRules;
    let tabsUpdate;

    beforeEach(async () => {
        settingsStorage = mockSettings({
            allowedSites: ['khanacademy.org'],
            sanctuaryDurationSeconds: 3600,
            sanctuaryShowOnPopup: true,
            sanctuaryEndsAt: 0,
            siteGroupsInitialized: true,
            siteGroups: [
                { id: DEFAULT_GROUP_ID, name: 'Default', maxSecondsPerDay: DEFAULT_GROUP_MAX_SECONDS, domains: [] },
                { id: ALWAYS_BLOCK_GROUP_ID, name: 'Always Block', maxSecondsPerDay: 0, domains: [] },
            ],
        });
        updateDynamicRules = spyOn(chrome.declarativeNetRequest, 'updateDynamicRules').and.resolveTo();
        spyOn(chrome.declarativeNetRequest, 'isRegexSupported').and.resolveTo({ isSupported: true });
        spyOn(chrome.alarms, 'create').and.resolveTo();
        spyOn(chrome.alarms, 'clear').and.resolveTo();
        spyOn(chrome.tabs, 'query').and.resolveTo([
            { id: 1, url: 'https://youtube.com/watch' },
            { id: 2, url: 'https://khanacademy.org/math' },
            { id: 3, url: 'chrome://newtab/' },
        ]);
        spyOn(chrome.tabs, 'get').and.callFake((tabId) =>
            Promise.resolve(
                [
                    { id: 1, url: 'https://youtube.com/watch' },
                    { id: 2, url: 'https://khanacademy.org/math' },
                    { id: 3, url: 'chrome://newtab/' },
                ].find((tab) => tab.id === tabId) || null,
            ),
        );
        tabsUpdate = spyOn(chrome.tabs, 'update').and.resolveTo();

        allowedSites = new AllowedSites({ settings });
        sanctuary = new Sanctuary({ settings });
        await Promise.all([allowedSites._ready, sanctuary._ready]);
    });

    it('activates a lock, redirects open tabs, and expires it', async () => {
        const idle = await sanctuary.handleGet();
        expect(idle.active).toBeFalse();
        expect(idle.canActivate).toBeTrue();
        expect(idle.showOnPopup).toBeTrue();

        const started = await sanctuary.handleActivate();
        expect(started.saved).toBeTrue();
        expect(started.active).toBeTrue();
        expect(started.locked).toBeTrue();
        expect(started.remainingSeconds).toBeGreaterThan(3500);
        expect(settingsStorage.get('sanctuaryEndsAt')).toBeGreaterThan(Date.now());
        expect(chrome.alarms.create).toHaveBeenCalledWith(ALARM_SANCTUARY_EXPIRY, {
            when: settingsStorage.get('sanctuaryEndsAt'),
        });
        expect(lastAddedRules(updateDynamicRules).some((rule) => rule.id === SANCTUARY_BLOCK_MAIN_RULE_ID)).toBeTrue();
        expect(tabsUpdate).toHaveBeenCalledWith(1, { url: jasmine.stringMatching(/blocked\.html/) });
        expect(tabsUpdate.calls.allArgs().some((args) => args[0] === 2)).toBeFalse();
        expect(tabsUpdate.calls.allArgs().some((args) => args[0] === 3)).toBeFalse();

        const lockedAdd = await allowedSites.handleAdd({ text: 'docs.google.com' });
        expect(lockedAdd.locked).toBeTrue();
        expect(getAllowedSites()).toEqual(['khanacademy.org']);

        const lockedSettings = await sanctuary.handleUpdate({ durationSeconds: 120, showOnPopup: false });
        expect(lockedSettings.locked).toBeTrue();
        expect(settingsStorage.get('sanctuaryDurationSeconds')).toBe(3600);
        expect(settingsStorage.get('sanctuaryShowOnPopup')).toBeTrue();

        const again = await sanctuary.handleActivate();
        expect(again.saved).toBeFalse();
        expect(again.cannotActivateReason).toBe('active');

        settingsStorage.set('sanctuaryEndsAt', Date.now() - 1000);
        const expired = await sanctuary.handleGet();
        expect(expired.active).toBeFalse();
        expect(expired.locked).toBeFalse();
        expect(settingsStorage.get('sanctuaryEndsAt')).toBe(0);
        expect(chrome.alarms.clear).toHaveBeenCalledWith(ALARM_SANCTUARY_EXPIRY);
    });

    it('refuses to start without allowed sites or a duration of at least 1 minute', async () => {
        settingsStorage.set('allowedSites', []);
        const empty = await sanctuary.handleActivate();
        expect(empty.saved).toBeFalse();
        expect(empty.cannotActivateReason).toBe('empty');
        expect(empty.active).toBeFalse();

        settingsStorage.set('allowedSites', ['khanacademy.org']);
        settingsStorage.set('sanctuaryDurationSeconds', 0);
        const noTime = await sanctuary.handleActivate();
        expect(noTime.saved).toBeFalse();
        expect(noTime.cannotActivateReason).toBe('duration');
    });
});

describe('sanctuary lock around allowed and grouped sites', () => {
    let allowedSites;
    let siteGroups;

    beforeEach(async () => {
        mockSettings({
            allowedSites: ['*.youtube.com', 'khanacademy.org'],
            sanctuaryDurationSeconds: 3600,
            sanctuaryShowOnPopup: false,
            sanctuaryEndsAt: Date.now() + 60_000,
            siteGroupsInitialized: true,
            siteGroups: [
                { id: DEFAULT_GROUP_ID, name: 'Default', maxSecondsPerDay: DEFAULT_GROUP_MAX_SECONDS, domains: [] },
                { id: ALWAYS_BLOCK_GROUP_ID, name: 'Always Block', maxSecondsPerDay: 0, domains: [] },
            ],
            groupUsage: {},
        });
        spyOn(chrome.declarativeNetRequest, 'updateDynamicRules').and.resolveTo();
        allowedSites = new AllowedSites({ settings });
        siteGroups = new SiteGroups({ settings });
        await Promise.all([allowedSites._ready, siteGroups._ready]);
    });

    it('blocks allowed-list edits and overlapping group adds while Sanctuary is on', async () => {
        const add = await allowedSites.handleAdd({ text: 'docs.google.com' });
        expect(add.locked).toBeTrue();
        expect(getAllowedSites()).toEqual(['*.youtube.com', 'khanacademy.org']);

        const remove = await allowedSites.handleRemove({ pattern: 'khanacademy.org' });
        expect(remove.locked).toBeTrue();
        expect(getAllowedSites()).toEqual(['*.youtube.com', 'khanacademy.org']);

        const cleared = await allowedSites.handleClear();
        expect(cleared.locked).toBeTrue();
        expect(getAllowedSites()).toEqual(['*.youtube.com', 'khanacademy.org']);

        const grouped = await siteGroups.handleAddDomain({
            groupId: ALWAYS_BLOCK_GROUP_ID,
            domain: 'youtube.com',
            replaceAllowed: true,
        });
        expect(grouped.sanctuaryLocked).toBeTrue();
        expect(getAllowedSites()).toEqual(['*.youtube.com', 'khanacademy.org']);
        expect(getSiteGroups().find((group) => group.id === ALWAYS_BLOCK_GROUP_ID).domains).toEqual([]);
    });
});
