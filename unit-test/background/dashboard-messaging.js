import browser from 'webextension-polyfill';
import load from '../../shared/js/background/load';
import tabManager from '../../shared/js/background/tab-manager';
import DashboardMessaging from '../../shared/js/background/components/dashboard-messaging';
import { MockSettings, mockTdsStorage } from '../helpers/mocks';

describe('DashboardMessaging component', () => {
    describe('submitBrokenSiteReport', () => {
        let currentTabDetails = null;
        /** @type {DashboardMessaging} */
        let dashboardMessaging = null;

        beforeEach(() => {
            currentTabDetails = null;
            spyOn(browser.tabs, 'sendMessage').and.callFake((_tabId, message) => {
                if (message.messageType === 'getBreakageReportValues') {
                    return Promise.resolve(undefined);
                }
            });
            spyOn(load, 'url');
            spyOn(browser.tabs, 'query').and.callFake(() => {
                const result = [];

                if (currentTabDetails) {
                    result.push(currentTabDetails);
                }

                return Promise.resolve(result);
            });
            const settings = new MockSettings();
            const tds = mockTdsStorage(settings);
            dashboardMessaging = new DashboardMessaging({
                settings,
                tds,
                tabManager,
            });
        });

        it('does not send remote breakage reports', async () => {
            currentTabDetails = {
                id: 123,
                url: 'https://domain.example/path?param=value',
            };
            tabManager.create(currentTabDetails);
            await dashboardMessaging.submitBrokenSiteReport({ category: 'foo', description: 'ben' });
            expect(load.url).not.toHaveBeenCalled();
        });

        it('does not send a report if there is no active tab', async () => {
            await dashboardMessaging.submitBrokenSiteReport({ category: 'foo', description: 'ben' });
            expect(load.url).not.toHaveBeenCalled();
        });

        it('does not send toggle reports remotely', async () => {
            currentTabDetails = {
                id: 123,
                url: 'https://domain2.example/path?param=value',
            };
            tabManager.create(currentTabDetails);
            await dashboardMessaging.submitBrokenSiteReport(
                {},
                'protection-toggled-off-breakage-report',
                'on_protections_off_dashboard_main',
            );
            expect(load.url).not.toHaveBeenCalled();
        });
    });
});
