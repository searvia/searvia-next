'use client';

import { useEffect } from 'react';
import type { Fix } from './feed';

const SKIP = ['A', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BUTTON', 'SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'FIGCAPTION'];

function inline(href: string, anchor: string): void {
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const pattern = new RegExp('(^|[^\\p{L}\\p{N}])(' + escaped + ')(?![\\p{L}\\p{N}])', 'iu');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    let inText = false;
    let blocked = false;

    for (let element = node.parentElement; element; element = element.parentElement) {
      if (SKIP.includes(element.tagName)) {
        blocked = true;
        break;
      }
      if (element.tagName === 'P' || element.tagName === 'LI') inText = true;
    }

    const match = !blocked && inText ? pattern.exec(node.nodeValue ?? '') : null;

    if (match) {
      const word = (node as Text).splitText(match.index + match[1].length);
      word.splitText(match[2].length);
      const link = document.createElement('a');
      link.href = href;
      word.parentNode?.replaceChild(link, word);
      link.appendChild(word);
      return;
    }
  }
}

/**
 * Image alt text and internal link fixes, applied in the browser after the page renders (they change the page body,
 * which Next.js renders from your components). Pass the fixes from `getSearviaFixes()`.
 */
export function SearviaClientFixes({ fixes }: { fixes: Fix[] }): null {
  useEffect(() => {
    for (const fix of fixes) {
      if (fix.t === 'image_alt') {
        for (const image of fix.v.images as Array<{ src: string; alt: string }>) {
          document.querySelectorAll('img').forEach((img) => {
            const src = img.getAttribute('src') || img.getAttribute('data-src');
            if (src === image.src && !img.hasAttribute('alt')) img.setAttribute('alt', image.alt);
          });
        }
      } else if (fix.t === 'internal_link' && fix.v.mode === 'inline') {
        inline(fix.v.href, fix.v.anchor);
      } else if (fix.t === 'internal_link' && !document.querySelector(`a.searvia-related[href="${CSS.escape(fix.v.href)}"]`)) {
        const target = document.querySelector('main') || document.querySelector('article') || document.body;
        const paragraph = document.createElement('p');
        const link = document.createElement('a');
        paragraph.className = 'searvia-related';
        link.className = 'searvia-related';
        link.href = fix.v.href;
        link.textContent = fix.v.anchor;
        paragraph.appendChild(link);
        target.appendChild(paragraph);
      }
    }
  }, [fixes]);

  return null;
}
