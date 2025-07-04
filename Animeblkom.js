async function searchResults(keyword) {
    const encoded = encodeURIComponent(keyword.trim());
    const fallbackResults = [];

    try {
        const api = await (await fetch(`https://api.consumet.org/meta/anilist/${encoded}`)).json();
        if (api && api.results) {
            for (const item of api.results) {
                fallbackResults.push({
                    title: item.title.romaji || item.title.english || item.title.native || "Unknown",
                    href: item.id || "",
                    image: item.image || ""
                });
            }
            return JSON.stringify(fallbackResults);
        }
    } catch (e) {}

    try {
        const response = await fetchv2(`https://www.animeiat.xyz/search?q=${encoded}`, {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://www.animeiat.xyz/'
        });
        const html = await response.text();
        const results = [];
        const containerRegex = /<div class="pa-1 col-sm-4 col-md-3 col-lg-2 col-6">([\s\S]*?)<\/div><\/div><\/div>/g;
        let match;
        while ((match = containerRegex.exec(html)) !== null) {
            const container = match[1];
            const titleMatch = container.match(/<h2[^>]*>(.*?)<\/h2>/);
            const hrefMatch = container.match(/href="([^"]+)"/);
            if (titleMatch && hrefMatch) {
                const title = decodeHTMLEntities(titleMatch[1].trim());
                const href = hrefMatch[1].trim().startsWith('/')
                    ? `https://animeiat.xyz${hrefMatch[1].trim()}`
                    : hrefMatch[1].trim();
                results.push({ title, href, image: '' });
            }
        }

        const scriptRegex = /anime_name:\s*"(.*?)"[\s\S]*?slug:\s*"(.*?)"[\s\S]*?poster_path:\s*"(.*?)"/g;
        let posterMatch;
        while ((posterMatch = scriptRegex.exec(html)) !== null) {
            const title = decodeHTMLEntities(posterMatch[1].trim());
            const poster = posterMatch[3].trim().replace(/\\u002F/g, '/');
            const index = results.findIndex(r => r.title.toLowerCase() === title.toLowerCase());
            if (index !== -1) {
                results[index].image = `https://api.animeiat.co/storage/${poster}`;
            }
        }

        if (results.length === 0) {
            return JSON.stringify([{ title: 'No results found', href: '', image: '' }]);
        }

        return JSON.stringify(results);
    } catch (error) {
        return JSON.stringify([{ title: 'Error', href: '', image: '', error: error.message }]);
    }
}

async function extractDetails(url) {
    const results = [];
    try {
        const response = await fetchv2(url, {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://www.animeiat.xyz/'
        });
        const html = await response.text();
        const description = html.match(/<p class="text-justify">([\s\S]*?)<\/p>/i)?.[1]?.trim() || 'N/A';
        const airdate = html.match(/<span.*?v-chip__content.*?><span>(\d{4})<\/span><\/span>/i)?.[1] || 'N/A';
        const aliases = [];
        const aliasBlock = html.match(/<div class="v-card__text pb-0 px-1">[\s\S]*?<\/div>\s*<\/div>/i)?.[0] || '';
        const aliasMatches = aliasBlock.matchAll(/<span.*?v-chip__content"><span>([^<]+)<\/span><\/span>/g);
        for (const a of aliasMatches) {
            aliases.push(decodeHTMLEntities(a[1].trim()));
        }
        results.push({
            description: decodeHTMLEntities(description),
            aliases: aliases.length ? aliases.join(', ') : 'N/A',
            airdate
        });
        return JSON.stringify(results);
    } catch {
        return JSON.stringify([{ description: 'N/A', aliases: 'N/A', airdate: 'N/A' }]);
    }
}

async function extractEpisodes(url) {
    const episodes = [];
    try {
        const response = await fetchv2(url, {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://www.animeiat.xyz/'
        });
        const html = await response.text();
        let slug = html.match(/slug:"([^"]+)"/)?.[1] || url.match(/\/anime\/([^\/]+)/)?.[1];
        if (!slug) return JSON.stringify([]);

        let episodeCount = 0;
        try {
            const api = await (await fetchv2(`https://api.animeiat.co/v1/anime/${slug}/episodes`)).json();
            const lastPage = api.meta?.last_page || 1;
            const lastPageHtml = await (await fetchv2(`${url}?page=${lastPage}`)).text();
            const matches = [...lastPageHtml.matchAll(/episode-(\d+)/g)];
            episodeCount = Math.max(...matches.map(m => parseInt(m[1])), 0);
        } catch {}

        if (!episodeCount) {
            const allMatches = [...html.matchAll(/episode-(\d+)/g)];
            episodeCount = Math.max(...allMatches.map(m => parseInt(m[1])), 0);
        }

        for (let i = 1; i <= episodeCount; i++) {
            episodes.push({ href: `https://www.animeiat.xyz/watch/${slug}-episode-${i}`, number: i });
        }
        return JSON.stringify(episodes);
    } catch {
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const pageResponse = await fetchv2(url, {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://www.animeiat.xyz/'
        });
        const html = await pageResponse.text();
        const slug = html.match(/video:\{id:[^,]+,name:"[^"]+",slug:"([^"]+)"/i)?.[1];
        if (!slug) return JSON.stringify({ streams: [] });
        const api = await (await fetchv2(`https://api.animeiat.co/v1/video/${slug}/download`)).json();
        const result = { streams: [] };
        if (Array.isArray(api.data)) {
            for (const stream of api.data) {
                if (stream.file && stream.label) {
                    result.streams.push({
                        title: `[${stream.label}]`,
                        streamUrl: stream.file,
                        headers: { referer: stream.file },
                        subtitles: null
                    });
                }
            }
        }
        return JSON.stringify(result);
    } catch {
        return JSON.stringify({ streams: [] });
    }
}

function decodeHTMLEntities(text) {
    text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
    const entities = { '&quot;': '"', '&amp;': '&', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    for (const e in entities) text = text.replace(new RegExp(e, 'g'), entities[e]);
    return text;
}
