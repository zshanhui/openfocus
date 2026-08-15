import settings from '../../shared/js/background/settings';
import SiteGroups from '../../shared/js/background/components/site-groups';
import AllowedSites from '../../shared/js/background/components/allowed-sites';
import {
    refreshAdultGamblingEnforcement,
    setAdultGamblingBlockEnabled,
    shouldRedirectCategoryNavigation,
} from '../../shared/js/background/dnr-category-blocklist';
import { getAllowedSites } from '../../shared/js/background/allowed-sites-store';
import {
    CATEGORY_ALLOW_RULE_ID_END,
    CATEGORY_ALLOW_RULE_ID_START,
    CATEGORY_REDIRECT_RULE_ID_END,
    CATEGORY_REDIRECT_RULE_ID_START,
    getMatchDetails,
} from '../../shared/js/background/dnr-utils';
import { CATEGORY_BLOCKLIST_ALLOW_PRIORITY, USER_BLOCKED_SITES_PRIORITY } from '@duckduckgo/ddg2dnr/lib/rulePriorities';
import { resourceTypes } from '@duckduckgo/ddg2dnr/lib/utils';
import { ADULT_GAMBLING_RULESET_ID } from '../../shared/js/shared-utils/category-dnr-ruleset';
import { ALWAYS_BLOCK_GROUP_ID, DEFAULT_GROUP_ID, DEFAULT_GROUP_MAX_SECONDS } from '../../shared/js/shared-utils/site-groups';

const BUNDLED_RULES = [
    {
        id: 1,
        priority: USER_BLOCKED_SITES_PRIORITY,
        action: { type: 'redirect', redirect: { extensionPath: '/html/blocked.html' } },
        condition: { requestDomains: ['pornhub.com'], resourceTypes: ['main_frame'] },
    },
    {
        id: 2,
        priority: USER_BLOCKED_SITES_PRIORITY,
        action: { type: 'block' },
        condition: { requestDomains: ['pornhub.com'], resourceTypes: ['script'] },
    },
];

function mockSettings(initial = {}) {
    const settingsStorage = new Map(Object.entries(initial));
    spyOn(settings, 'ready').and.returnValue(Promise.resolve());
    spyOn(settings, 'getSetting').and.callFake((name) => settingsStorage.get(name));
    spyOn(settings, 'updateSetting').and.callFake((name, value) => {
        settingsStorage.set(name, value);
    });
    return settingsStorage;
}

function lastCallArg(spy) {
    const calls = spy.calls.allArgs();
    return calls[calls.length - 1]?.[0];
}

describe('adult/gambling category DNR', () => {
    let settingsStorage;
    let updateEnabledRulesets;
    let updateDynamicRules;

    beforeEach(() => {
        chrome.runtime.getManifest = () => ({ version: '1234.56', manifest_version: 3 });
        settingsStorage = mockSettings({
            allowedSites: ['khanacademy.org', '*.youtube.com', '*docs*'],
            blockAdultGamblingSites: false,
            siteGroupsInitialized: true,
            siteGroups: [
                { id: DEFAULT_GROUP_ID, name: 'Default', maxSecondsPerDay: DEFAULT_GROUP_MAX_SECONDS, domains: [] },
                { id: ALWAYS_BLOCK_GROUP_ID, name: 'Always Block', maxSecondsPerDay: 0, domains: [] },
            ],
        });
        updateEnabledRulesets = spyOn(chrome.declarativeNetRequest, 'updateEnabledRulesets').and.resolveTo();
        updateDynamicRules = spyOn(chrome.declarativeNetRequest, 'updateDynamicRules').and.resolveTo();
        spyOn(chrome.declarativeNetRequest, 'isRegexSupported').and.resolveTo({ isSupported: true });
        spyOn(globalThis, 'fetch').and.resolveTo({
            ok: true,
            json: async () => BUNDLED_RULES,
        });
    });

    it('enables the static ruleset and installs redirects plus Allowed Sites allows', async () => {
        const enabled = await setAdultGamblingBlockEnabled(true);
        expect(enabled).toBeTrue();
        expect(settingsStorage.get('blockAdultGamblingSites')).toBeTrue();
        expect(lastCallArg(updateEnabledRulesets)).toEqual({
            enableRulesetIds: [ADULT_GAMBLING_RULESET_ID],
            disableRulesetIds: [],
        });

        const added = lastCallArg(updateDynamicRules).addRules;
        const redirect = added.find((rule) => rule.action.type === 'redirect');
        const domainAllow = added.find((rule) => rule.action.type === 'allow' && rule.condition.requestDomains);
        const regexAllow = added.find((rule) => rule.action.type === 'allow' && rule.condition.regexFilter);

        expect(redirect.id).toBe(CATEGORY_REDIRECT_RULE_ID_START);
        expect(redirect.priority).toBe(USER_BLOCKED_SITES_PRIORITY);
        expect(redirect.action.redirect.extensionPath).toBe('/html/blocked.html');
        expect(redirect.condition.requestDomains).toEqual(['pornhub.com']);
        expect(redirect.condition.resourceTypes).toEqual(['main_frame']);

        expect(domainAllow.id).toBe(CATEGORY_ALLOW_RULE_ID_START);
        expect(domainAllow.priority).toBe(CATEGORY_BLOCKLIST_ALLOW_PRIORITY);
        expect(domainAllow.condition.requestDomains).toEqual(['khanacademy.org', 'youtube.com']);
        expect(domainAllow.condition.resourceTypes).toEqual(resourceTypes);
        expect(regexAllow.condition.regexFilter).toContain('docs');
        expect(await getMatchDetails(CATEGORY_ALLOW_RULE_ID_START)).toEqual({ type: 'categoryAllow' });
        expect(await getMatchDetails(CATEGORY_REDIRECT_RULE_ID_START)).toEqual({ type: 'categoryRedirect' });
    });

    it('disables the static ruleset and clears dynamic category rules', async () => {
        settingsStorage.set('blockAdultGamblingSites', true);
        await refreshAdultGamblingEnforcement();
        expect(lastCallArg(updateEnabledRulesets)).toEqual({
            enableRulesetIds: [ADULT_GAMBLING_RULESET_ID],
            disableRulesetIds: [],
        });

        await setAdultGamblingBlockEnabled(false);
        expect(lastCallArg(updateEnabledRulesets)).toEqual({
            enableRulesetIds: [],
            disableRulesetIds: [ADULT_GAMBLING_RULESET_ID],
        });
        expect(lastCallArg(updateDynamicRules).addRules).toEqual([]);
        expect(lastCallArg(updateDynamicRules).removeRuleIds[0]).toBe(CATEGORY_ALLOW_RULE_ID_START);
        expect(lastCallArg(updateDynamicRules).removeRuleIds).toContain(CATEGORY_ALLOW_RULE_ID_END);
        expect(lastCallArg(updateDynamicRules).removeRuleIds.at(-1)).toBe(CATEGORY_REDIRECT_RULE_ID_END);
    });

    it('redirects category navigations to the blocked page, except Allowed Sites', async () => {
        await setAdultGamblingBlockEnabled(true);
        expect(await shouldRedirectCategoryNavigation('https://www.pornhub.com/video')).toBeTrue();
        expect(await shouldRedirectCategoryNavigation('https://khanacademy.org/math')).toBeFalse();
        expect(await shouldRedirectCategoryNavigation('https://example.com/')).toBeFalse();
    });

    it('toggles from the Always Block site-groups handler', async () => {
        const siteGroups = new SiteGroups({ settings });
        await siteGroups._ready;

        const on = await siteGroups.handleSetAdultGamblingBlock({ enabled: true });
        expect(on.saved).toBeTrue();
        expect(on.blockAdultGamblingSites).toBeTrue();
        expect(on.categoryBlockSupported).toBeTrue();
        expect(settingsStorage.get('blockAdultGamblingSites')).toBeTrue();

        const off = await siteGroups.handleSetAdultGamblingBlock({ enabled: false });
        expect(off.blockAdultGamblingSites).toBeFalse();
    });

    it('refreshes category allows when Allowed Sites change while the list is on', async () => {
        settingsStorage.set('blockAdultGamblingSites', true);
        settingsStorage.set('allowedSites', []);
        const allowedSites = new AllowedSites({ settings });
        await allowedSites._ready;

        await allowedSites.handleAdd({ text: 'khanacademy.org' });
        expect(getAllowedSites()).toEqual(['khanacademy.org']);
        const added = lastCallArg(updateDynamicRules).addRules;
        expect(added.find((rule) => rule.action.type === 'allow').condition.requestDomains).toEqual(['khanacademy.org']);

        await allowedSites.handleClear();
        expect(lastCallArg(updateDynamicRules).addRules.filter((rule) => rule.action.type === 'allow')).toEqual([]);
    });
});
