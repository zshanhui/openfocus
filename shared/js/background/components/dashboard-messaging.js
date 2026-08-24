import { getDisclosureDetails } from '../broken-site-report';
import { dashboardDataFromTab } from '../classes/privacy-dashboard-data';
import { registerMessageHandler } from '../message-registry';
import { getCurrentTab } from '../utils';

/**
 * Message handlers for communication from the dashboard to the extension background.
 *
 * Note, handlers are split over multiple components, and some are not yet encapsulated in a component.
 *
 * Implemented in this component:
 *  - getBreakageFormOptions
 *  - getPrivacyDashboardData
 *  - submitBrokenSiteReport
 *
 * ToggleReports component:
 *  - getToggleReportOptions
 *  - rejectToggleReport
 *  - sendToggleReport
 *  - seeWhatIsSent
 *
 * Static message handlers:
 *  - openOptions
 *  - search
 *  - setLists
 *
 * See https://duckduckgo.github.io/privacy-dashboard/modules/Browser_Extensions_integration.html
 */
export default class DashboardMessaging {
    /**
     * @param {{
     *  settings: import('../settings.js');
     *  tds: import('./tds').default;
     *  tabManager: import('../tab-manager.js');
     * }} args
     */
    constructor({ settings, tds, tabManager }) {
        this.settings = settings;
        this.tds = tds;
        this.tabManager = tabManager;

        registerMessageHandler('submitBrokenSiteReport', (report) => this.submitBrokenSiteReport(report));
        registerMessageHandler('getPrivacyDashboardData', this.getPrivacyDashboardData.bind(this));
        registerMessageHandler('getBreakageFormOptions', getDisclosureDetails);
    }

    /**
     * Dashboard still sends this if leftover UI is triggered. OpenFocusd does
     * not collect or forward breakage reports.
     * @param {...unknown} _args
     * @returns {Promise<void>}
     */
    async submitBrokenSiteReport(..._args) {
        return Promise.resolve();
    }

    /**
     * This message is here to ensure the privacy dashboard can render
     * from a single call to the extension.
     *
     * Currently, it will collect data for the current tab.
     */
    async getPrivacyDashboardData(options) {
        let { tabId } = options;
        if (tabId === null) {
            const currentTab = await getCurrentTab();
            if (!currentTab?.id) {
                throw new Error('could not get the current tab...');
            }
            tabId = currentTab?.id;
        }

        // Await for storage to be ready; this happens on service worker closing mostly.
        await this.settings.ready();
        await this.tds.config.ready;

        const tab = await this.tabManager.getOrRestoreTab(tabId);
        if (!tab) throw new Error('unreachable - cannot access current tab with ID ' + tabId);
        return dashboardDataFromTab(tab, { enabled: false });
    }
}
