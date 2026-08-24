import { registerMessageHandler } from '../message-registry';
import { hostnameFromUrl } from '../../shared-utils/site-groups';
import { isHostnameAllowed } from '../../shared-utils/allowed-sites';
import {
    ALARM_SANCTUARY_EXPIRY,
    SANCTUARY_MIN_SECONDS,
    formatSanctuaryDuration,
    getSanctuaryRemainingSeconds,
    isSanctuarySessionActive,
    normalizeSanctuaryDuration,
} from '../../shared-utils/sanctuary';
import { getAllowedSites } from '../allowed-sites-store';
import { clearSanctuarySession, getSanctuarySettings, isSanctuaryActive, saveSanctuarySettings } from '../sanctuary-store';
import { clearSanctuaryRules, refreshSanctuaryRules } from '../dnr-sanctuary';
import { getExtensionURL } from '../wrapper';

const BLOCKED_PAGE_PATH = '/html/blocked.html';

export default class Sanctuary {
    /**
     * @param {{ settings: import('../settings.js') }} options
     */
    constructor({ settings }) {
        this.featureName = 'Sanctuary';
        this.settings = settings;
        this._redirectingTabs = new Set();

        registerMessageHandler('getSanctuaryState', () => this.handleGet());
        registerMessageHandler('updateSanctuarySettings', (options) => this.handleUpdate(options));
        registerMessageHandler('activateSanctuary', () => this.handleActivate());

        this._ready = this.init();
    }

    async init() {
        try {
            await this.settings.ready();
            this.attachNavigationGuards();
            chrome.alarms.onAlarm.addListener((alarm) => this.onAlarm(alarm));
            await this.syncSession();
        } catch (error) {
            console.error('Sanctuary failed to initialize', error);
        }
    }

    blockedPageUrl() {
        return getExtensionURL(BLOCKED_PAGE_PATH);
    }

    /**
     * @param {string} [url]
     * @returns {boolean}
     */
    isBlockedPage(url) {
        if (!url) {
            return false;
        }
        const blockedPageUrl = this.blockedPageUrl();
        return url === blockedPageUrl || url.startsWith(`${blockedPageUrl}?`) || url.startsWith(`${blockedPageUrl}#`);
    }

    attachNavigationGuards() {
        const onNavigate = (details) => {
            if (details.frameId !== 0) {
                return;
            }
            this.enforceNavigation(details.tabId, details.url);
        };

        chrome.webNavigation.onBeforeNavigate.addListener(onNavigate);
        chrome.webNavigation.onCommitted.addListener(onNavigate);
        chrome.webNavigation.onErrorOccurred.addListener(onNavigate);
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            const url = changeInfo.url || tab?.pendingUrl || tab?.url;
            if (url && (changeInfo.url || changeInfo.status === 'loading' || tab?.pendingUrl)) {
                this.enforceNavigation(tabId, url);
            }
        });
    }

    /**
     * @param {number} [now]
     */
    getViewState(now = Date.now()) {
        const settings = getSanctuarySettings();
        const patterns = getAllowedSites();
        const remainingSeconds = getSanctuaryRemainingSeconds(settings.endsAt, now);
        const active = remainingSeconds > 0;
        const durationSeconds = settings.durationSeconds;
        /** @type {'empty' | 'duration' | 'active' | null} */
        let cannotActivateReason = null;
        if (active) {
            cannotActivateReason = 'active';
        } else if (patterns.length === 0) {
            cannotActivateReason = 'empty';
        } else if (durationSeconds < SANCTUARY_MIN_SECONDS) {
            cannotActivateReason = 'duration';
        }

        return {
            durationSeconds,
            durationLabel: formatSanctuaryDuration(durationSeconds),
            showOnPopup: settings.showOnPopup,
            endsAt: active ? settings.endsAt : 0,
            active,
            locked: active,
            remainingSeconds,
            canActivate: !cannotActivateReason,
            cannotActivateReason,
            patternCount: patterns.length,
            serverNow: now,
        };
    }

    async handleGet() {
        await this._ready;
        await this.expireIfNeeded();
        return this.getViewState();
    }

    /**
     * @param {{ durationSeconds?: unknown, showOnPopup?: unknown }} [options]
     */
    async handleUpdate(options = {}) {
        await this._ready;
        await this.expireIfNeeded();
        if (isSanctuaryActive()) {
            return { saved: false, ...this.getViewState() };
        }
        const updates = {};
        if (options.durationSeconds != null) {
            updates.durationSeconds = normalizeSanctuaryDuration(options.durationSeconds);
        }
        if (options.showOnPopup != null) {
            updates.showOnPopup = Boolean(options.showOnPopup);
        }
        saveSanctuarySettings(updates);
        return { saved: true, ...this.getViewState() };
    }

    async handleActivate() {
        await this._ready;
        await this.expireIfNeeded();
        const state = this.getViewState();
        if (!state.canActivate) {
            return { saved: false, ...state };
        }
        const endsAt = Date.now() + state.durationSeconds * 1000;
        saveSanctuarySettings({ endsAt });
        await this.applyActiveSession();
        return { saved: true, ...this.getViewState() };
    }

    async expireIfNeeded(now = Date.now()) {
        const { endsAt } = getSanctuarySettings();
        if (!endsAt) {
            return false;
        }
        if (isSanctuarySessionActive(endsAt, now)) {
            return false;
        }
        await this.deactivate();
        return true;
    }

    async deactivate() {
        clearSanctuarySession();
        await chrome.alarms.clear(ALARM_SANCTUARY_EXPIRY);
        await clearSanctuaryRules();
    }

    async applyActiveSession() {
        const { endsAt } = getSanctuarySettings();
        if (!isSanctuarySessionActive(endsAt)) {
            await this.deactivate();
            return;
        }
        await refreshSanctuaryRules(getAllowedSites());
        await chrome.alarms.clear(ALARM_SANCTUARY_EXPIRY);
        await chrome.alarms.create(ALARM_SANCTUARY_EXPIRY, { when: endsAt });
        await this.redirectOpenBlockedTabs();
    }

    async syncSession() {
        if (!(await this.expireIfNeeded())) {
            if (isSanctuaryActive()) {
                await this.applyActiveSession();
            } else {
                await clearSanctuaryRules();
            }
        }
    }

    async onAlarm(alarm) {
        if (alarm?.name === ALARM_SANCTUARY_EXPIRY) {
            await this.expireIfNeeded();
        }
    }

    /**
     * @param {number} tabId
     * @param {string} [url]
     */
    async enforceNavigation(tabId, url) {
        if (!Number.isInteger(tabId) || tabId < 0 || !url || this.isBlockedPage(url)) {
            return;
        }
        await this.settings.ready();
        if (!isSanctuaryActive()) {
            return;
        }
        const hostname = hostnameFromUrl(url);
        if (!hostname) {
            return;
        }
        if (isHostnameAllowed(hostname, getAllowedSites())) {
            return;
        }
        await this.redirectTab(tabId);
    }

    async redirectOpenBlockedTabs() {
        const tabs = await chrome.tabs.query({});
        await Promise.all(
            tabs.map((tab) => (tab.id != null ? this.enforceNavigation(tab.id, tab.pendingUrl || tab.url) : Promise.resolve())),
        );
    }

    /**
     * @param {number} tabId
     */
    async redirectTab(tabId) {
        if (this._redirectingTabs.has(tabId)) {
            return;
        }
        this._redirectingTabs.add(tabId);
        try {
            const tab = await chrome.tabs.get(tabId).catch(() => null);
            if (this.isBlockedPage(tab?.url) || this.isBlockedPage(tab?.pendingUrl)) {
                return;
            }
            await chrome.tabs.update(tabId, { url: this.blockedPageUrl() });
        } catch (error) {
            console.warn('Failed to redirect sanctuary tab', error);
        } finally {
            setTimeout(() => this._redirectingTabs.delete(tabId), 750);
        }
    }
}
