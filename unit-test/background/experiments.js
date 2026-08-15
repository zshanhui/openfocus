const experiment = require('../../shared/js/background/experiments');
const settings = require('../../shared/js/background/settings');
const settingHelper = require('../helpers/settings');

describe('experiment.getVariant', () => {
    const tests = [
        {
            atb: 'v123-1ab',
            variant: 'a',
        },
        {
            atb: 'v123-1_b',
            variant: '_',
        },
        {
            atb: 'v123',
            variant: '_',
        },
        {
            atb: '',
            variant: '_',
        },
    ];

    tests.forEach((test) => {
        it(`gets variant ${test.variant} from atb ${test.atb || '(empty)'}`, () => {
            spyOn(settings, 'getSetting').and.returnValue(test.atb);
            const result = experiment.getVariant();
            expect(result).toBe(test.variant);
        });
    });
});

describe('experiment.getATBVariant', () => {
    const tests = [
        {
            atb: 'v123-1ab',
            atbVariant: 'b',
        },
        {
            atb: 'v123-1_b',
            atbVariant: 'b',
        },
        {
            atb: 'v123',
            atbVariant: '_',
        },
        {
            atb: '',
            atbVariant: '_',
        },
    ];

    tests.forEach((test) => {
        it(`gets atbVariant ${test.atbVariant} from atb ${test.atb || '(empty)'}`, () => {
            spyOn(settings, 'getSetting').and.returnValue(test.atb);
            const result = experiment.getATBVariant();
            expect(result).toBe(test.atbVariant);
        });
    });
});

describe('experiment.getDaysSinceInstall', () => {
    it('returns days since install from installedAt', () => {
        const installedAt = Date.now() - 3 * 24 * 60 * 60 * 1000;
        settingHelper.stub({ installedAt });
        expect(experiment.getDaysSinceInstall()).toBe(3);
    });

    it('returns false when install time is unknown', () => {
        settingHelper.stub({ installedAt: null, atb: null });
        expect(experiment.getDaysSinceInstall()).toBe(false);
    });
});
