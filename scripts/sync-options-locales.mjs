// Rebuild shared/locales/<lang>/options.json from English keys/notes
// plus per-locale title translations for OpenFocusd-only strings.
import fs from 'fs';
import path from 'path';

const localesDir = path.join(import.meta.dirname, '../shared/locales');
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en/options.json'), 'utf8'));

const additions = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'options-locale-additions.json'), 'utf8'));

const shared = {
    searchEngineDuckDuckGo: 'DuckDuckGo',
    searchEngineBrave: 'Brave Search',
    addWebsitePlaceholder: 'example.com',
    adultGamblingDisableMath: '{a} × {b} =',
    removeWebsiteMath: '{a} + {b} =',
};

function placeholders(text) {
    return [...(text.matchAll(/\{[a-zA-Z0-9_]+\}/g) || [])].map((m) => m[0]).sort();
}

function mergeLocale(lang) {
    const file = path.join(localesDir, lang, 'options.json');
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    const extra = { ...shared, ...(additions[lang] || {}) };
    const out = { smartling: en.smartling };
    for (const [key, value] of Object.entries(en)) {
        if (key === 'smartling') continue;
        const title = extra[key] ?? existing[key]?.title ?? value.title;
        out[key] = { title, note: value.note };
        const enPh = placeholders(value.title).join(',');
        const locPh = placeholders(title).join(',');
        if (enPh !== locPh) {
            throw new Error(`${lang}.${key} placeholder mismatch: en=${enPh} loc=${locPh}`);
        }
    }
    fs.writeFileSync(file, JSON.stringify(out, null, 4) + '\n');
}

const locales = fs.readdirSync(localesDir).filter((d) => d !== 'en' && fs.statSync(path.join(localesDir, d)).isDirectory());
for (const lang of locales) {
    mergeLocale(lang);
}
console.log('Synced options.json for', locales.join(', '));
