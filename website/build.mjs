#!/usr/bin/env node
/**
 * Builds website/index.html from copy.yaml and styles.css.
 * Usage: node website/build.mjs
 *        node website/build.mjs --watch
 */

import { readFileSync, watch, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const watchMode = process.argv.includes('--watch');

function loadCopyAndCss() {
    return {
        copy: loadYaml(readFileSync(join(root, 'copy.yaml'), 'utf8')),
        css: readFileSync(join(root, 'styles.css'), 'utf8').trim(),
    };
}

function build() {
    const { copy, css } = loadCopyAndCss();
    writePage(copy, css);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatInline(value) {
    const escaped = escapeHtml(value);
    return escaped
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function paragraphs(items = []) {
    return items.map((text) => `            <p>${formatInline(text)}</p>`).join('\n');
}

function list(items = []) {
    if (!items.length) {
        return '';
    }
    const lis = items.map((text) => `              <li>${formatInline(text)}</li>`).join('\n');
    return `            <ul>\n${lis}\n            </ul>`;
}

function privacySection(section) {
    const parts = [`          <h3>${escapeHtml(section.title)}</h3>`];
    if (section.paragraphs?.length) {
        parts.push(paragraphs(section.paragraphs));
    }
    if (section.list?.length) {
        parts.push(list(section.list));
    }
    if (section.after?.length) {
        parts.push(paragraphs(section.after));
    }
    return parts.join('\n');
}

function galleryItems(items = []) {
    return items
        .map(
            (item) => `        <a class="gallery-item" href="#shot-${escapeHtml(item.id)}">
          <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async" />
          <span>${escapeHtml(item.caption)}</span>
        </a>`,
        )
        .join('\n');
}

function galleryLightboxes(items = []) {
    return items
        .map(
            (item) => `    <div class="lightbox" id="shot-${escapeHtml(item.id)}" role="dialog" aria-modal="true" aria-label="${escapeHtml(item.caption)}">
      <a class="lightbox-backdrop" href="#gallery" aria-label="Close"></a>
      <figure class="lightbox-figure">
        <a class="lightbox-close" href="#gallery" aria-label="Close">&times;</a>
        <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" />
        <figcaption>${escapeHtml(item.caption)}</figcaption>
      </figure>
    </div>`,
        )
        .join('\n');
}

function writePage(copy, css) {
    const featureCards = copy.features
        .map(
            (feature) => `        <article class="feature">
          <h2>${escapeHtml(feature.title)}</h2>
          <p>${formatInline(feature.body)}</p>
        </article>`,
        )
        .join('\n');

    const shots = copy.gallery?.items ?? [];

    const html = `<!DOCTYPE html>
<!-- Generated from copy.yaml. Edit website/copy.yaml, then run: node website/build.mjs -->
<html lang="${escapeHtml(copy.meta.lang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.meta.title)}</title>
    <meta name="description" content="${escapeHtml(copy.meta.description)}" />
    <link rel="icon" type="image/png" href="favicon.png" />
    <link rel="canonical" href="${escapeHtml(copy.meta.canonical)}" />
    <meta property="og:title" content="${escapeHtml(copy.meta.og_title)}" />
    <meta property="og:description" content="${escapeHtml(copy.meta.og_description)}" />
    <meta property="og:image" content="icon.png" />
    <meta property="og:type" content="website" />
    <style>
${css}
    </style>
  </head>
  <body>
    <header>
      <div class="wrap nav">
        <a class="brand" href="#top">
          <img src="icon.png" width="36" height="36" alt="" />
          ${escapeHtml(copy.brand)}
        </a>
        <nav aria-label="Page">
          <a href="#features">${escapeHtml(copy.nav.features)}</a>
          <a href="#gallery">${escapeHtml(copy.nav.gallery)}</a>
          <a href="#privacy">${escapeHtml(copy.nav.privacy)}</a>
          <a href="${escapeHtml(copy.meta.source_url)}">${escapeHtml(copy.nav.source)}</a>
        </nav>
      </div>
    </header>

    <main id="top">
      <section class="wrap hero">
        <p class="eyebrow">${escapeHtml(copy.hero.eyebrow)}</p>
        <h1>${copy.hero.title.map((line) => escapeHtml(line)).join('<br />')}</h1>
        <p class="lede">${formatInline(copy.hero.lede)}</p>
        <div class="actions">
          <a class="btn" href="${escapeHtml(copy.hero.primary_cta.href)}">${escapeHtml(copy.hero.primary_cta.label)}</a>
          <a class="btn btn-ghost" href="${escapeHtml(copy.hero.secondary_cta.href)}">${escapeHtml(copy.hero.secondary_cta.label)}</a>
        </div>
      </section>

      <section class="wrap features" id="features">
${featureCards}
      </section>

      <section class="gallery" id="gallery">
        <div class="gallery-wrap">
          <h2>${escapeHtml(copy.gallery.title)}</h2>
          <p class="gallery-lede">${formatInline(copy.gallery.lede)}</p>
          <div class="gallery-grid">
${galleryItems(shots)}
          </div>
        </div>
      </section>

      <section class="privacy" id="privacy">
        <div class="wrap">
          <h2>${escapeHtml(copy.privacy.title)}</h2>
          <p class="updated">${escapeHtml(copy.privacy.updated)}</p>

          <div class="callout">
            <strong>${escapeHtml(copy.privacy.callout.title)}</strong>
            ${formatInline(copy.privacy.callout.body)}
          </div>

${copy.privacy.sections.map(privacySection).join('\n\n')}
        </div>
      </section>
    </main>

    <footer>
      <div class="wrap">
        <span>${escapeHtml(copy.footer.credit)}</span>
        <span>
          <a href="${escapeHtml(copy.meta.source_url)}">${escapeHtml(copy.footer.github)}</a>
          ·
          <a href="#privacy">${escapeHtml(copy.footer.privacy)}</a>
        </span>
      </div>
    </footer>
${galleryLightboxes(shots)}
    <script>
      const closeLightbox = () => {
        if (!location.hash.startsWith("#shot-")) {
          return;
        }
        location.hash = "#gallery";
        document.getElementById("gallery")?.scrollIntoView();
      };
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeLightbox();
        }
      });
      window.addEventListener("hashchange", () => {
        document.body.style.overflow = location.hash.startsWith("#shot-") ? "hidden" : "";
      });
    </script>
  </body>
</html>
`;

    writeFileSync(join(root, 'index.html'), html);
    console.log('Wrote website/index.html from website/copy.yaml');
}

build();

if (watchMode) {
    let timer;
    const rebuild = (filename) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            try {
                build();
            } catch (error) {
                console.error(`Build failed after ${filename} changed:`, error.message);
            }
        }, 80);
    };
    watch(join(root, 'copy.yaml'), (event, filename) => rebuild(filename || 'copy.yaml'));
    watch(join(root, 'styles.css'), (event, filename) => rebuild(filename || 'styles.css'));
    console.log('Watching website/copy.yaml and website/styles.css');
}

function loadYaml(source) {
    const lines = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
    return readBlock(lines, 0, 0).value;
}

function indentOf(line) {
    const match = line.match(/^ */);
    return match ? match[0].length : 0;
}

function isBlankOrComment(line) {
    return /^\s*(#.*)?$/.test(line);
}

function stripComment(line) {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
        } else if (ch === '"' && !inSingle && line[i - 1] !== '\\') {
            inDouble = !inDouble;
        } else if (ch === '#' && !inSingle && !inDouble && (i === 0 || line[i - 1] === ' ')) {
            return line.slice(0, i).trimEnd();
        }
    }
    return line;
}

function parseScalar(raw) {
    const value = raw.trim();
    if (value === '' || value === '~' || value === 'null') {
        return null;
    }
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}

function isBlockHeader(value) {
    return /^[|>][+-]?$/.test(value);
}

function readBlockScalar(lines, start, parentIndent, folded) {
    const chunks = [];
    let i = start;
    let contentIndent = null;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
            if (i + 1 < lines.length && indentOf(lines[i + 1]) > parentIndent) {
                chunks.push('');
                i += 1;
                continue;
            }
            break;
        }
        if (isBlankOrComment(line)) {
            i += 1;
            continue;
        }
        const indent = indentOf(line);
        if (indent <= parentIndent) {
            break;
        }
        if (contentIndent === null) {
            contentIndent = indent;
        }
        chunks.push(line.slice(contentIndent));
        i += 1;
    }
    const text = folded
        ? chunks
              .join('\n')
              .replace(/\n+/g, (match) => (match.length > 1 ? match : ' '))
              .trim()
        : chunks.join('\n').replace(/\s+$/, '');
    return { value: text, next: i };
}

function readBlock(lines, start, minIndent) {
    let i = start;
    while (i < lines.length && isBlankOrComment(lines[i])) {
        i += 1;
    }
    if (i >= lines.length) {
        return { value: {}, next: i };
    }

    const first = stripComment(lines[i]);
    const baseIndent = indentOf(first);
    if (baseIndent < minIndent) {
        return { value: {}, next: i };
    }

    const isList = first.trimStart().startsWith('- ');
    if (isList) {
        const items = [];
        while (i < lines.length) {
            if (isBlankOrComment(lines[i])) {
                i += 1;
                continue;
            }
            const line = stripComment(lines[i]);
            const indent = indentOf(line);
            if (indent !== baseIndent || !line.trimStart().startsWith('- ')) {
                break;
            }
            const rest = line.trimStart().slice(2);
            const colon = rest.indexOf(':');
            if (isBlockHeader(rest)) {
                const block = readBlockScalar(lines, i + 1, indent, rest.startsWith('>'));
                items.push(block.value);
                i = block.next;
                continue;
            }
            if (rest === '' || colon === -1) {
                items.push(parseScalar(rest));
                i += 1;
                continue;
            }
            const key = rest.slice(0, colon).trim();
            const after = rest.slice(colon + 1).trim();
            const item = {};
            i += 1;
            if (isBlockHeader(after)) {
                const block = readBlockScalar(lines, i, indent + 2, after.startsWith('>'));
                item[key] = block.value;
                i = block.next;
            } else if (after === '') {
                const nested = readBlock(lines, i, indent + 1);
                item[key] = nested.value;
                i = nested.next;
            } else {
                item[key] = parseScalar(after);
            }
            const extra = readBlock(lines, i, indent + 1);
            if (extra.value && typeof extra.value === 'object' && !Array.isArray(extra.value)) {
                Object.assign(item, extra.value);
            }
            i = extra.next;
            items.push(item);
        }
        return { value: items, next: i };
    }

    const object = {};
    while (i < lines.length) {
        if (isBlankOrComment(lines[i])) {
            i += 1;
            continue;
        }
        const line = stripComment(lines[i]);
        const indent = indentOf(line);
        if (indent < baseIndent || line.trimStart().startsWith('- ')) {
            break;
        }
        if (indent !== baseIndent) {
            throw new Error(`Unexpected indent at line ${i + 1}: ${lines[i]}`);
        }
        const trimmed = line.trim();
        const colon = trimmed.indexOf(':');
        if (colon === -1) {
            throw new Error(`Expected key at line ${i + 1}: ${trimmed}`);
        }
        const key = trimmed.slice(0, colon).trim();
        const after = trimmed.slice(colon + 1).trim();
        i += 1;
        if (isBlockHeader(after)) {
            const block = readBlockScalar(lines, i, indent, after.startsWith('>'));
            object[key] = block.value;
            i = block.next;
        } else if (after === '') {
            const nested = readBlock(lines, i, indent + 1);
            object[key] = nested.value;
            i = nested.next;
        } else {
            object[key] = parseScalar(after);
        }
    }
    return { value: object, next: i };
}
