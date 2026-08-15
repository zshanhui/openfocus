import { test, expect } from './helpers/playwrightHarness';
import { forAllConfiguration, forExtensionLoaded, forFunction } from './helpers/backgroundWait';

const blockedDomain = 'privacy-test-pages.site';
const blockedUrl = `https://${blockedDomain}/`;
const blockedSitesRuleId = 20011;
const blockedSitesSubresourceRuleId = 20012;

test.describe('User blocked websites', () => {
    test('group form installs and removes a complete domain block', async ({ backgroundPage, context, manifestVersion }) => {
        test.skip(manifestVersion !== 3, 'User blocked websites currently uses Chrome MV3 DNR');

        await forExtensionLoaded(context);
        await forAllConfiguration(backgroundPage);

        const extensionId = new URL(backgroundPage.url()).hostname;
        const optionsPage = await context.newPage();
        await optionsPage.goto(`chrome-extension://${extensionId}/html/options.html`);

        const blockSitesTab = optionsPage.locator('[data-options-tab="block-sites"]');
        const allowedSitesTab = optionsPage.locator('[data-options-tab="allowed-sites"]');
        const blockTrackersTab = optionsPage.locator('[data-options-tab="block-trackers"]');

        await expect(blockSitesTab).toHaveAttribute('aria-selected', 'true');
        await expect(optionsPage.locator('[data-options-panel="block-sites"]')).toBeVisible();
        await expect(optionsPage.locator('.js-site-group[data-group-id="default"]')).toBeVisible();
        await expect(optionsPage.locator('.js-site-group[data-group-id="always-block"]')).toBeVisible();

        await blockTrackersTab.click();
        await expect(optionsPage.locator('[data-options-panel="block-trackers"]')).toBeVisible();
        await expect(optionsPage.locator('.options-content__privacy')).toBeVisible();

        await allowedSitesTab.click();
        const allowedSitesPanel = optionsPage.locator('[data-options-panel="allowed-sites"]');
        await expect(allowedSitesTab).toHaveAttribute('aria-selected', 'true');
        await expect(allowedSitesPanel).not.toHaveAttribute('hidden', '');
        await expect(allowedSitesPanel.locator('.js-allowed-sites-input')).toBeVisible();
        await expect(allowedSitesPanel.locator('.js-allowed-sites-clear')).toBeDisabled();
        await expect(optionsPage).toHaveURL(/#allowed-sites$/);

        await optionsPage.reload();
        await expect(allowedSitesTab).toHaveAttribute('aria-selected', 'true');
        await expect(allowedSitesPanel.locator('.js-allowed-sites-input')).toBeVisible();

        await blockSitesTab.click();
        const alwaysBlock = optionsPage.locator('.js-site-group[data-group-id="always-block"]');
        await alwaysBlock.locator('.js-site-group-domain-input').fill(blockedDomain);
        await alwaysBlock.locator('.js-site-group-add-domain').click();
        await expect(alwaysBlock.locator('.js-site-group-domain-list')).toContainText(blockedDomain);

        await forFunction(
            backgroundPage,
            async (ruleIds) => {
                const rules = await chrome.declarativeNetRequest.getDynamicRules();
                return ruleIds.every((ruleId) => rules.some((rule) => rule.id === ruleId));
            },
            [blockedSitesRuleId, blockedSitesSubresourceRuleId],
        );

        const installedRules = await backgroundPage.evaluate(
            async (ruleIds) => {
                const rules = await chrome.declarativeNetRequest.getDynamicRules();
                return rules.filter((rule) => ruleIds.includes(rule.id));
            },
            [blockedSitesRuleId, blockedSitesSubresourceRuleId],
        );
        const redirectRule = installedRules.find((rule) => rule.id === blockedSitesRuleId);
        const subresourceRule = installedRules.find((rule) => rule.id === blockedSitesSubresourceRuleId);
        expect(redirectRule.action).toEqual({
            type: 'redirect',
            redirect: {
                extensionPath: '/html/blocked.html',
            },
        });
        expect(redirectRule.condition.requestDomains).toEqual([blockedDomain]);
        expect(redirectRule.condition.resourceTypes).toEqual(['main_frame']);
        expect(subresourceRule.action.type).toBe('block');
        expect(subresourceRule.condition.requestDomains).toEqual([blockedDomain]);
        expect(subresourceRule.condition.resourceTypes).not.toContain('main_frame');

        await backgroundPage.evaluate(
            async ({ domain, redirectRuleId, subresourceRuleId }) => {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: [redirectRuleId, subresourceRuleId],
                    addRules: [
                        {
                            id: redirectRuleId,
                            priority: 3000000,
                            action: { type: 'block' },
                            condition: {
                                requestDomains: [domain],
                                resourceTypes: ['main_frame'],
                            },
                        },
                    ],
                });
                await globalThis.components.dnrListeners.refreshBlockedSitesRules();
            },
            {
                domain: blockedDomain,
                redirectRuleId: blockedSitesRuleId,
                subresourceRuleId: blockedSitesSubresourceRuleId,
            },
        );

        await forFunction(
            backgroundPage,
            async (ruleId) => {
                const rules = await chrome.declarativeNetRequest.getDynamicRules();
                return rules.some((rule) => rule.id === ruleId && rule.action.type === 'redirect');
            },
            blockedSitesRuleId,
        );

        const blockedPage = await context.newPage();
        await blockedPage.goto(blockedUrl);
        await expect(blockedPage).toHaveURL(`chrome-extension://${extensionId}/html/blocked.html`);
        await expect(blockedPage.locator('h1')).toHaveText('This site is blocked');

        await alwaysBlock.locator(`.js-site-group-remove-domain[data-domain="${blockedDomain}"]`).click();
        await expect(alwaysBlock.locator('.js-site-group-domain-list')).not.toContainText(blockedDomain);

        await forFunction(
            backgroundPage,
            async (ruleIds) => {
                const rules = await chrome.declarativeNetRequest.getDynamicRules();
                return ruleIds.every((ruleId) => !rules.some((rule) => rule.id === ruleId));
            },
            [blockedSitesRuleId, blockedSitesSubresourceRuleId],
        );

        await expect(blockedPage.goto(blockedUrl)).resolves.toBeTruthy();
    });

    test('allowed sites can be added, rejected when grouped, and cleared', async ({ backgroundPage, context, manifestVersion }) => {
        test.skip(manifestVersion !== 3, 'Allowed websites currently uses Chrome MV3');

        await forExtensionLoaded(context);
        await forAllConfiguration(backgroundPage);

        const extensionId = new URL(backgroundPage.url()).hostname;
        const optionsPage = await context.newPage();
        await optionsPage.goto(`chrome-extension://${extensionId}/html/options.html`);

        const allowedSitesPanel = optionsPage.locator('[data-options-panel="allowed-sites"]');
        await optionsPage.locator('[data-options-tab="allowed-sites"]').click();
        await allowedSitesPanel.locator('.js-allowed-sites-input').fill('khanacademy.org');
        await allowedSitesPanel.locator('.js-allowed-sites-add').click();
        await expect(allowedSitesPanel.locator('.allowed-sites-chip')).toContainText('khanacademy.org');
        await expect(allowedSitesPanel.locator('.js-allowed-sites-clear')).toBeEnabled();

        await optionsPage.locator('[data-options-tab="block-sites"]').click();
        const alwaysBlock = optionsPage.locator('.js-site-group[data-group-id="always-block"]');
        await alwaysBlock.locator('.js-site-group-domain-input').fill('khanacademy.org');
        await alwaysBlock.locator('.js-site-group-add-domain').click();
        const allowedDialog = optionsPage.locator('.js-site-group-allowed-dialog');
        await expect(allowedDialog).toBeVisible();
        await allowedDialog.locator('.js-site-group-allowed-submit').click();
        await expect(alwaysBlock.locator('.js-site-group-domain-list')).toContainText('khanacademy.org');

        await optionsPage.locator('[data-options-tab="allowed-sites"]').click();
        await expect(allowedSitesPanel.locator('.allowed-sites-chip')).toHaveCount(0);
        await allowedSitesPanel.locator('.js-allowed-sites-input').fill('khanacademy.org');
        await allowedSitesPanel.locator('.js-allowed-sites-add').click();
        await expect(allowedSitesPanel.locator('.js-allowed-sites-error')).toContainText('Always Block');

        await allowedSitesPanel.locator('.js-allowed-sites-input').fill('docs.google.com');
        await allowedSitesPanel.locator('.js-allowed-sites-add').click();
        await expect(allowedSitesPanel.locator('.allowed-sites-chip')).toContainText('docs.google.com');
        await allowedSitesPanel.locator('.js-allowed-sites-clear').click();
        await optionsPage.locator('.js-allowed-sites-clear-submit').click();
        await expect(allowedSitesPanel.locator('.allowed-sites-chip')).toHaveCount(0);
        await expect(allowedSitesPanel.locator('.js-allowed-sites-clear')).toBeDisabled();
    });

    test('sanctuary mode blocks every site except the allowed list', async ({ backgroundPage, context, manifestVersion }) => {
        test.skip(manifestVersion !== 3, 'Sanctuary Mode currently uses Chrome MV3 DNR');

        await forExtensionLoaded(context);
        await forAllConfiguration(backgroundPage);

        const extensionId = new URL(backgroundPage.url()).hostname;
        const sanctuaryBlockMainRuleId = 20013;
        const sanctuaryBlockSubresourceRuleId = 20014;
        const sanctuaryAllowRuleIdStart = 20015;

        const activated = await backgroundPage.evaluate(async () => {
            await globalThis.components.allowedSites.handleAdd({ text: 'khanacademy.org' });
            await globalThis.components.sanctuary.handleUpdate({ durationSeconds: 300, showOnPopup: true });
            return globalThis.components.sanctuary.handleActivate();
        });
        expect(activated.saved).toBeTrue();
        expect(activated.active).toBeTrue();

        await forFunction(
            backgroundPage,
            async (ruleIds) => {
                const rules = await chrome.declarativeNetRequest.getDynamicRules();
                return ruleIds.every((ruleId) => rules.some((rule) => rule.id === ruleId));
            },
            [sanctuaryBlockMainRuleId, sanctuaryBlockSubresourceRuleId, sanctuaryAllowRuleIdStart],
        );

        const rules = await backgroundPage.evaluate(
            async (ruleIds) => {
                const installed = await chrome.declarativeNetRequest.getDynamicRules();
                return installed.filter((rule) => ruleIds.includes(rule.id));
            },
            [sanctuaryBlockMainRuleId, sanctuaryBlockSubresourceRuleId, sanctuaryAllowRuleIdStart],
        );
        const redirectRule = rules.find((rule) => rule.id === sanctuaryBlockMainRuleId);
        const allowRule = rules.find((rule) => rule.id === sanctuaryAllowRuleIdStart);
        expect(redirectRule.action).toEqual({
            type: 'redirect',
            redirect: { extensionPath: '/html/blocked.html' },
        });
        expect(redirectRule.condition.regexFilter).toBe('^https?://');
        expect(allowRule.action.type).toBe('allowAllRequests');
        expect(allowRule.condition.requestDomains).toEqual(['khanacademy.org']);
        expect(allowRule.condition.resourceTypes).toEqual(['main_frame']);

        const optionsPage = await context.newPage();
        await optionsPage.goto(`chrome-extension://${extensionId}/html/options.html#allowed-sites`);
        const allowedSitesPanel = optionsPage.locator('[data-options-panel="allowed-sites"]');
        await expect(allowedSitesPanel.locator('.js-allowed-sites-input')).toBeDisabled();
        await expect(allowedSitesPanel.locator('.js-sanctuary-remaining')).toContainText('Sanctuary Mode is on');

        const blockedPage = await context.newPage();
        await blockedPage.goto(blockedUrl);
        await expect(blockedPage).toHaveURL(`chrome-extension://${extensionId}/html/blocked.html`);
        await expect(blockedPage.locator('h1')).toHaveText('Sanctuary Mode is on');
    });
});
