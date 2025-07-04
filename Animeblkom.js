async function searchResults(query) {
  const res = await fetchv2(`https://bypass.mxapp.dev/animeblkom/search?keyword=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const html = await res.text();
  const results = [];
  const cards = html.match(/<a[^>]+class="anime-card[^"]*"[^>]*>[\s\S]*?<img[^>]*>[\s\S]*?<\/a>/g) || [];

  for (const card of cards) {
    const titleMatch = card.match(/<h3[^>]*>(.*?)<\/h3>/);
    const hrefMatch = card.match(/href="([^"]+)"/);
    const imgMatch = card.match(/<img[^>]+src="([^"]+)"/);

    if (titleMatch && hrefMatch && imgMatch) {
      results.push({
        title: titleMatch[1].trim(),
        href: `https://animeblkom.com${hrefMatch[1]}`,
        image: imgMatch[1]
      });
    }
  }

  return results;
}

async function extractDetails(url) {
  const res = await fetchv2(`https://bypass.mxapp.dev/animeblkom/details?url=${encodeURIComponent(url)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const html = await res.text();
  const title = (html.match(/<h1[^>]*>(.*?)<\/h1>/) || [])[1]?.trim() || '';
  const image = (html.match(/<div[^>]*class="poster"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/) || [])[1] || '';
  const summary = (html.match(/<div[^>]*class="story"[^>]*>\s*<p>(.*?)<\/p>/) || [])[1]?.trim() || '';
  const genres = [...html.matchAll(/\/genre\/[^"]+">([^<]+)<\/a>/g)].map(g => g[1].trim());

  return {
    title,
    image,
    description: summary,
    genres
  };
}

async function extractEpisodes(url) {
  const res = await fetchv2(`https://bypass.mxapp.dev/animeblkom/episodes?url=${encodeURIComponent(url)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const html = await res.text();
  const results = [];
  const matches = [...html.matchAll(/<li[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/g)];

  for (const match of matches) {
    results.push({
      title: match[2].trim(),
      url: `https://animeblkom.com${match[1]}`
    });
  }

  return results.reverse();
}

async function extractStreamUrl(url) {
  const res = await fetchv2(`https://bypass.mxapp.dev/animeblkom/stream?url=${encodeURIComponent(url)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const html = await res.text();
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

  return servers;
}
