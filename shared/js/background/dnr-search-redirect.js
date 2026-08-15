const browserWrapper = require('./wrapper');
import settings from './settings';
import { SEARCH_REDIRECT_RULE_ID } from './dnr-utils';
import { ALTERNATIVE_SEARCH_PRIORITY } from '@duckduckgo/ddg2dnr/lib/rulePriorities';
import { generateDNRRule } from '@duckduckgo/ddg2dnr/lib/utils';

const LEGACY_ATB_RULE_IDS = [20003, 20008, 20010];

/**
 * Remove ATB attribution rules left over from earlier extension versions.
 */
export async function removeLegacyAtbRules() {
    if (browserWrapper.getManifestVersion() !== 3) {
        return;
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: LEGACY_ATB_RULE_IDS,
    });
}

/**
 * Install or remove the optional no-AI search redirect rule.
 */
export function setOrUpdateSearchRedirectRule() {
    if (browserWrapper.getManifestVersion() !== 3) {
        return;
    }

    const useNoAiSearch = settings.getSetting('useNoAiSearch') === true;
    const addRules = [];

    if (useNoAiSearch) {
        addRules.push(
            generateDNRRule({
                id: SEARCH_REDIRECT_RULE_ID,
                priority: ALTERNATIVE_SEARCH_PRIORITY,
                actionType: 'redirect',
                redirect: {
                    transform: {
                        host: 'noai.duckduckgo.com',
                    },
                },
                resourceTypes: ['main_frame'],
                regexFilter: '^https://duckduckgo\\.com/\\?.*',
            }),
        );
    }

    chrome.declarativeNetRequest
        .updateDynamicRules({
            removeRuleIds: [SEARCH_REDIRECT_RULE_ID],
            addRules,
        })
        .catch((error) => {
            console.error('Error updating search redirect DNR rules:', error);
        });
}

settings.ready().then(() => {
    removeLegacyAtbRules();
    setOrUpdateSearchRedirectRule();

    settings.onSettingUpdate.addEventListener('useNoAiSearch', () => {
        setOrUpdateSearchRedirectRule();
    });
});
