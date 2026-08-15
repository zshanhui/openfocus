#!/usr/bin/env node

/**
 * Download the StevenBlack gambling+porn hosts file and write a Chrome DNR ruleset.
 *
 * Usage:
 *   node scripts/generate-adult-gambling-ruleset.mjs
 *   node scripts/generate-adult-gambling-ruleset.mjs --input ./hosts --output ./rules.json
 *
 * The hosts list is MIT-licensed (StevenBlack/hosts). This script is build-time
 * only — the extension must not fetch the remote list at runtime.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADULT_GAMBLING_HOSTS_URL, generateCategoryDnrRuleset } from '../shared/js/shared-utils/category-dnr-ruleset.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundledDir = resolve(repoRoot, 'shared/data/bundled');
const buildDir = resolve(repoRoot, 'build');

const DEFAULT_HOSTS_PATH = resolve(buildDir, 'adult-gambling-hosts.txt');
const DEFAULT_RULES_PATH = resolve(bundledDir, 'adult-gambling-rules.json');
const DEFAULT_META_PATH = resolve(bundledDir, 'adult-gambling-ruleset-meta.json');

function parseArgs(argv) {
    const options = {
        source: ADULT_GAMBLING_HOSTS_URL,
        input: null,
        output: DEFAULT_RULES_PATH,
        hostsOutput: DEFAULT_HOSTS_PATH,
        metaOutput: DEFAULT_META_PATH,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = argv[i + 1];
        if (arg === '--source' && next) {
            options.source = next;
            i += 1;
        } else if (arg === '--input' && next) {
            options.input = resolve(next);
            i += 1;
        } else if (arg === '--output' && next) {
            options.output = resolve(next);
            i += 1;
        } else if (arg === '--hosts-output' && next) {
            options.hostsOutput = resolve(next);
            i += 1;
        } else if (arg === '--meta-output' && next) {
            options.metaOutput = resolve(next);
            i += 1;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

async function loadHostsText({ source, input }) {
    if (input) {
        return readFile(input, 'utf8');
    }

    const response = await fetch(source);
    if (!response.ok) {
        throw new Error(`Failed to download hosts file: ${response.status} ${response.statusText} (${source})`);
    }
    return response.text();
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        console.log(`Usage: node scripts/generate-adult-gambling-ruleset.mjs [options]

  --source URL          Hosts file URL (default: StevenBlack gambling-porn-only)
  --input PATH          Read a local hosts file instead of downloading
  --output PATH         DNR JSON array (default: shared/data/bundled/adult-gambling-rules.json)
  --hosts-output PATH   Save the raw hosts file (default: shared/data/bundled/adult-gambling-hosts.txt)
  --meta-output PATH    Write generation stats JSON
`);
        return;
    }

    const hostsText = await loadHostsText(options);
    const { rules, metadata } = generateCategoryDnrRuleset(hostsText, { source: options.source });
    const generatedAt = new Date().toISOString();
    const meta = { ...metadata, generatedAt, ruleCount: rules.length };

    await mkdir(dirname(options.output), { recursive: true });
    if (!options.input) {
        await mkdir(dirname(options.hostsOutput), { recursive: true });
        await writeFile(options.hostsOutput, hostsText);
    }
    await writeFile(options.output, JSON.stringify(rules));
    await writeFile(options.metaOutput, `${JSON.stringify(meta, null, 2)}\n`);

    console.log(`Wrote ${rules.length} DNR rules (${meta.ruleDomainCount} domains) to ${options.output}`);
    console.log(JSON.stringify(meta, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
