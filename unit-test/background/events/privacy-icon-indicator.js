import { updateActionIcon, updateActionIconForUrl } from '../../../shared/js/background/events/privacy-icon-indicator';
import { iconPaths } from '../../../shared/data/constants';
import Site from '../../../shared/js/background/classes/site';
import browser from 'webextension-polyfill';

const socialGroup = {
    id: 'social',
    name: 'Social',
    maxSecondsPerDay: 3600,
    domains: ['example.com'],
};

describe('privacy icon indicator', () => {
    beforeEach(() => {
        spyOn(browser.browserAction, 'setIcon').and.returnValue(Promise.resolve());
    });
    it('uses the gray icon when the site is on neither list', async () => {
        const site = new Site('https://example.com');
        await updateActionIcon(site, 100, [], []);

        expect(browser.browserAction.setIcon.calls.argsFor(0)).toEqual([
            {
                path: iconPaths.withSpecialState,
                tabId: 100,
            },
        ]);
    });
    it('uses the green icon when the site is on Allowed Sites', async () => {
        const site = new Site('https://www.docs.example.com');
        await updateActionIcon(site, 100, [], ['example.com']);

        expect(browser.browserAction.setIcon.calls.argsFor(0)).toEqual([
            {
                path: iconPaths.regular,
                tabId: 100,
            },
        ]);
    });
    it('uses the light red icon when the site is in a Block Group', async () => {
        const site = new Site('https://www.example.com');
        await updateActionIcon(site, 100, [socialGroup], []);

        expect(browser.browserAction.setIcon.calls.argsFor(0)).toEqual([
            {
                path: iconPaths.inBlockGroup,
                tabId: 100,
            },
        ]);
    });
    it('uses the light red icon on the blocked page', async () => {
        const site = new Site('chrome-extension://id/html/blocked.html');
        await updateActionIcon(site, 100, [], []);

        expect(browser.browserAction.setIcon.calls.argsFor(0)).toEqual([
            {
                path: iconPaths.inBlockGroup,
                tabId: 100,
            },
        ]);
    });
    it('uses the light red icon from a blocked page URL without a Site object', async () => {
        await updateActionIconForUrl(100, 'chrome-extension://id/html/blocked.html', [], []);

        expect(browser.browserAction.setIcon.calls.argsFor(0)).toEqual([
            {
                path: iconPaths.inBlockGroup,
                tabId: 100,
            },
        ]);
    });
    it('prefers the Block Group icon over Allowed Sites', async () => {
        const site = new Site('https://example.com');
        await updateActionIcon(site, 100, [socialGroup], ['example.com']);

        expect(browser.browserAction.setIcon.calls.argsFor(0)).toEqual([
            {
                path: iconPaths.inBlockGroup,
                tabId: 100,
            },
        ]);
    });
});
