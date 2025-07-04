async function searchResults(keyword) {
    const encodedKeyword = encodeURIComponent(keyword);
    const response = await fetchv2(`https://animeblkom.com/search?query=${encodedKeyword}`, {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://animeblkom.com/'
    });

    const html = await response.text();
    const results = [];
    const regex = /<a href="(\/anime\/[^"]+)"[^>]*>\s*<div class="anime-card[^"]*">\s*<img[^>]+src="([^"]+)"[^>]*>\s*<h3[^>]*>(.*?)<\/h3>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        results.push({
            title: decodeHTMLEntities(match[3].trim()),
            href: `https://animeblkom.com${match[1]}`,
            image: match[2].startsWith('http') ? match[2] : `https://animeblkom.com${match[2]}`
        });
    }

    if (results.length === 0) {
        return JSON.stringify([{ title: 'No results found', href: '', image: '' }]);
    }

    return JSON.stringify(results);
}

async function extractDetails(url) {
    const response = await fetchv2(url, {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://animeblkom.com/'
    });

    const html = await response.text();
    const descMatch = html.match(/<div class="synopsis">([^<]+)<\/div>/i);
    const desc = descMatch ? decodeHTMLEntities(descMatch[1].trim()) : 'N/A';

    const aliasMatches = [...html.matchAll(/<span class="other-name">([^<]+)<\/span>/g)];
    const aliases = aliasMatches.map(m => decodeHTMLEntities(m[1].trim())).join(', ') || 'N/A';

    const yearMatch = html.match(/<span class="year">(\d{4})<\/span>/);
    const year = yearMatch ? yearMatch[1] : 'N/A';

    return JSON.stringify([{ description: desc, aliases, airdate: year }]);
}

async function extractEpisodes(url) {
    const response = await fetchv2(url, {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://animeblkom.com/'
    });

    const html = await response.text();
    const episodes = [];
    const regex = /<a href="(\/episode\/[^"]+)"[^>]*>\s*<div class="episode-card[^>]*>\s*<div class="episode-number">([^<]+)<\/div>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        episodes.push({
            href: `https://animeblkom.com${match[1]}`,
            number: parseInt(match[2].replace(/\D/g, ''))
        });
    }

    return JSON.stringify(episodes);
}

async function extractStreamUrl(url) {
    const response = await fetchv2(url, {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://animeblkom.com/'
    });

    const html = await response.text();
    const streamRegex = /data-video="([^"]+)"/;
    const match = html.match(streamRegex);

    if (!match) {
        return JSON.stringify({ streams: [] });
    }

    const streamUrl = match[1];
    const result = {
        streams: [{
            title: '[1080p]',
            streamUrl,
            headers: { referer: streamUrl },
            subtitles: null
        }]
    };

    return JSON.stringify(result);
}

function decodeHTMLEntities(text) {
    const entities = {
        '&quot;': '"',
        '&amp;': '&',
        '&apos;': "'",
        '&lt;': '<',
        '&gt;': '>'
    };

    text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
    for (const [entity, char] of Object.entries(entities)) {
        text = text.replace(new RegExp(entity, 'g'), char);
    }
    return text;
}
