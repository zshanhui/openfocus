import { normalizeBlockedSite } from './blocked-sites.js';

/**
 * StevenBlack gambling+porn hosts list (MIT). Fetched at build time only —
 * never at runtime — then converted to a static DNR ruleset.
 */
export const ADULT_GAMBLING_HOSTS_URL = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling-porn-only/hosts';

/** Chrome static DNR ruleset id (manifest rule_resources). */
export const ADULT_GAMBLING_RULESET_ID = 'adult_gambling';

export const BLOCK_ADULT_GAMBLING_SETTING = 'blockAdultGamblingSites';

/** Matches USER_BLOCKED_SITES_PRIORITY: below Sanctuary, above tracker blocking. */
export const CATEGORY_BLOCKLIST_PRIORITY = 3000000;

export const BLOCKED_SITE_PAGE_PATH = '/html/blocked.html';

/** Keep each rule well under Chrome's per-rule domain budget. */
export const DOMAINS_PER_RULE = 1000;

/**
 * Same fallback list as @duckduckgo/ddg2dnr resourceTypes (Node has no DNR enum).
 * @type {chrome.declarativeNetRequest.ResourceType[]}
 */
export const DNR_RESOURCE_TYPES = [
    'main_frame',
    'sub_frame',
    'stylesheet',
    'script',
    'image',
    'font',
    'object',
    'xmlhttprequest',
    'ping',
    'csp_report',
    'media',
    'websocket',
    'other',
];

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const SKIP_HOSTS = new Set([
    '0.0.0.0',
    'localhost',
    'localhost.localdomain',
    'local',
    'broadcasthost',
    'ip6-localhost',
    'ip6-loopback',
    'ip6-localnet',
    'ip6-mcastprefix',
    'ip6-allnodes',
    'ip6-allrouters',
    'ip6-allhosts',
]);

/**
 * Chrome requestDomains matches a host and every subdomain. Walk parent suffixes
 * the same way so navigation guards agree with the DNR ruleset.
 *
 * @param {string} hostname
 * @param {Set<string> | Iterable<string> | null | undefined} domains
 * @returns {boolean}
 */
export function hostnameMatchesCategoryList(hostname, domains) {
    if (!hostname || !domains) {
        return false;
    }
    const set = domains instanceof Set ? domains : new Set(domains);
    if (!set.size) {
        return false;
    }
    const labels = hostname.toLowerCase().replace(/\.$/, '').split('.');
    for (let i = 0; i < labels.length - 1; i++) {
        if (set.has(labels.slice(i).join('.'))) {
            return true;
        }
    }
    return false;
}

/**
 * Parse a hosts-file body (`0.0.0.0 example.com`) into unique hostnames.
 *
 * @param {unknown} text
 * @returns {{ domains: string[], skippedLines: number }}
 */
export function parseHostsFile(text) {
    if (typeof text !== 'string') {
        return { domains: [], skippedLines: 0 };
    }

    const domains = new Set();
    let skippedLines = 0;

    for (const rawLine of text.split(/\r?\n/)) {
        const withoutComment = rawLine.replace(/#.*$/, '').trim();
        if (!withoutComment) {
            continue;
        }

        const tokens = withoutComment.split(/\s+/);
        const hostTokens = tokens.length >= 2 && looksLikeAddress(tokens[0]) ? tokens.slice(1) : tokens;

        let added = 0;
        for (const token of hostTokens) {
            const domain = normalizeHostsEntry(token);
            if (domain) {
                domains.add(domain);
                added += 1;
            }
        }
        if (added === 0) {
            skippedLines += 1;
        }
    }

    return {
        domains: Array.from(domains).sort(),
        skippedLines,
    };
}

/**
 * Drop hostnames already covered by a parent in the same set.
 * Chrome `requestDomains` matches the domain and every subdomain.
 *
 * @param {string[]} domains
 * @returns {string[]}
 */
export function dropCoveredSubdomains(domains) {
    const set = new Set(domains);
    return domains.filter((domain) => {
        const labels = domain.split('.');
        for (let i = 1; i < labels.length; i++) {
            if (set.has(labels.slice(i).join('.'))) {
                return false;
            }
        }
        return true;
    });
}

/**
 * @param {string[]} domains
 * @param {number} [size]
 * @returns {string[][]}
 */
export function chunkDomains(domains, size = DOMAINS_PER_RULE) {
    const chunkSize = Number(size);
    if (!Number.isInteger(chunkSize) || chunkSize < 1) {
        throw new Error(`domainsPerRule must be a positive integer, got ${size}`);
    }

    const chunks = [];
    for (let i = 0; i < domains.length; i += chunkSize) {
        chunks.push(domains.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Convert a hosts-file body into a Chrome DNR ruleset array.
 * Main-frame hits redirect to the extension blocked page; other types are blocked.
 *
 * @param {unknown} hostsText
 * @param {{ domainsPerRule?: number, source?: string }} [options]
 * @returns {{ rules: object[], metadata: object }}
 */
export function generateCategoryDnrRuleset(hostsText, options = {}) {
    const { domains: parsedDomains, skippedLines } = parseHostsFile(hostsText);
    const domains = dropCoveredSubdomains(parsedDomains);
    const domainsPerRule = options.domainsPerRule ?? DOMAINS_PER_RULE;
    const chunks = chunkDomains(domains, domainsPerRule);
    const subresourceTypes = DNR_RESOURCE_TYPES.filter((resourceType) => resourceType !== 'main_frame');

    /** @type {object[]} */
    const rules = [];
    let id = 1;

    for (const requestDomains of chunks) {
        rules.push({
            id: id++,
            priority: CATEGORY_BLOCKLIST_PRIORITY,
            action: {
                type: 'redirect',
                redirect: {
                    extensionPath: BLOCKED_SITE_PAGE_PATH,
                },
            },
            condition: {
                requestDomains,
                resourceTypes: ['main_frame'],
            },
        });
    }

    for (const requestDomains of chunks) {
        rules.push({
            id: id++,
            priority: CATEGORY_BLOCKLIST_PRIORITY,
            action: {
                type: 'block',
            },
            condition: {
                requestDomains,
                resourceTypes: subresourceTypes,
            },
        });
    }

    return {
        rules,
        metadata: {
            source: options.source ?? ADULT_GAMBLING_HOSTS_URL,
            parsedDomainCount: parsedDomains.length,
            ruleDomainCount: domains.length,
            droppedCoveredSubdomainCount: parsedDomains.length - domains.length,
            skippedLines,
            redirectRuleCount: chunks.length,
            blockRuleCount: chunks.length,
            domainsPerRule,
        },
    };
}

/**
 * @param {string} token
 * @returns {boolean}
 */
function looksLikeAddress(token) {
    return IPV4.test(token) || token.includes(':');
}

/**
 * @param {string} token
 * @returns {string | null}
 */
function normalizeHostsEntry(token) {
    const host = token.trim().toLowerCase().replace(/\.$/, '');
    if (!host || SKIP_HOSTS.has(host) || looksLikeAddress(host) || !host.includes('.')) {
        return null;
    }
    return normalizeBlockedSite(host);
}
