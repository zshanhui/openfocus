import { DAODEJING_QUOTES, pickDaodejingQuote } from '../../shared/js/shared-utils/daodejing-quotes';

describe('daodejing quotes', () => {
    it('has unique chapter passages', () => {
        expect(DAODEJING_QUOTES.length).toBe(10);
        const chapters = DAODEJING_QUOTES.map((quote) => quote.chapter);
        expect(new Set(chapters).size).toBe(10);
        for (const quote of DAODEJING_QUOTES) {
            expect(quote.chinese).toMatch(/\S/);
            expect(quote.english).toMatch(/\S/);
        }
    });

    it('keeps the same quote from 6:00 until the next 6:00', () => {
        const evening = new Date(2026, 7, 24, 22, 0, 0).getTime();
        const beforeReset = new Date(2026, 7, 25, 5, 59, 0).getTime();
        const atReset = new Date(2026, 7, 25, 6, 0, 0).getTime();
        const afternoon = new Date(2026, 7, 25, 18, 0, 0).getTime();

        expect(pickDaodejingQuote(evening)).toEqual(pickDaodejingQuote(beforeReset));
        expect(pickDaodejingQuote(atReset)).toEqual(pickDaodejingQuote(afternoon));
        expect(pickDaodejingQuote(evening)).toEqual(pickDaodejingQuote(evening));
    });

    it('selects a new quote when the focus day rolls over at 6:00', () => {
        let changed = false;
        for (let day = 1; day <= 40; day++) {
            const beforeReset = new Date(2026, 7, day, 5, 59, 0).getTime();
            const atReset = new Date(2026, 7, day, 6, 0, 0).getTime();
            if (pickDaodejingQuote(beforeReset).chapter !== pickDaodejingQuote(atReset).chapter) {
                changed = true;
                break;
            }
        }
        expect(changed).toBe(true);
    });
});
