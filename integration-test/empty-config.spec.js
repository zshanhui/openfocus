import { test, expect } from './helpers/playwrightHarness';
import backgroundWait from './helpers/backgroundWait';
import { routeFromLocalhost } from './helpers/testPages';
import { overridePrivacyConfigFromContent, overrideTds } from './helpers/testConfig';
import emptyConfig from './data/configs/empty-config.json';

test.describe('Extension functions with empty configuration', () => {
    test.beforeEach(async ({ backgroundNetworkContext, backgroundPage, context }) => {
        await overridePrivacyConfigFromContent(backgroundNetworkContext, emptyConfig);
        await overrideTds(backgroundNetworkContext, 'empty-tds.json');
        await backgroundWait.forExtensionLoaded(context);
        await backgroundWait.forAllConfiguration(backgroundPage);
    });

    test('Post-install page does not open', async ({ context }) => {
        const postInstallPage = context.pages().find((p) => p.url().startsWith('https://duckduckgo.com/extension-success'));
        expect(postInstallPage).toBeUndefined();
    });

    test('First install opens the Block Sites settings view', async ({ context, backgroundPage }) => {
        const optionsUrl = await backgroundPage.evaluate(() => chrome.runtime.getURL('html/options.html'));
        const isBlockSitesView = (page) => page.url() === `${optionsUrl}#block-sites`;
        await expect.poll(() => context.pages().some(isBlockSitesView), { timeout: 5000 }).toBe(true);
    });

    test('There are no injected page exceptions', async ({ page }) => {
        await routeFromLocalhost(page);
        const errors = [];
        page.on('pageerror', (error) => errors.push(error));
        await page.goto('https://privacy-test-pages.site/', { waitUntil: 'networkidle' });
        expect(errors).toHaveLength(0);
    });

    test('Settings page can add an unprotected site', async ({ context, backgroundPage }) => {
        const allowlistedDomain = 'bad.third-party.site';
        const isAllowlisted = () =>
            backgroundPage.evaluate((domain) => globalThis.dbg.settings.getSetting('allowlisted')?.[domain], allowlistedDomain);

        expect(await isAllowlisted()).toBeFalsy();

        // Open the settings page on the tracker-protection tab (the allowlist UI lives there).
        const optionsUrl = await backgroundPage.evaluate(() => chrome.runtime.getURL('html/options.html'));
        const options = await context.newPage();
        await options.goto(optionsUrl + '#block-trackers');
        await options.bringToFront();

        // Add a site to the allowlist.
        await options.click('.js-allowlist-show-add');
        await options.type('.js-allowlist-url', 'https://' + allowlistedDomain);
        await options.click('.js-allowlist-add');
        await options.waitForSelector('.js-allowlist-list-item');

        // Site was allowlisted.
        expect(await isAllowlisted()).toBe(true);
    });

    test('Broken site report submission does not send telemetry', async ({ backgroundPage, page, backgroundNetworkContext }) => {
        await routeFromLocalhost(page);
        await page.goto('https://privacy-test-pages.site/', { waitUntil: 'networkidle' });
        await page.bringToFront();

        let telemetryRequest = false;
        const onRequest = (request) => {
            if (request.url().includes('improving.duckduckgo.com')) {
                telemetryRequest = true;
            }
        };
        backgroundNetworkContext.on('request', onRequest);

        await backgroundPage.evaluate(() =>
            globalThis.components.dashboardMessaging.submitBrokenSiteReport({ category: 'dislike', description: 'Hello Dax' }),
        );
        await page.waitForTimeout(500);
        backgroundNetworkContext.off('request', onRequest);
        expect(telemetryRequest).toBe(false);
    });

    test('Configuration updates are applied', async ({ backgroundPage, backgroundNetworkContext, page }) => {
        const checkConfigState = () =>
            backgroundPage.evaluate(() => ({
                configVersion: globalThis.components.tds.config.data?.version,
                featureCount: Object.keys(globalThis.components.remoteConfig.config?.features || {}).length,
            }));

        // Empty config loaded initially.
        let { configVersion, featureCount } = await checkConfigState();
        expect(configVersion).toEqual(1);
        expect(featureCount).toEqual(0);

        // Update config to have a feature enabled.
        await overridePrivacyConfigFromContent(backgroundNetworkContext, {
            readme: 'Updated config for resilience testing',
            version: 2,
            features: {
                navigatorInterface: { state: 'enabled' },
            },
            unprotectedTemporary: [],
        });
        await backgroundPage.evaluate(async () => {
            await globalThis.components.tds.config.checkForUpdates(true);
        });

        // Config loaded OK.
        ({ configVersion, featureCount } = await checkConfigState());
        expect(configVersion).toEqual(2);
        expect(featureCount).toBeGreaterThan(0);

        // Enabled feature worked.
        await routeFromLocalhost(page);
        await page.goto('https://privacy-test-pages.site/', { waitUntil: 'networkidle' });
        await page.waitForFunction(() => 'duckduckgo' in navigator);
    });
});
