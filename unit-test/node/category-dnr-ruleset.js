import {
    BLOCKED_SITE_PAGE_PATH,
    CATEGORY_BLOCKLIST_PRIORITY,
    DNR_RESOURCE_TYPES,
    chunkDomains,
    dropCoveredSubdomains,
    generateCategoryDnrRuleset,
    hostnameMatchesCategoryList,
    parseHostsFile,
} from '../../shared/js/shared-utils/category-dnr-ruleset';

const FIXTURE = `
# Title: fixture
127.0.0.1 localhost
0.0.0.0 0.0.0.0
0.0.0.0 Example.COM
0.0.0.0 www.example.com # covered by apex
0.0.0.0 ads.example.com
0.0.0.0 unique.other.com
127.0.0.1 gambling.example
# comment only
not-a-valid-line !!!
0.0.0.0
`;

describe('category DNR ruleset', () => {
    it('parses hosts entries, skips comments and local names, and dedupes', () => {
        expect(parseHostsFile(FIXTURE)).toEqual({
            domains: ['ads.example.com', 'example.com', 'gambling.example', 'unique.other.com', 'www.example.com'],
            skippedLines: 4,
        });
    });

    it('drops subdomains already covered by a parent requestDomains match', () => {
        expect(dropCoveredSubdomains(['ads.example.com', 'example.com', 'unique.other.com', 'www.example.com'])).toEqual([
            'example.com',
            'unique.other.com',
        ]);
    });

    it('keeps sibling subdomains when the apex is absent', () => {
        expect(dropCoveredSubdomains(['a.foo.com', 'b.foo.com'])).toEqual(['a.foo.com', 'b.foo.com']);
    });

    it('chunks domains into fixed-size groups', () => {
        expect(chunkDomains(['a.com', 'b.com', 'c.com'], 2)).toEqual([['a.com', 'b.com'], ['c.com']]);
    });

    it('emits redirect then block rules in the DNR shape Chrome static rulesets expect', () => {
        const { rules, metadata } = generateCategoryDnrRuleset(FIXTURE, { domainsPerRule: 2, source: 'fixture' });
        const subresourceTypes = DNR_RESOURCE_TYPES.filter((type) => type !== 'main_frame');

        expect(metadata).toEqual({
            source: 'fixture',
            parsedDomainCount: 5,
            ruleDomainCount: 3,
            droppedCoveredSubdomainCount: 2,
            skippedLines: 4,
            redirectRuleCount: 2,
            blockRuleCount: 2,
            domainsPerRule: 2,
        });

        expect(rules).toHaveSize(4);
        expect(rules.map((rule) => rule.id)).toEqual([1, 2, 3, 4]);
        expect(rules.slice(0, 2).every((rule) => rule.action.type === 'redirect')).toBeTrue();
        expect(rules.slice(2).every((rule) => rule.action.type === 'block')).toBeTrue();

        expect(rules[0]).toEqual({
            id: 1,
            priority: CATEGORY_BLOCKLIST_PRIORITY,
            action: {
                type: 'redirect',
                redirect: {
                    extensionPath: BLOCKED_SITE_PAGE_PATH,
                },
            },
            condition: {
                requestDomains: ['example.com', 'gambling.example'],
                resourceTypes: ['main_frame'],
            },
        });

        expect(rules[2].action).toEqual({ type: 'block' });
        expect(rules[2].condition.resourceTypes).toEqual(subresourceTypes);
        expect(rules[2].condition.requestDomains).toEqual(['example.com', 'gambling.example']);
        expect(rules[3].condition.requestDomains).toEqual(['unique.other.com']);
    });

    it('returns no rules for an empty hosts file', () => {
        expect(generateCategoryDnrRuleset('# just a comment\n').rules).toEqual([]);
    });

    it('matches a hostname and its subdomains the way requestDomains does', () => {
        const domains = new Set(['example.com', 'unique.other.com']);
        expect(hostnameMatchesCategoryList('example.com', domains)).toBeTrue();
        expect(hostnameMatchesCategoryList('www.example.com', domains)).toBeTrue();
        expect(hostnameMatchesCategoryList('unique.other.com', domains)).toBeTrue();
        expect(hostnameMatchesCategoryList('other.com', domains)).toBeFalse();
        expect(hostnameMatchesCategoryList('khanacademy.org', domains)).toBeFalse();
    });
});
