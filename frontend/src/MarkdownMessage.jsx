/**
 * MarkdownMessage.jsx
 *
 * Renders AI assistant markdown responses safely.
 * Uses DOMPurify to sanitize HTML before rendering via dangerouslySetInnerHTML.
 * This is explicitly approved because:
 * 1. Content comes from our own backend AI (Gemini), not from user input
 * 2. DOMPurify strips any executable content before rendering
 * This is the ONLY place dangerouslySetInnerHTML is used in this app.
 */

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for clean output
const renderer = new marked.Renderer();
marked.setOptions({
  renderer,
  breaks: true,
  gfm: true,
});

// DOMPurify config — allow safe structural HTML only
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr', 'a', 'img', 'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'id'],
  ALLOW_DATA_ATTR: false,
  // Force all links to open in new tab safely
  ADD_ATTR: ['target', 'rel'],
  FORCE_BODY: false,
};

// Post-process to add safe link attributes
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export default function MarkdownMessage({ content }) {
  const safeHtml = useMemo(() => {
    if (!content) return '';
    const rawHtml = marked.parse(content);
    // DOMPurify sanitizes the AI-generated HTML before it hits the DOM
    return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);
  }, [content]);

  return (
    // Safe: content is AI-generated and sanitized by DOMPurify before rendering
    // eslint-disable-next-line react/no-danger
    <div
      className="markdown-body"
      // TODO(security): This is DOMPurify-sanitized AI output. User-generated content
      // MUST NOT be passed here without additional review.
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
