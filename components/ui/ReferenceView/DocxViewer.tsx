import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Download,
  X,
  FileText,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import styles from './DocxViewer.module.css';
import { DocumentFileError, DocxViewerProps } from '@/types/ui';
import { highlightInContainer, scrollFirstHighlightIntoView, getPrimaryHighlight } from '@/utils/hightlightText';
import { fileErrorMessage } from './ReferenceView';

const MIN_ZOOM = 50;
const MAX_ZOOM = 250;
const ZOOM_STEP = 10;

const DocxViewer: React.FC<DocxViewerProps> = ({
  fileUrl,
  fileError,
  highlight,
  fileName,
  expanded = false,
  onToggleExpand,
  onClose,
}) => {
  const [renderFailed, setRenderFailed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);

  const contentRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLElement[]>([]);

  // Fetch + render the document whenever the file changes.
  useEffect(() => {
    let cancelled = false;
    setRenderFailed(false);
    setNumPages(0);
    setCurrentPage(1);
    pagesRef.current = [];

    const container = contentRef.current;
    if (!container) return;
    container.innerHTML = '';

    if (!fileUrl) return;

    setLoading(true);
    (async () => {
      try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        if (cancelled || !contentRef.current) return;

        await renderAsync(blob, contentRef.current, contentRef.current, {
          className: 'docxPage',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          experimental: true,
          renderAltChunks: false,
        });
        if (cancelled || !contentRef.current) return;

        const pages = Array.from(
          contentRef.current.querySelectorAll<HTMLElement>('section.docxPage'),
        );
        pagesRef.current = pages;
        setNumPages(pages.length || 1);
      } catch (err) {
        if (!cancelled) {
+         console.error('DocxViewer render failed:', err);
+         setRenderFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  // Re-apply highlighting whenever the content or the cited passage changes.
    // Re-apply highlighting whenever the content or the cited passage changes.
  useEffect(() => {
      const container = contentRef.current;
      if (!container || loading || renderFailed) return;
      const matches = highlightInContainer(container, highlight);
      if (matches === 0) return;

      scrollFirstHighlightIntoView(container);

      // Update the page indicator to reflect which of our OWN measured pages
      // the highlight actually landed on — not the citation's server-side
      // page number, and not whatever currentPage happened to be before.
      const primary = getPrimaryHighlight(container);
      if (primary) {
        const pageIndex = pagesRef.current.findIndex((page) => page.contains(primary));
        if (pageIndex !== -1) setCurrentPage(pageIndex + 1);
      }
    }, [highlight, loading, renderFailed, numPages]);

  const goToPage = (page: number) => {
    const clamped = Math.min(Math.max(1, page), pagesRef.current.length || 1);
    setCurrentPage(clamped);
    pagesRef.current[clamped - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const failureMessage = fileErrorMessage(fileError as DocumentFileError | undefined, renderFailed);
  const title = fileName || 'Document';
  const downloadName = fileName || 'document.docx';

  return (
    <div className={styles.viewer}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Document</span>
        <div className={styles.headerActions}>
          {onToggleExpand && (
            <button
              className={`${styles.iconBtn} ${styles.tip}`}
              onClick={onToggleExpand}
              aria-label={expanded ? 'Shrink document' : 'Expand document'}
              data-tooltip={expanded ? 'Shrink' : 'Expand'}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          {onClose && (
            <button
              className={styles.plainBtn}
              onClick={onClose}
              aria-label="Close document"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </header>

      <div className={styles.docMeta}>
        <span className={styles.docIcon}>
          <FileText size={18} />
        </span>
        <h2 className={styles.docTitle} title={title}>
          {title}
        </h2>
        {numPages > 0 && (
          <span className={styles.pageBadge}>{numPages} pages</span>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <button
            className={styles.iconBtn}
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className={styles.pageIndicator}>
            {currentPage} / {numPages || '…'}
          </span>
          <button
            className={styles.iconBtn}
            onClick={() => goToPage(currentPage + 1)}
            disabled={!numPages || currentPage >= numPages}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={styles.toolbarGroup}>
          <button
            className={styles.iconBtn}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            <Minus size={16} />
          </button>
          <span className={styles.zoomLabel}>{zoom}%</span>
          <button
            className={styles.iconBtn}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>
        </div>

        {fileUrl && (
          <a
            className={`${styles.plainBtn} ${styles.tip} ${styles.pushRight}`}
            href={fileUrl}
            download={downloadName}
            aria-label="Download document"
            data-tooltip="Download"
          >
            <Download size={18} />
          </a>
        )}
      </div>

      <div className={styles.pageArea}>
        {failureMessage && <p className={styles.status}>{failureMessage}</p>}
        {!failureMessage && loading && <p className={styles.status}>Loading…</p>}
        <div
          className={styles.docxRoot}
          style={{
            display: failureMessage ? 'none' : 'block',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
          ref={contentRef}
        />
      </div>
    </div>
  );
};

export default DocxViewer;