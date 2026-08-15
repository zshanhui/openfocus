const pixel = require('../../shared/js/background/pixels');

describe('pixel telemetry', () => {
    it('does not send remote pixel requests', async () => {
        await expectAsync(pixel.sendPixelRequest('test_pixel', { foo: 'bar' })).toBeResolved();
    });

    it('returns an empty URL', () => {
        expect(pixel.getURL('ep')).toEqual('');
    });
});
