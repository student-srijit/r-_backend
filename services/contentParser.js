import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';

export class ContentParser {
  async extractFromURL(url) {
    const urlLower = url.toLowerCase();

    // arXiv: Use the official API for structured metadata
    if (urlLower.includes('arxiv.org')) {
      return this._extractArxiv(url);
    }

    // YouTube: Extract real transcript
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return this._extractYouTube(url);
    }

    // Generic HTML scraping for everything else
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        maxContentLength: 5 * 1024 * 1024, // 5MB max
      });
      return this.parseHTML(response.data);
    } catch (error) {
      throw new Error(`Failed to fetch content from URL: ${error.message}`);
    }
  }

  async _extractArxiv(url) {
    // Extract arxiv ID from various URL formats:
    // https://arxiv.org/abs/2301.00001
    // https://arxiv.org/pdf/2301.00001.pdf
    // https://arxiv.org/abs/2301.00001v2
    const match = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i);
    if (!match) {
      // Fallback to HTML scraping if URL format is unusual
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'ResearchPlusBot/1.0' },
      });
      return this.parseHTML(response.data);
    }

    const arxivId = match[1].replace(/v\d+$/, ''); // Strip version suffix for API

    const apiUrl = `https://export.arxiv.org/api/query?id_list=${arxivId}&max_results=1`;
    const apiResponse = await axios.get(apiUrl, {
      timeout: 15000,
      headers: { 'User-Agent': 'ResearchPlusBot/1.0' },
    });

    const parsed = await parseStringPromise(apiResponse.data, { explicitArray: false });
    const entry = parsed.feed.entry;

    if (!entry) {
      throw new Error('arXiv paper not found');
    }

    const title = (entry.title || '').replace(/\s+/g, ' ').trim();
    const abstract = (entry.summary || '').replace(/\s+/g, ' ').trim();

    // Authors can be object or array
    const authorsRaw = entry.author;
    const authors = Array.isArray(authorsRaw)
      ? authorsRaw.map((a) => a.name).join(', ')
      : authorsRaw?.name || 'Unknown';

    const published = entry.published
      ? new Date(entry.published).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const categories = Array.isArray(entry.category)
      ? entry.category.map((c) => c.$.term).join(', ')
      : entry.category?.$.term || '';

    const content = [
      `Title: ${title}`,
      `Authors: ${authors}`,
      published && `Published: ${published}`,
      categories && `Categories: ${categories}`,
      `Abstract:\n${abstract}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    return { title, content, rawHTML: '' };
  }

  async _extractYouTube(url) {
    // Extract video ID
    const match =
      url.match(/[?&]v=([^&]+)/) ||
      url.match(/youtu\.be\/([^?]+)/) ||
      url.match(/youtube\.com\/embed\/([^?]+)/);

    if (!match) {
      throw new Error('Could not extract YouTube video ID from URL');
    }

    const videoId = match[1];

    let transcriptText = '';
    try {
      const { YoutubeTranscript } = await import('youtube-transcript');
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      transcriptText = transcript.map((t) => t.text).join(' ');
    } catch (err) {
      // Many videos have no captions; fall back to page title scrape
      try {
        const pageResponse = await axios.get(url, {
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const $ = cheerio.load(pageResponse.data);
        const videoTitle = $('title').text().replace(' - YouTube', '').trim();
        return {
          title: videoTitle,
          content: `YouTube Video: ${videoTitle}\n\nNote: No transcript available for this video. Analysis will be based on the video title and metadata.`,
          rawHTML: '',
        };
      } catch {
        throw new Error(`Could not extract YouTube content: ${err.message}`);
      }
    }

    // Fetch page title
    let videoTitle = `YouTube Video ${videoId}`;
    try {
      const pageResponse = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const $ = cheerio.load(pageResponse.data);
      const rawTitle = $('title').text().replace(' - YouTube', '').trim();
      if (rawTitle) videoTitle = rawTitle;
    } catch {
      // Use fallback title
    }

    const content = [
      `Title: ${videoTitle}`,
      `Transcript:\n${transcriptText}`,
    ].join('\n\n');

    return { title: videoTitle, content: this.truncateContent(content, 6000), rawHTML: '' };
  }

  parseHTML(html) {
    try {
      const $ = cheerio.load(html);

      $('script, style, nav, footer, header, aside, .ad, .advertisement, .cookie-notice').remove();

      let content = '';
      const article = $('article, main, [role="main"], .post-content, .article-body, .entry-content').html();

      if (article) {
        content = article;
      } else {
        content = $('body').html() || '';
      }

      const $2 = cheerio.load(content);
      let text = $2.text();

      text = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('\n');

      let title = $('h1').first().text().trim();
      if (!title) {
        title = $('title').text().replace(/\s*[\|—-].*$/, '').trim();
      }

      return {
        title,
        content: this.truncateContent(text, 5000),
        rawHTML: html,
      };
    } catch (error) {
      throw new Error(`Failed to parse HTML: ${error.message}`);
    }
  }

  async detectContentType(url) {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') || urlLower.includes('vimeo.com')) {
      return 'vlog';
    }

    if (urlLower.includes('.pdf') || urlLower.includes('arxiv.org')) {
      return 'paper';
    }

    if (
      urlLower.includes('medium.com') ||
      urlLower.includes('dev.to') ||
      urlLower.includes('hashnode.com') ||
      urlLower.includes('substack.com') ||
      urlLower.includes('mirror.xyz')
    ) {
      return 'blog';
    }

    return 'other';
  }

  truncateContent(content, maxChars = 5000) {
    if (content.length <= maxChars) return content;
    return content.substring(0, maxChars) + '...';
  }
}

export const createContentParser = () => {
  return new ContentParser();
};
