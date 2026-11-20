import sanitizeHtml from 'sanitize-html';

/** A photo from the library at one of its stored widths: the only images an article may carry. */
const LIBRARY_IMAGE = /^\/media\/[0-9a-f-]{36}\/(sm|md|lg)\.webp$/;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'hr', 'img', 'figure', 'figcaption'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  transformTags: {
    h1: 'h2',
    h5: 'h4',
    h6: 'h4',
    b: 'strong',
    i: 'em',
    strike: 's',
    del: 's',
    a: (tagName, attribs) => {
      const href = attribs.href ?? '';
      const external = /^https?:\/\//i.test(href);
      const attributes: sanitizeHtml.Attributes = external ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href };
      return { tagName, attribs: attributes };
    },
  },
  // Pictures from anywhere but the library (old upload paths, hotlinks, data URLs) are dropped whole.
  exclusiveFilter: (frame) => frame.tag === 'img' && !LIBRARY_IMAGE.test(frame.attribs.src ?? ''),
};

/**
 * The HTML the editor sends, reduced to what an article may hold: text
 * structure, links, and photos from the library. Scripts, styles, event
 * handlers, frames and foreign images never reach the database.
 */
export function sanitizeRichText(input: string): string {
  // Empty paragraphs at the end (an editor with nothing typed sends one) are dropped.
  return sanitizeHtml(input, OPTIONS).trim().replace(/(<p>(\s|&nbsp;|<br \/>)*<\/p>\s*)+$/, '');
}

/** Text only, collapsed: for search, meta descriptions and summaries made from a body. */
export function plainText(input: string, max = Infinity): string {
  const text = sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** A URL-safe slug from a title, Indonesian letters folded to ASCII. */
export function slugify(input: string, max = 80): string {
  return (
    input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/g, '') || 'entri'
  );
}
