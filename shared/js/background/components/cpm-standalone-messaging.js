import Site from '../classes/site';

/**
 * @typedef {import('./cookie-prompt-management').CPMMessagingBase} CPMMessagingBase
 */

/**
 * CPM messaging for standalone extension.
 * @implements {CPMMessagingBase}
 */
export class CPMStandaloneMessaging {
    /** @param {{ remoteConfig: import('./remote-config').default }} opts */
    constructor({ remoteConfig }) {
        this.remoteConfig = remoteConfig;
    }

    async logMessage(message) {
        console.log(message);
    }

    async refreshDashboardState(tabId, url, dashboardState) {
        console.log('refreshDashboardState', tabId, url, dashboardState);
        // no-op
    }

    async showCpmAnimation(tabId, topUrl, isCosmetic) {
        console.log('showCpmAnimation', tabId, topUrl, isCosmetic);
        // no-op
    }

    async notifyPopupHandled(tabId, msg) {
        console.log('notifyPopupHandled', tabId, msg);
        // no-op
    }

    async checkAutoconsentSetting() {
        // there's no Autoconsent setting in the extension yet
        /** @type {import('./cookie-prompt-management').AutoconsentModePreference} */
        const userPreference = 'default';
        return { enabled: true, userPreference, featureFlags: { heuristicAction: true, cookiePopupPreferenceSetting: true } };
    }

    async checkAutoconsentEnabledForSite(url) {
        await this.remoteConfig.ready;
        const site = new Site(url);
        return site.isFeatureEnabled('autoconsent');
    }

    async checkSubfeatureEnabled(subfeatureName) {
        await this.remoteConfig.ready;
        return this.remoteConfig.isSubFeatureEnabled('autoconsent', subfeatureName);
    }

    async sendPixel() {
        return Promise.resolve();
    }

    async refreshRemoteConfig() {
        console.log(`fetching config`);
        await this.remoteConfig.ready;
        await this.remoteConfig.checkForUpdates(false);
        return this.remoteConfig.config;
    }
}
