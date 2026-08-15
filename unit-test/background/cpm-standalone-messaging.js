import { CPMStandaloneMessaging } from '../../shared/js/background/components/cpm-standalone-messaging';
import RemoteConfig from '../../shared/js/background/components/remote-config';
import messageHandlers from '../../shared/js/background/message-registry';
import load from '../../shared/js/background/load';
import tdsStorageStub from '../helpers/tds';
import loadHelper from '../helpers/utils';
import tdsStorage from '../../shared/js/background/storage/tds';
import { MockSettings } from '../helpers/mocks';

const baseConfig = require('../data/extension-config.json');

/**
 * Creates a config with autoconsent enabled and optional subfeatures.
 */
function makeConfigWithAutoconsent(subfeatures = {}) {
    const config = JSON.parse(JSON.stringify(baseConfig));
    config.features.autoconsent = {
        state: 'enabled',
        exceptions: [],
        features: subfeatures,
    };
    return config;
}

function constructMockComponents(config) {
    // clear message handlers to prevent conflict when registering
    Object.keys(messageHandlers).forEach((k) => delete messageHandlers[k]);
    const settings = new MockSettings();
    const remoteConfig = new RemoteConfig({ settings });
    // Prevent the constructor's async checkForUpdates() from overwriting the
    // test config via the onUpdate callback (race with DB/network loads).
    remoteConfig.ready = Promise.resolve();
    remoteConfig.updateConfig(config);
    return { remoteConfig, settings };
}

describe('CPMStandaloneMessaging', () => {
    let messaging;
    let remoteConfig;
    let settings;
    let loadUrlSpy;

    beforeAll(() => {
        const config = makeConfigWithAutoconsent();
        loadHelper.loadStub({ config });
        tdsStorageStub.stub({ config });
        return tdsStorage.getLists();
    });

    beforeEach(() => {
        const config = makeConfigWithAutoconsent({
            enabledSubfeature: {
                state: 'enabled',
            },
            disabledSubfeature: {
                state: 'disabled',
            },
        });
        const components = constructMockComponents(config);
        remoteConfig = components.remoteConfig;
        settings = components.settings;
        messaging = new CPMStandaloneMessaging({ remoteConfig });
        loadUrlSpy = spyOn(load, 'url').and.returnValue(Promise.resolve());
        // Site.isFeatureEnabled reads from the global tdsStorage.config
        tdsStorage.config = config;
    });

    describe('logMessage', () => {
        it('logs the message to console', async () => {
            spyOn(console, 'log');
            await messaging.logMessage('test message');
            expect(console.log).toHaveBeenCalledWith('test message');
        });
    });

    describe('checkAutoconsentSetting', () => {
        it('returns enabled with default user preference and feature flags', async () => {
            const result = await messaging.checkAutoconsentSetting();
            expect(result).toEqual({
                enabled: true,
                userPreference: 'default',
                featureFlags: {
                    heuristicAction: true,
                    cookiePopupPreferenceSetting: true,
                },
            });
        });
    });

    describe('checkAutoconsentEnabledForSite', () => {
        it('returns true when autoconsent is enabled for the site', async () => {
            const result = await messaging.checkAutoconsentEnabledForSite('https://example.com');
            expect(result).toBeTrue();
        });

        it('returns false when the site is in the autoconsent exceptions list', async () => {
            // Update config with an exception for example.com
            const config = makeConfigWithAutoconsent();
            config.features.autoconsent.exceptions = [{ domain: 'example.com' }];
            remoteConfig.updateConfig(config);
            tdsStorage.config = config;

            const result = await messaging.checkAutoconsentEnabledForSite('https://example.com');
            expect(result).toBeFalse();
        });

        it('returns false when autoconsent feature is disabled', async () => {
            const config = JSON.parse(JSON.stringify(baseConfig));
            config.features.autoconsent = {
                state: 'disabled',
                exceptions: [],
                features: {},
            };
            remoteConfig.updateConfig(config);
            tdsStorage.config = config;

            const result = await messaging.checkAutoconsentEnabledForSite('https://example.com');
            expect(result).toBeFalse();
        });
    });

    describe('checkSubfeatureEnabled', () => {
        it('returns true when the subfeature is enabled', async () => {
            const result = await messaging.checkSubfeatureEnabled('enabledSubfeature');
            expect(result).toBeTrue();
        });

        it('returns false when the subfeature is disabled', async () => {
            const result = await messaging.checkSubfeatureEnabled('disabledSubfeature');
            expect(result).toBeFalse();
        });

        it('returns false for a non-existent subfeature', async () => {
            const result = await messaging.checkSubfeatureEnabled('nonExistent');
            expect(result).toBeFalse();
        });
    });

    describe('sendPixel', () => {
        it('does not send remote telemetry', async () => {
            await messaging.sendPixel('someAutoconsentPixel', 'standard', { foo: 'bar' });
            await messaging.sendPixel('someAutoconsentPixel', 'daily', { foo: 'bar' });
            expect(loadUrlSpy).not.toHaveBeenCalled();
        });
    });

    describe('refreshRemoteConfig', () => {
        it('waits for remoteConfig.ready and returns the config', async () => {
            spyOn(remoteConfig, 'checkForUpdates').and.returnValue(Promise.resolve());
            const result = await messaging.refreshRemoteConfig();
            expect(remoteConfig.checkForUpdates).toHaveBeenCalledWith(false);
            expect(result).toEqual(remoteConfig.config);
        });
    });
});
