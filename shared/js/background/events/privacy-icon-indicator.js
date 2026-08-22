import { iconPaths } from '../../../data/constants';
import { setActionIcon } from '../wrapper';
import { getSiteGroups } from '../site-groups-store';
import { getAllowedSites } from '../allowed-sites-store';
import { findGroupForHostname, hostnameFromUrl } from '../../shared-utils/site-groups';
import { isHostnameAllowed } from '../../shared-utils/allowed-sites';
import { registerMessageHandler } from '../message-registry';

const BLOCKED_PAGE_PATH = '/html/blocked.html';

/**
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
function isBlockedPage(url) {
    return typeof url === 'string' && url.includes(BLOCKED_PAGE_PATH);
}

/**
 * @param {string | null | undefined} url
 * @param {import('../../shared-utils/site-groups').SiteGroup[]=} groups
 * @param {string[]=} allowedPatterns
 */
function iconPathForUrl(url, groups, allowedPatterns) {
    const hostname = hostnameFromUrl(url);
    const inBlockGroup = isBlockedPage(url) || Boolean(findGroupForHostname(groups ?? getSiteGroups(), hostname));
    const onAllowedSites = isHostnameAllowed(hostname, allowedPatterns ?? getAllowedSites());
    if (inBlockGroup) {
        return iconPaths.inBlockGroup;
    }
    if (onAllowedSites) {
        return iconPaths.regular;
    }
    return iconPaths.withSpecialState;
}

/**
 * Choose the toolbar icon for a tab.
 *
 * 1) Light red — Block Group site, or the blocked interstitial
 * 2) Regular — Allowed Sites
 * 3) Greyed-out — neither list
 *
 * @param {import("../classes/site").default} site
 * @param {number} tabId
 * @param {import('../../shared-utils/site-groups').SiteGroup[]=} groups
 * @param {string[]=} allowedPatterns
 * @returns {Promise<void>}
 */
export function updateActionIcon(site, tabId, groups, allowedPatterns) {
    return updateActionIconForUrl(tabId, site?.url, groups, allowedPatterns);
}

/**
 * @param {number} tabId
 * @param {string | null | undefined} url
 * @param {import('../../shared-utils/site-groups').SiteGroup[]=} groups
 * @param {string[]=} allowedPatterns
 * @returns {Promise<void>}
 */
export function updateActionIconForUrl(tabId, url, groups, allowedPatterns) {
    return setActionIcon(iconPathForUrl(url, groups, allowedPatterns), tabId);
}

/**
 * Recompute toolbar icons after Block Group or Allowed Sites membership changes.
 *
 * @returns {Promise<void>}
 */
export async function refreshOpenTabActionIcons() {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
        tabs.map(async (tab) => {
            if (tab.id == null) {
                return;
            }
            await updateActionIconForUrl(tab.id, tab.url);
        }),
    );
}

registerMessageHandler('blockedPageShown', (_options, sender) => {
    const tabId = sender?.tab?.id;
    if (tabId == null) {
        return;
    }
    return updateActionIconForUrl(tabId, sender.tab.url || BLOCKED_PAGE_PATH);
});
