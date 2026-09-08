import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import '@react-pdf-viewer/core/lib/styles/index.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import DocxViewer from './DocxViewer';
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
import styles from './ReferenceView.module.css';
import { DocumentFileError, PdfViewerProps } from '@/types/ui';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const MIN_ZOOM = 50;
const MAX_ZOOM = 250;
const ZOOM_STEP = 10;
const MIN_HIGHLIGHT_RUN = 4;

const normalizeForMatch = (value: string) =>
  ` ${value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;

// A failed fetch and a file that won't parse are different problems for the user.
export const fileErrorMessage = (
  error?: DocumentFileError,
  renderFailed?: boolean
): string | null => {
  if (error === 'unauthorized') return 'You do not have access to this document.';
  if (error === 'missing') return 'The original file is not available for this document.';
  if (error) return 'Could not load this document. Please try again.';
  if (renderFailed) return 'This document could not be displayed.';
  return null;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const clampPage = (page: number, numPages: number): number => {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  return numPages > 0 ? Math.min(safePage, numPages) : safePage;
};

const isValidPageNumber = (page: number): boolean =>
  Number.isFinite(page) && page >= 1;

const PdfViewer: React.FC<PdfViewerProps> = ({
  fileUrl: pdfUrl,
  fileError,
  pageNumber,
  highlight,
  fileName,
  expanded = false,
  onToggleExpand,
  onClose,
}) => {
  const [renderFailed, setRenderFailed] = useState<boolean>(false);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(clampPage(pageNumber, 0));
  const [pageUnavailable, setPageUnavailable] = useState<boolean>(
    !isValidPageNumber(pageNumber)
  );
  const [zoom, setZoom] = useState<number>(100);
  const pageAreaRef = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState<number>(600);

  // Fit the page to the available column width (keeps the page readable when the
  // document opens beside the chat, and when the column is expanded/shrunk).
  useEffect(() => {
    const el = pageAreaRef.current;
    if (!el) return;
    const measure = () =>
      setFitWidth(Math.max(240, Math.floor(el.clientWidth - 48)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pdfUrl]);

  const citedText = normalizeForMatch(highlight || '');
  const customTextRenderer = useCallback(
    (layer: { str: string; itemIndex: number }) => {
      const run = normalizeForMatch(layer.str);
      const isCited =
        citedText.length > 2 &&
        run.trim().length >= MIN_HIGHLIGHT_RUN &&
        citedText.includes(run);
      return isCited
        ? `<mark>${escapeHtml(layer.str)}</mark>`
        : escapeHtml(layer.str);
    },
    [citedText],
  );

  const failureMessage = fileErrorMessage(fileError, renderFailed);
  const title = fileName || 'Document';
  const downloadName = fileName || 'document.pdf';

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
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className={styles.pageIndicator}>
            {currentPage} / {numPages || '…'}
          </span>
          {pageUnavailable && (
            <span
              className={styles.pageWarning}
              title="The cited page could not be shown; displaying the nearest available page instead."
            >
              Page unavailable
            </span>
          )}
          <button
            className={styles.iconBtn}
            onClick={() => setCurrentPage(currentPage + 1)}
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

        {pdfUrl && (
          <a
            className={`${styles.plainBtn} ${styles.tip} ${styles.pushRight}`}
            href={pdfUrl}
            download={downloadName}
            aria-label="Download document"
            data-tooltip="Download"
          >
            <Download size={18} />
          </a>
        )}
      </div>

      <div className={styles.pageArea} ref={pageAreaRef}>
        {failureMessage && <p className={styles.status}>{failureMessage}</p>}
        {!failureMessage && !pdfUrl && (
          <p className={styles.status}>Loading…</p>
        )}
        {pdfUrl && (
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              setCurrentPage((page) => clampPage(page, numPages));
              if (isValidPageNumber(pageNumber) && pageNumber > numPages) {
                setPageUnavailable(true);
              }
            }}
            onLoadError={() => setRenderFailed(true)}
          >
            <div className={styles.page}>
              <Page
                pageNumber={currentPage}
                width={Math.round((fitWidth * zoom) / 100)}
                customTextRenderer={customTextRenderer}
                renderAnnotationLayer={false}
                onLoadError={() => {
                  setPageUnavailable(true);
                  setCurrentPage((page) => clampPage(page, numPages));
                }}
              />
            </div>
          </Document>
        )}
      </div>
    </div>
  );
};

export const isDocx = (fileName?: string) =>
  !!fileName && /\.docx?$/i.test(fileName);

const ReferenceViewer: React.FC<PdfViewerProps> = (props) =>
  isDocx(props.fileName) ? <DocxViewer {...props} /> : <PdfViewer {...props} />;

export default ReferenceViewer;