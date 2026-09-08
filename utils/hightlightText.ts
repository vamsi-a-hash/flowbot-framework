// Shared text-matching + DOM highlighting helpers used by document viewers.

export const normalizeForMatch = (value: string) =>
  ` ${value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;

export const MIN_HIGHLIGHT_RUN = 4;

const HIGHLIGHT_ATTR = 'data-hl';
const PRIMARY_ATTR = 'data-hl-primary';

/**
 * Removes any highlight marks previously inserted by highlightInContainer,
 * merging their text back into the surrounding text node.
 */
export const clearHighlights = (root: HTMLElement): void => {
  root.querySelectorAll(`mark[${HIGHLIGHT_ATTR}]`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
    parent.normalize();
  });
};

export const highlightInContainer = (
  root: HTMLElement,
  highlight?: string,
  minRun: number = MIN_HIGHLIGHT_RUN,
): number => {
  clearHighlights(root);

  const citedText = normalizeForMatch(highlight || '');
  if (!highlight || citedText.trim().length < minRun) return 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const value = node.nodeValue;
      if (!value || !value.trim()) return NodeFilter.FILTER_REJECT;
      const tag = node.parentElement?.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    textNodes.push(current as Text);
  }

  // Phase 1: find every qualifying run without mutating the DOM yet, so we
  // can compare them all before deciding which one is "the" primary match.
  const matches: { node: Text; value: string; overlap: number }[] = [];
  textNodes.forEach((node) => {
    const value = node.nodeValue || '';
    const normalized = normalizeForMatch(value);
    const normalizedLength = normalized.trim().length;
    if (normalizedLength < minRun) return;

    let overlap = 0;
    if (citedText.includes(normalized)) {
      overlap = normalizedLength;
    } else if (normalized.includes(citedText)) {
      overlap = citedText.trim().length;
    } else {
      return; // no containment either way — not a candidate
    }

    matches.push({ node, value, overlap });
  });

  if (matches.length === 0) return 0;

  // The run with the largest actual overlap is the best proxy for "the
  // passage that was really cited" — used to decide where to scroll/which
  // page to report, not to decide what gets highlighted. Every qualifying
  // run is highlighted; a citation spanning multiple DOM text nodes lights
  // up in full instead of only its single best-scoring fragment.
  const primary = matches.reduce((best, m) => (m.overlap > best.overlap ? m : best), matches[0]);

  matches.forEach((m) => {
    const mark = document.createElement('mark');
    mark.setAttribute(HIGHLIGHT_ATTR, 'true');
    if (m === primary) mark.setAttribute(PRIMARY_ATTR, 'true');
    mark.textContent = m.value;
    m.node.parentNode?.replaceChild(mark, m.node);
  });

  return matches.length;
};

// Returns the best-scoring highlight mark 
export const getPrimaryHighlight = (root: HTMLElement): HTMLElement | null =>
  root.querySelector<HTMLElement>(`mark[${PRIMARY_ATTR}]`) ||
  root.querySelector<HTMLElement>(`mark[${HIGHLIGHT_ATTR}]`);

//Scrolls the best-scoring highlight mark into view,
export const scrollFirstHighlightIntoView = (root: HTMLElement): void => {
  getPrimaryHighlight(root)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};