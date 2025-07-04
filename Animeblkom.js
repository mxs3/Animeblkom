async function searchResults(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const res = await fetchv2(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://animeblkom.com/search?keyword=${encodedQuery}`)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': 'https://animeblkom.com/'
      }
    });

    if (!res.ok) {
      return JSON.stringify([{
        title: 'Error',
        href: '',
        image: '',
        error: `HTTP error: ${res.status} - ${res.statusText}`
      }]);
    }

    const html = await res.text();
    if (!html || html.trim() === '') {
      return JSON.stringify([{
        title: 'No results found',
        href: '',
        image: '',
        error: 'Empty response from API'
      }]);
    }

    const results = [];
    const cards = html.match(/<a[^>]+class="anime-card[^"]*"[^>]*>[\s\S]*?<img[^>]*>[\s\S]*?<\/a>/g) || [];

    for (const card of cards) {
      const titleMatch = card.match(/<h3[^>]*>(.*?)<\/h3>/);
      const hrefMatch = card.match(/href="([^"]+)"/);
      const imgMatch = card.match(/<img[^>]+src="([^"]+)"/);

      if (titleMatch && hrefMatch && imgMatch) {
        const rawTitle = titleMatch[1].trim();
        const title = decodeHTMLEntities(rawTitle);
        const href = hrefMatch[1].startsWith('/') ? `https://animeblkom.com${hrefMatch[1]}` : hrefMatch[1];
        results.push({
          title,
          href,
          image: imgMatch[1]
        });
      }
    }

    if (results.length === 0) {
      return JSON.stringify([{
        title: 'No results found',
        href: '',
        image: ''
      }]);
    }

    return JSON.stringify(results);
  } catch (error) {
    return JSON.stringify([{
      title: 'Error',
      href: '',
      image: '',
      error: error.message
    }]);
  }
}

async function extractDetails(url) {
  try {
    const res = await fetchv2(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://animeblkom.com${url}`)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': 'https://animeblkom.com/'
      }
    });

    if (!res.ok) {
      return JSON.stringify([{
        title: 'Error',
        image: '',
        description: '',
        genres: [],
        error: `HTTP error: ${res.status} - ${res.statusText}`
      }]);
    }

    const html = await res.text();
    if (!html || html.trim() === '') {
      return JSON.stringify([{
        title: 'No details found',
        image: '',
        description: '',
        genres: [],
        error: 'Empty response from API'
      }]);
    }

    const title = (html.match(/<h1[^>]*>(.*?)<\/h1>/) || [])[1]?.trim() || 'N/A';
    const image = (html.match(/<div[^>]*class="poster"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/) || [])[1] || '';
    const summary = (html.match(/<div[^>]*class="story"[^>]*>\s*<p>(.*?)<\/p>/) || [])[1]?.trim() || 'N/A';
    const genres = [...html.matchAll(/\/genre\/[^"]+">([^<]+)<\/a>/g)].map(g => decodeHTMLEntities(g[1].trim()));

    return JSON.stringify([{
      title: decodeHTMLEntities(title),
      image,
      description: decodeHTMLEntities(summary),
      genres: genres.length ? genres.join(', ') : 'N/A'
    }]);
  } catch (error) {
    return JSON.stringify([{
      title: 'Error',
      image: '',
      description: '',
      genres: [],
      error: error.message
    }]);
  }
}

async function extractEpisodes(url) {
  try {
    const res = await fetchv2(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://animeblkom.com${url}`)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': 'https://animeblkom.com/'
      }
    });

    if (!res.ok) {
      return JSON.stringify([{
        title: 'Error',
        url: '',
        error: `HTTP error: ${res.status} - ${res.statusText}`
      }]);
    }

    const html = await res.text();
    if (!html || html.trim() === '') {
      return JSON.stringify([{
        title: 'No episodes found',
        url: '',
        error: 'Empty response from API'
      }]);
    }

    const results = [];
    const matches = [...html.matchAll(/<li[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/g)];

    for (const match of matches) {
      const rawTitle = match[2].trim();
      const href = match[1].startsWith('/') ? `https://animeblkom.com${match[1]}` : match[1];
      results.push({
        title: decodeHTMLEntities(rawTitle),
        url: href
      });
    }

    if (results.length === 0) {
      return JSON.stringify([{
        title: 'No episodes found',
        url: ''
      }]);
    }

    return JSON.stringify(results.reverse());
  } catch (error) {
    return JSON.stringify([{
      title: 'Error',
      url: '',
      error: error.message
    }]);
  }
}

async function extractStreamUrl(url) {
  try {
    const res = await fetchv2(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://animeblkom.com${url}`)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': 'https://animeblkom.com/'
      }
    });

    if (!res.ok) {
      return JSON.stringify({ streams: [], error: `HTTP error: ${res.status} - ${res.statusText}` });
    }

    const html = await res.text();
    if (!html || html.trim() === '') {
      return JSON.stringify({ streams: [], error: 'Empty response from API' });
    }

    const matches = [...html.matchAll(/<option\s+value="([^"]+)"[^>]*>[^<]*<\/option>/g)];
    const servers = [];

    for (const match of matches) {
      const serverUrl = match[1];
      if (serverUrl.includes('uqload') || serverUrl.includes('vidstream') || serverUrl.includes('streamwish')) {
        servers.push({
          url: serverUrl,
          type: 'external',
          quality: 'auto'
        });
      }
    }

    if (servers.length === 0) {
      return JSON.stringify({ streams: [], error: 'No stream URLs found' });
    }

    return JSON.stringify({ streams: servers });
  } catch (error) {
    return JSON.stringify({ streams: [], error: error.message });
  }
}

function decodeHTMLEntities(text) {
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  const entities = {
    '"': '"',
    '&': '&',
    ''': "'",
    '<': '<',
    '>': '>'
  };
  for (const entity in entities) {
    text = text.replace(new RegExp(entity, 'g'), entities[entity]);
  }
  return text;
}
```​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​​
