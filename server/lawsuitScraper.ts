/**
 * Lawsuit News Scraper
 * Fetches the latest articles from lawsuit-information-center.com
 * for each of the 6 research-backed lawsuits.
 */

import * as cheerio from "cheerio";

export interface ScrapedArticle {
  title: string;
  url: string;
  excerpt: string;
  publishedAt: string | null;
}

// Maps our internal lawsuit keys to the site's category URLs
const LAWSUIT_SCRAPE_URLS: Record<string, string> = {
  "Hernia Mesh": "https://www.lawsuit-information-center.com/category/mass-torts/hernia-mesh",
  "PowerPort": "https://www.lawsuit-information-center.com/category/mass-torts/bard-powerport",
  "Depo-Provera": "https://www.lawsuit-information-center.com/category/depo-provera",
  "Social Media Addiction": "https://www.lawsuit-information-center.com/category/mass-torts/social-media-addition",
  "NY Juvenile Detention": "https://www.lawsuit-information-center.com/category/sex-abuse/new-york-juvenile-detention",
  "Illinois Juvenile Detention": "https://www.lawsuit-information-center.com/category/sex-abuse/illinois-juvenile-detention",
};

// Fallback search URLs if category pages don't exist
const LAWSUIT_SEARCH_URLS: Record<string, string> = {
  "NY Juvenile Detention": "https://www.lawsuit-information-center.com/?s=new+york+juvenile+detention",
  "Illinois Juvenile Detention": "https://www.lawsuit-information-center.com/?s=illinois+juvenile+detention",
};

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AKDScriptWriter/1.0; +https://akdscript.com)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseArticles(html: string, baseUrl: string): ScrapedArticle[] {
  const $ = cheerio.load(html);
  const articles: ScrapedArticle[] = [];

  // The site uses standard WordPress article structure
  $("article, .post, .entry").each((_, el) => {
    const titleEl = $(el).find("h1 a, h2 a, h3 a, .entry-title a").first();
    const title = titleEl.text().trim();
    const url = titleEl.attr("href") || "";
    const excerpt = $(el).find(".entry-summary, .entry-content p").first().text().trim().slice(0, 500);
    const dateEl = $(el).find("time, .entry-date, .posted-on").first();
    const publishedAt = dateEl.attr("datetime") || dateEl.text().trim() || null;

    if (title && url) {
      articles.push({
        title,
        url: url.startsWith("http") ? url : `${baseUrl}${url}`,
        excerpt,
        publishedAt,
      });
    }
  });

  // If no articles found via article tags, try common WordPress list patterns
  if (articles.length === 0) {
    $("h2.entry-title a, h1.entry-title a, .post-title a").each((_, el) => {
      const title = $(el).text().trim();
      const url = $(el).attr("href") || "";
      if (title && url) {
        articles.push({
          title,
          url: url.startsWith("http") ? url : `https://www.lawsuit-information-center.com${url}`,
          excerpt: "",
          publishedAt: null,
        });
      }
    });
  }

  return articles.slice(0, 5); // Return at most 5 most recent articles
}

export async function scrapeUpdatesForLawsuit(lawsuitKey: string): Promise<ScrapedArticle[]> {
  const primaryUrl = LAWSUIT_SCRAPE_URLS[lawsuitKey];
  if (!primaryUrl) return [];

  let html = await fetchPage(primaryUrl);

  // If primary URL 404s, try the fallback search URL
  if (!html && LAWSUIT_SEARCH_URLS[lawsuitKey]) {
    html = await fetchPage(LAWSUIT_SEARCH_URLS[lawsuitKey]);
  }

  if (!html) return [];

  return parseArticles(html, "https://www.lawsuit-information-center.com");
}

export async function scrapeAllLawsuits(): Promise<Record<string, ScrapedArticle[]>> {
  const results: Record<string, ScrapedArticle[]> = {};
  const keys = Object.keys(LAWSUIT_SCRAPE_URLS);

  // Scrape sequentially to be polite to the server
  for (const key of keys) {
    try {
      results[key] = await scrapeUpdatesForLawsuit(key);
    } catch {
      results[key] = [];
    }
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}
