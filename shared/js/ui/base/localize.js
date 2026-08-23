import i18next from 'i18next';
import ICU from 'i18next-icu';
import { getUserLocale } from '../../background/i18n';
import resources from './locale-resources';

const locale = getUserLocale();

i18next.use(ICU).init({
    initImmediate: false,
    fallbackLng: 'en',
    lng: locale,
    ns: ['shared', 'options', 'feedback'],
    defaultNS: 'shared',
    resources,
});

if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

module.exports = i18next;
