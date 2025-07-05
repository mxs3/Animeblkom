function decodeHTMLEntities(text) {
    const entities = {
        '&#(\\d+);': (_, dec) => String.fromCharCode(dec),
        '&quot;': '"',
        '&amp;': '&',
        '&apos;': "'",
        '&lt;': '<',
        '&gt;': '>'
    };
    for (const key in entities) {
        const value = entities[key];
        text = text.replace(new RegExp(key, 'g'), value);
    }
    return text;
}

function searchResults(html) {
    if (typeof html !== 'string') return [];

    const itemRegex = /<div[^>]*class="[^"]*my-2[^"]*w-64[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    const items = html.match(itemRegex) || [];
    const results = [];

    for (const itemHtml of items) {
        const title = itemHtml.match(/<h2[^>]*>(.*?)<\/h2>/i)?.[1]?.trim() ?? '';
        const href = itemHtml.match(/<a[^>]+href="([^"]+)"/i)?.[1]?.trim() ?? '';
        const image = itemHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1]?.trim() ?? '';

        if (title && href) {
            results.push({
                title: decodeHTMLEntities(title),
                href,
                image
            });
        }
    }

    return results;
}

function extractDetails(html) {
    const details = {
        description: '',
        aliases: '',
        airdate: ''
    };

    const containerMatch = html.match(/<div class="py-4 flex flex-col gap-2">\s*((?:<p[^>]*>[\s\S]*?<\/p>\s*)+)<\/div>/);
    if (containerMatch) {
        const pBlock = containerMatch[1];
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
        const matches = [...pBlock.matchAll(pRegex)].map(m => m[1].trim()).filter(t => t.length > 0);
        details.description = decodeHTMLEntities(matches.join("\n\n"));
    }

    const airdateMatch = html.match(/<td[^>]*title="([^"]+)">[^<]+<\/td>/);
    if (airdateMatch) {
        details.airdate = airdateMatch[1].trim();
    }

    const aliasesMatch = html.match(/<div\s+class="flex flex-wrap[^"]*">([\s\S]*?)<\/div>/);
    const inner = aliasesMatch ? aliasesMatch[1] : '';
    const anchorRe = /<a[^>]*class="btn btn-md btn-plain !p-0"[^>]*>([^<]+)<\/a>/g;
    const genres = [];
    let m;
    while ((m = anchorRe.exec(inner)) !== null) {
        genres.push(m[1].trim());
    }

    if (genres.length > 0) {
        details.aliases = genres.join(", ");
    }

    return [details];
}

function extractEpisodes(html) {
    const episodes = [];
    const htmlRegex = /<a\s+[^>]*href="([^"]*?\/episode\/[^"]*?)"[^>]*>[\s\S]*?الحلقة\s+(\d+)[\s\S]*?<\/a>/gi;
    const plainTextRegex = /الحلقة\s+(\d+)/g;

    let matches;

    if ((matches = html.match(htmlRegex))) {
        matches.forEach(link => {
            const hrefMatch = link.match(/href="([^"]+)"/);
            const numberMatch = link.match(/الحلقة\s+(\d+)/);
            if (hrefMatch && numberMatch) {
                episodes.push({
                    href: hrefMatch[1],
                    number: numberMatch[1]
                });
            }
        });
    } else if ((matches = html.match(plainTextRegex))) {
        matches.forEach(match => {
            const numberMatch = match.match(/\d+/);
            if (numberMatch) {
                episodes.push({
                    href: null,
                    number: numberMatch[0]
                });
            }
        });
    }

    return episodes;
}

async function extractStreamUrl(html) {
    try {
        const sourceMatch = html.match(/data-video-source="([^"]+)"/);
        let embedUrl = sourceMatch?.[1]?.replace(/&amp;/g, '&');
        if (!embedUrl) return null;

        const cinemaMatch = html.match(/url\.searchParams\.append\(\s*['"]cinema['"]\s*,\s*(\d+)\s*\)/);
        const lastMatch = html.match(/url\.searchParams\.append\(\s*['"]last['"]\s*,\s*(\d+)\s*\)/);
        const cinemaNum = cinemaMatch ? cinemaMatch[1] : undefined;
        const lastNum = lastMatch ? lastMatch[1] : undefined;

        if (cinemaNum) embedUrl += `&cinema=${cinemaNum}`;
        if (lastNum) embedUrl += `&last=${lastNum}`;
        embedUrl += `&next-image=undefined`;

        const response = await fetchv2(embedUrl);
        if (!response.ok) return null;

        const data = await response.text();
        const qualities = extractQualities(data);

        const epMatch = html.match(/<title>[^<]*الحلقة\s*(\d+)[^<]*<\/title>/);
        const currentEp = epMatch ? Number(epMatch[1]) : null;

        let nextEpNum, nextDuration, nextSubtitle;
        if (currentEp !== null) {
            const episodeRegex = new RegExp(
                `<a[^>]+href="[^"]+/episode/[^/]+/(\\d+)"[\\s\\S]*?<span[^>]*>([^<]+)<\\/span>[\\s\\S]*?<p[^>]*>([^<]+)<\\/p>`,
                'g'
            );
            let m;
            while ((m = episodeRegex.exec(html)) !== null) {
                const num = Number(m[1]);
                if (num > currentEp) {
                    nextEpNum = num;
                    nextDuration = m[2].trim();
                    nextSubtitle = m[3].trim();
                    break;
                }
            }
        }

        if (nextEpNum != null) {
            embedUrl += `&next-title=${encodeURIComponent(nextDuration)}`;
            embedUrl += `&next-sub-title=${encodeURIComponent(nextSubtitle)}`;
        }

        return JSON.stringify({
            streams: qualities
        });
    } catch {
        return null;
    }
}

function extractQualities(html) {
    const match = html.match(/var\s+videos\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return [];

    const raw = match[1];
    const regex = /\{\s*src:\s*'([^']+)'\s*[^}]*label:\s*'([^']*)'/g;
    const list = [];
    let m;

    while ((m = regex.exec(raw)) !== null) {
        list.push({
            label: m[2],
            url: m[1]
        });
    }

    return list;
}
