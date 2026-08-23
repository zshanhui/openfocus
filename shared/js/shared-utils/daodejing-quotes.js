import { getPeriodKey } from './site-groups';

/**
 * Public-domain Daodejing passages for the blocked-site page.
 * English is a close rendering of the received Chinese text, not a copyrighted translation.
 *
 * @typedef {{ chapter: number, chinese: string, english: string }} DaodejingQuote
 */

/** @type {readonly DaodejingQuote[]} */
export const DAODEJING_QUOTES = Object.freeze([
    {
        chapter: 3,
        chinese: '不见可欲，使民心不乱。',
        english: 'Do not display what can be desired, and the mind will not be disturbed.',
    },
    {
        chapter: 9,
        chinese: '持而盈之，不如其已。',
        english: 'Better to stop in time than fill to overflowing.',
    },
    {
        chapter: 12,
        chinese: '驰骋畋猎，令人心发狂。',
        english: 'Racing and hunting madden the mind.',
    },
    {
        chapter: 15,
        chinese: '孰能浊以静之徐清？',
        english: 'Who can wait quietly while the mud settles?',
    },
    {
        chapter: 16,
        chinese: '致虚极，守静笃。',
        english: 'Attain complete emptiness. Hold fast to stillness.',
    },
    {
        chapter: 26,
        chinese: '重为轻根，静为躁君。',
        english: 'Heaviness is the root of lightness; stillness is the master of unrest.',
    },
    {
        chapter: 33,
        chinese: '胜人者有力，自胜者强。',
        english: 'Those who overcome others have force; those who overcome themselves are strong.',
    },
    {
        chapter: 44,
        chinese: '知足不辱，知止不殆。',
        english: 'Know what is enough, and you will not be disgraced. Know when to stop, and you will not be in danger.',
    },
    {
        chapter: 46,
        chinese: '祸莫大于不知足，咎莫大于欲得。',
        english: 'No disaster is greater than not knowing what is enough; no fault is greater than the desire to get.',
    },
    {
        chapter: 52,
        chinese: '塞其兑，闭其门，终身不勤。',
        english: 'Block the openings, shut the doors, and all your life you will not toil.',
    },
]);

/**
 * @param {string} value
 * @returns {number}
 */
function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
    }
    return hash;
}

/**
 * One quote for the whole focus day. The day resets at 6:00 local time,
 * matching Block Group usage.
 *
 * @param {number | Date} [now]
 * @returns {DaodejingQuote}
 */
export function pickDaodejingQuote(now = Date.now()) {
    const periodKey = getPeriodKey(now);
    const count = DAODEJING_QUOTES.length;
    const index = ((hashString(periodKey) % count) + count) % count;
    return DAODEJING_QUOTES[index];
}
