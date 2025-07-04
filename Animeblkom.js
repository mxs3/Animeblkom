async function searchResults(query) {
    try {
        const encoded = encodeURIComponent(query);
        const response = await fetchv2(`https://animeblkom.com/search?keyword=${encoded}`, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://animeblkom.com/'
        });
        const html = await response.text();
        const results = [];
        const regex = /<div class="anime-card">([\s\S]*?)<\/div>\s*<\/div>/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const block = match[1];
            const titleMatch = block.match(/<h3[^>]*>(.*?)<\/h3>/);
            const hrefMatch = block.match(/<a href="([^"]+)"/);
            const imageMatch = block.match(/<img[^>]*src="([^"]+)"/);
            if (titleMatch && hrefMatch) {
                results.push({
                    title: decodeHTMLEntities(titleMatch[1]),
                    href: hrefMatch[1].startsWith('http') ? hrefMatch[1] : 'https://animeblkom.com' + hrefMatch[1],
                    image: imageMatch ? imageMatch[1] : ''
                });
            }
        }

        if (results.length > 0) return JSON.stringify(results);

        const fallback = await fetchv2(`https://api.consumet.org/anime/gogoanime/${encoded}`);
        const apiData = await fallback.json();
        if (Array.isArray(apiData) && apiData.length > 0) {
            const fallbackResults = apiData.map(item => ({
                title: item.title || 'Unknown',
                href: item.url || '',
                image: item.image || ''
            }));
            return JSON.stringify(fallbackResults);
        }

        return JSON.stringify([{
            title: 'No results found',
            href: '',
            image: ''
        }]);
    } catch (e) {
        return JSON.stringify([{
            title: 'Error',
            href: '',
            image: '',
            error: e.message
        }]);
    }
}

async function extractDetails(url) {
    try {
        const html = await (await fetchv2(url)).text();
        const descriptionMatch = html.match(/<div class="story">[\s\S]*?<p>(.*?)<\/p>/);
        const description = descriptionMatch ? decodeHTMLEntities(descriptionMatch[1].trim()) : 'N/A';
        return JSON.stringify([{
            description,
            aliases: 'N/A',
            airdate: 'N/A'
        }]);
    } catch (e) {
        return JSON.stringify([{
            description: 'N/A',
            aliases: 'N/A',
            airdate: 'N/A'
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        const html = await (await fetchv2(url)).text();
        const regex = /<a[^>]*href="([^"]+)"[^>]*>[^<]*الحلقة[^<]*<\/a>/g;
        const episodes = [];
        let match;
        let i = 1;
        while ((match = regex.exec(html)) !== null) {
            episodes.push({
                number: i++,
                href: match[1].startsWith('http') ? match[1] : 'https://animeblkom.com' + match[1]
            });
        }
        return JSON.stringify(episodes);
    } catch (e) {
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const html = await (await fetchv2(url)).text();
        const sources = [];
        const regex = /file:\s*"(https:[^"]+)",\s*label:\s*"(\d+p)"/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            sources.push({
                title: `[${match[2]}]`,
                streamUrl: match[1],
                headers: { referer: match[1] },
                subtitles: null
            });
        }
        return JSON.stringify({ streams: sources });
    } catch (e) {
        return JSON.stringify({ streams: [] });
    }
}

function decodeHTMLEntities(text) {
    text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
    const entities = {
        '&quot;': '"',
        '&amp;': '&',
        '&apos;': "'",
        '&lt;': '<',
        '&gt;': '>'
    };
    for (const entity in entities) {
        text = text.replace(new RegExp(entity, 'g'), entities[entity]);
    }
    return text;
}
