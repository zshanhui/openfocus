import browser from 'webextension-polyfill';
chrome.runtime.getManifest = () => ({ version: '1234.56', manifest_version: 3 });

const { setOrUpdateSearchRedirectRule } = require('../../shared/js/background/dnr-search-redirect');
const settings = require('../../shared/js/background/settings');
const { SEARCH_REDIRECT_RULE_ID } = require('../../shared/js/background/dnr-utils');
const { ALTERNATIVE_SEARCH_PRIORITY } = require('@duckduckgo/ddg2dnr/lib/rulePriorities');

const settingHelper = require('../helpers/settings');

describe('dnr-search-redirect.setOrUpdateSearchRedirectRule()', () => {
    beforeEach(() => {
        settingHelper.stub({ useNoAiSearch: false });
        spyOn(chrome.declarativeNetRequest, 'updateDynamicRules').and.returnValue(Promise.resolve());
    });

    it('creates a no-AI search redirect rule when enabled', () => {
        settings.updateSetting('useNoAiSearch', true);
        setOrUpdateSearchRedirectRule();

        const { addRules } = chrome.declarativeNetRequest.updateDynamicRules.calls.mostRecent().args[0];
        const searchRedirectRule = addRules.find((rule) => rule.id === SEARCH_REDIRECT_RULE_ID);

        expect(searchRedirectRule).toBeDefined();
        expect(searchRedirectRule.priority).toEqual(ALTERNATIVE_SEARCH_PRIORITY);
        expect(searchRedirectRule.action.redirect.transform.host).toEqual('noai.duckduckgo.com');
    });

    it('removes the no-AI search redirect rule when disabled', () => {
        setOrUpdateSearchRedirectRule();

        const { removeRuleIds, addRules } = chrome.declarativeNetRequest.updateDynamicRules.calls.mostRecent().args[0];
        expect(removeRuleIds).toEqual([SEARCH_REDIRECT_RULE_ID]);
        expect(addRules).toEqual([]);
    });
});
