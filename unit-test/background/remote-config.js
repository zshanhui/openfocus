import RemoteConfig from '../../shared/js/background/components/remote-config';
import messageHandlers from '../../shared/js/background/message-registry';

class MockSettings {
    constructor() {
        this.mockSettingData = new Map();
        this.ready = () => Promise.resolve();
    }

    getSetting(key) {
        return structuredClone(this.mockSettingData.get(key));
    }
    updateSetting(key, value) {
        this.mockSettingData.set(key, value);
    }
}

function constructMockRemoteConfig() {
    Object.keys(messageHandlers).forEach((k) => delete messageHandlers[k]);
    return new RemoteConfig({ settings: new MockSettings() });
}

describe('remote config', () => {
    it('honors published subfeature state and ignores DDG rollout/cohort fields', () => {
        const config = constructMockRemoteConfig();
        config.updateConfig({
            features: {
                testFeature: {
                    state: 'enabled',
                    features: {
                        fooFeature: {
                            state: 'enabled',
                            rollout: { steps: [{ percent: 0 }] },
                            cohorts: [{ name: 'treatment', weight: 1 }],
                        },
                        offFeature: {
                            state: 'disabled',
                        },
                    },
                },
            },
        });

        expect(config.isFeatureEnabled('testFeature')).toBeTrue();
        expect(config.isSubFeatureEnabled('testFeature', 'fooFeature')).toBeTrue();
        expect(config.isSubFeatureEnabled('testFeature', 'offFeature')).toBeFalse();
        expect(config.settings.getSetting('abn.testFeature.fooFeature.cohort')).toBeUndefined();
        expect(config.settings.getSetting('rollouts.testFeature.fooFeature.roll')).toBeUndefined();
    });

    it('returns false for unknown features', () => {
        const config = constructMockRemoteConfig();
        config.updateConfig({ features: {} });
        expect(config.isFeatureEnabled('missing')).toBeFalse();
        expect(config.isSubFeatureEnabled('missing', 'alsoMissing')).toBeFalse();
    });
});
