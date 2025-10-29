// Scrape StoreKit menu into structured JSON
import { request } from 'undici';
import * as cheerio from 'cheerio';

export async function fetchStorekitMenu(url) {
  // 1) Fetch HTML
  const { body, statusCode } = await request(url, {
    headers: {
      'User-Agent': 'CafeFrankAppBot/1.0 (+contact: ops@cafefrank.com)',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });
  if (statusCode >= 400) throw new Error(`StoreKit fetch failed: ${statusCode}`);
  const html = await body.text();

  // 2) Parse
  const $ = cheerio.load(html);

  // StoreKit pages often render category headings with items under them.
  // Selectors may need tweaking if StoreKit’s markup changes; keep this resilient.
  // Try common patterns: headings (h2/h3) → sibling cards with title/desc/price/img.
  const categories = [];
  $('h2, h3').each((_, el) => {
    const title = $(el).text().trim();
    if (!title) return;

    // Find a container near this heading with item cards
    const section = $(el).nextUntil('h2, h3'); // nodes until next heading
    const items = [];

    section.find('a, article, div').each((__, card) => {
      // Heuristics to pick product elements
      const name =
        $(card).find('h3, h4, [class*=title], [class*=name]').first().text().trim() ||
        $(card).attr('title')?.trim();

      // Skip if no title (not a product card)
      if (!name) return;

      const desc =
        $(card).find('p, [class*=desc], [class*=description]').first().text().trim() || '';

      // Price extraction: look for “R 95”, “ZAR 95”, or plain numbers
      let priceText =
        $(card).find('[class*=price], .price').first().text().trim() ||
        $(card).text().match(/(?:R|ZAR)?\s*\d+(?:[.,]\d{2})?/i)?.[0] ||
        '';

      // Normalize currency/amount
      let price = undefined;
      if (priceText) {
        const m = priceText.replace(/[, ]/g,'').match(/(\d+(?:\.\d+)?)/);
        if (m) price = Number(m[1]);
      }

      // Image
      const img =
        $(card).find('img').attr('src') ||
        $(card).find('img').attr('data-src') ||
        '';

      // Build item id (slug-ish)
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');

      items.push({ id, name, desc, price, image: img || undefined });
    });

    if (items.length) {
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$|/g,'');
      categories.push({ id, name: title, items });
    }
  });

  // Fallback: if no headings parsed, try “all cards on page”
  if (!categories.length) {
    const items = [];
    $('a, article, div').each((__, card) => {
      const name =
        $(card).find('h3, h4, [class*=title], [class*=name]').first().text().trim();
      if (!name) return;
      const desc =
        $(card).find('p, [class*=desc], [class*=description]').first().text().trim() || '';
      let priceText =
        $(card).find('[class*=price], .price').first().text().trim() ||
        $(card).text().match(/(?:R|ZAR)?\s*\d+(?:[.,]\d{2})?/i)?.[0] || '';
      let price;
      if (priceText) {
        const m = priceText.replace(/[, ]/g,'').match(/(\d+(?:\.\d+)?)/);
        if (m) price = Number(m[1]);
      }
      const img = $(card).find('img').attr('src') || $(card).find('img').attr('data-src') || '';
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
      items.push({ id, name, desc, price, image: img || undefined });
    });
    if (items.length) categories.push({ id: 'menu', name: 'Menu', items });
  }

  // De-dup items within a category by id
  for (const cat of categories) {
    const seen = new Set();
    cat.items = cat.items.filter(i => {
      if (seen.has(i.id)) return false;
      seen.add(i.id); return true;
    });
  }

  return { categories };
}
