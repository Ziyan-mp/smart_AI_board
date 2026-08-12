/**
 * main.ts
 *
 * AI Smart Board - Step 20: Multi-Page Class Notes
 */

import { WhiteboardCanvas } from './canvas/WhiteboardCanvas';
import { DrawingTool, ShapeType } from './tools/DrawingTool';
import { TextAlign } from './models/TextObject';
import { BoardObject } from './models/BoardObject';
import { BoardStorageService } from './storage/BoardStorageService';
import { StoredBoardSummary } from './storage/BoardDatabase';
import { BoardExporter } from './export/BoardExporter';
import { ClassNotePdfExporter } from './export/ClassNotePdfExporter';
import { ClassNoteManager } from './core/ClassNoteManager';
import { PageThumbnailRenderer } from './pages/PageThumbnailRenderer';
import { PdfViewerService } from './pdf/PdfViewerService';
import { PdfAnnotationManager } from './pdf/PdfAnnotationManager';
import { HistoryManager } from './history/HistoryManager';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Whiteboard Canvas, Storage Service, ClassNoteManager & PdfAnnotationManager
  const whiteboardContainer = document.querySelector<HTMLDivElement>('#whiteboard-container');

  if (!whiteboardContainer) {
    throw new Error('Whiteboard container not found.');
  }

  const whiteboard = new WhiteboardCanvas(whiteboardContainer);
  const storageService = new BoardStorageService();
  const noteManager = new ClassNoteManager();
  const pdfViewer = new PdfViewerService();
  const pdfAnnotationManager = new PdfAnnotationManager();

  // Expose instances on window for testing/inspection
  (window as unknown as {
    whiteboard: WhiteboardCanvas;
    storage: BoardStorageService;
    exporter: typeof BoardExporter;
    pdfExporter: typeof ClassNotePdfExporter;
    noteManager: ClassNoteManager;
    pdfViewer: PdfViewerService;
    pdfAnnotationManager: PdfAnnotationManager;
  }).whiteboard = whiteboard;
  (window as unknown as {
    whiteboard: WhiteboardCanvas;
    storage: BoardStorageService;
    exporter: typeof BoardExporter;
    pdfExporter: typeof ClassNotePdfExporter;
    noteManager: ClassNoteManager;
    pdfViewer: PdfViewerService;
    pdfAnnotationManager: PdfAnnotationManager;
  }).storage = storageService;
  (window as unknown as {
    whiteboard: WhiteboardCanvas;
    storage: BoardStorageService;
    exporter: typeof BoardExporter;
    pdfExporter: typeof ClassNotePdfExporter;
    noteManager: ClassNoteManager;
    pdfViewer: PdfViewerService;
    pdfAnnotationManager: PdfAnnotationManager;
  }).exporter = BoardExporter;
  (window as unknown as {
    whiteboard: WhiteboardCanvas;
    storage: BoardStorageService;
    exporter: typeof BoardExporter;
    pdfExporter: typeof ClassNotePdfExporter;
    noteManager: ClassNoteManager;
    pdfViewer: PdfViewerService;
    pdfAnnotationManager: PdfAnnotationManager;
  }).pdfExporter = ClassNotePdfExporter;
  (window as unknown as {
    whiteboard: WhiteboardCanvas;
    storage: BoardStorageService;
    exporter: typeof BoardExporter;
    pdfExporter: typeof ClassNotePdfExporter;
    noteManager: ClassNoteManager;
    pdfViewer: PdfViewerService;
    pdfAnnotationManager: PdfAnnotationManager;
  }).noteManager = noteManager;
  (window as unknown as {
    whiteboard: WhiteboardCanvas;
    storage: BoardStorageService;
    exporter: typeof BoardExporter;
    pdfExporter: typeof ClassNotePdfExporter;
    noteManager: ClassNoteManager;
    pdfViewer: PdfViewerService;
    pdfAnnotationManager: PdfAnnotationManager;
  }).pdfViewer = pdfViewer;
  (window as unknown as {
    whiteboard: WhiteboardCanvas;
    storage: BoardStorageService;
    exporter: typeof BoardExporter;
    pdfExporter: typeof ClassNotePdfExporter;
    noteManager: ClassNoteManager;
    pdfViewer: PdfViewerService;
    pdfAnnotationManager: PdfAnnotationManager;
  }).pdfAnnotationManager = pdfAnnotationManager;

  // Board / Class Note persistence state
  let currentBoardId = noteManager.getClassNote().id;
  let currentBoardName = noteManager.getClassNote().name;
  let isInitialLoading = true;
  let autosaveTimer: number | null = null;

  // UI Toast notification helper
  const statusToast = document.getElementById('status-toast') as HTMLDivElement | null;
  let toastTimer: number | null = null;

  function showToast(message: string, durationMs: number = 2000): void {
    if (!statusToast) return;
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
    }
    statusToast.textContent = message;
    statusToast.classList.remove('hidden');
    toastTimer = window.setTimeout(() => {
      statusToast.classList.add('hidden');
      toastTimer = null;
    }, durationMs);
  }

  // Document (Class Note) Name Input
  const boardNameInput = document.getElementById('input-board-name') as HTMLInputElement | null;

  function setBoardName(name: string): void {
    currentBoardName = name.trim() || 'Untitled Class Note';
    noteManager.getClassNote().name = currentBoardName;
    if (boardNameInput) {
      boardNameInput.value = currentBoardName;
    }
  }

  if (boardNameInput) {
    boardNameInput.addEventListener('change', () => {
      setBoardName(boardNameInput.value);
      triggerManualSave(false);
    });
    boardNameInput.addEventListener('blur', () => {
      setBoardName(boardNameInput.value);
    });
  }

  // Synchronizes runtime BoardState into active page structure
  function syncCanvasToCurrentPage(): void {
    noteManager.syncCurrentPageObjects(
      whiteboard.boardState.getObjects(),
      whiteboard.getViewState()
    );
  }

  // Multi-Page UI Elements
  const btnTogglePagesDrawer = document.getElementById('btn-toggle-pages-drawer') as HTMLButtonElement | null;
  const labelPagesToggle = document.getElementById('label-pages-toggle') as HTMLSpanElement | null;
  const btnPrevPage = document.getElementById('btn-prev-page') as HTMLButtonElement | null;
  const btnNextPage = document.getElementById('btn-next-page') as HTMLButtonElement | null;
  const labelPageNumber = document.getElementById('label-page-number') as HTMLSpanElement | null;
  const inputPageName = document.getElementById('input-page-name') as HTMLInputElement | null;
  const btnAddPage = document.getElementById('btn-add-page') as HTMLButtonElement | null;
  const btnDuplicatePage = document.getElementById('btn-duplicate-page') as HTMLButtonElement | null;
  const btnDeletePage = document.getElementById('btn-delete-page') as HTMLButtonElement | null;
  const pagesThumbnailDrawer = document.getElementById('pages-thumbnail-drawer') as HTMLDivElement | null;
  const btnClosePagesDrawer = document.getElementById('btn-close-pages-drawer') as HTMLButtonElement | null;
  const pagesThumbnailList = document.getElementById('pages-thumbnail-list') as HTMLDivElement | null;

  // Undo / Redo button references
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null;
  const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement | null;

  function updateHistoryButtons(): void {
    if (undoBtn) {
      undoBtn.disabled = !whiteboard.history.canUndo();
    }
    if (redoBtn) {
      redoBtn.disabled = !whiteboard.history.canRedo();
    }
  }

  // Loads the currently active page into the whiteboard canvas
  function loadActivePageIntoCanvas(): void {
    const currPage = noteManager.getCurrentPage();
    const history = noteManager.getHistoryForPage(currPage.id, currPage.objects);

    whiteboard.loadPage(currPage.objects, history, currPage.viewState);

    // Register history change listener for the active page
    history.onChange(() => {
      updateHistoryButtons();
    });

    updatePageControls();
    updateHistoryButtons();
    updateEditButtonsState();
  }

  // Updates page controls and renders thumbnails
  function updatePageControls(): void {
    const currIdx = noteManager.getCurrentPageIndex();
    const total = noteManager.getTotalPages();
    const currPage = noteManager.getCurrentPage();

    if (labelPageNumber) {
      labelPageNumber.textContent = `Page ${currIdx + 1} of ${total}`;
    }
    if (labelPagesToggle) {
      labelPagesToggle.textContent = `Pages (${currIdx + 1}/${total})`;
    }
    if (inputPageName) {
      inputPageName.value = currPage.name;
    }

    if (btnPrevPage) {
      btnPrevPage.disabled = currIdx <= 0;
    }
    if (btnNextPage) {
      btnNextPage.disabled = currIdx >= total - 1;
    }
    if (btnDeletePage) {
      btnDeletePage.disabled = total <= 1;
    }

    renderThumbnailsList();
  }

  // Renders thumbnail previews for all pages
  function renderThumbnailsList(): void {
    if (!pagesThumbnailList) return;

    pagesThumbnailList.innerHTML = '';
    const pages = noteManager.getPages();
    const currPageId = noteManager.getCurrentPage().id;

    pages.forEach((page, idx) => {
      // If rendering active page, use live objects from whiteboard
      const pageToRender =
        page.id === currPageId
          ? { ...page, objects: Array.from(whiteboard.boardState.getObjects()) }
          : page;

      const thumbnailDataUrl = PageThumbnailRenderer.renderPageThumbnail(pageToRender, 140, 90);

      const card = document.createElement('div');
      card.className = `page-thumbnail-card ${page.id === currPageId ? 'active' : ''}`;
      card.setAttribute('data-page-id', page.id);

      card.innerHTML = `
        <div class="thumbnail-img-wrapper">
          <img src="${thumbnailDataUrl}" alt="${escapeHtml(page.name)}" />
        </div>
        <div class="thumbnail-meta-row">
          <span class="thumbnail-page-number">P${idx + 1}</span>
          <span class="thumbnail-page-title">${escapeHtml(page.name)}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (page.id !== currPageId) {
          syncCanvasToCurrentPage();
          noteManager.switchToPage(page.id, whiteboard.boardState.getObjects(), whiteboard.getViewState());
          loadActivePageIntoCanvas();
        }
      });

      pagesThumbnailList.appendChild(card);
    });
  }

  // Multi-Page Control Event Listeners
  if (btnTogglePagesDrawer && pagesThumbnailDrawer) {
    btnTogglePagesDrawer.addEventListener('click', (e) => {
      e.stopPropagation();
      pagesThumbnailDrawer.classList.toggle('hidden');
      if (!pagesThumbnailDrawer.classList.contains('hidden')) {
        syncCanvasToCurrentPage();
        renderThumbnailsList();
      }
    });
  }

  if (btnClosePagesDrawer && pagesThumbnailDrawer) {
    btnClosePagesDrawer.addEventListener('click', () => {
      pagesThumbnailDrawer.classList.add('hidden');
    });
  }

  if (btnPrevPage) {
    btnPrevPage.addEventListener('click', () => {
      syncCanvasToCurrentPage();
      const prev = noteManager.prevPage(whiteboard.boardState.getObjects(), whiteboard.getViewState());
      if (prev) {
        loadActivePageIntoCanvas();
      }
    });
  }

  if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
      syncCanvasToCurrentPage();
      const next = noteManager.nextPage(whiteboard.boardState.getObjects(), whiteboard.getViewState());
      if (next) {
        loadActivePageIntoCanvas();
      }
    });
  }

  if (btnAddPage) {
    btnAddPage.addEventListener('click', () => {
      syncCanvasToCurrentPage();
      noteManager.createNewPage(undefined, whiteboard.boardState.getObjects(), whiteboard.getViewState());
      loadActivePageIntoCanvas();
      showToast('Page created');
    });
  }

  if (btnDuplicatePage) {
    btnDuplicatePage.addEventListener('click', () => {
      syncCanvasToCurrentPage();
      noteManager.duplicateCurrentPage(whiteboard.boardState.getObjects(), whiteboard.getViewState());
      loadActivePageIntoCanvas();
      showToast('Page duplicated');
    });
  }

  if (btnDeletePage) {
    btnDeletePage.addEventListener('click', () => {
      if (noteManager.getTotalPages() <= 1) {
        showToast('Cannot delete the only remaining page.');
        return;
      }

      const confirmed = window.confirm('Delete this page?');
      if (!confirmed) return;

      const currId = noteManager.getCurrentPage().id;
      if (noteManager.deletePage(currId)) {
        loadActivePageIntoCanvas();
        showToast('Page deleted');
      }
    });
  }

  if (inputPageName) {
    inputPageName.addEventListener('change', () => {
      const newName = inputPageName.value.trim();
      noteManager.renamePage(noteManager.getCurrentPage().id, newName);
      updatePageControls();
    });
    inputPageName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        inputPageName.blur();
      }
    });
  }

  // Debounced Autosave for Entire Class Note
  function scheduleAutosave(): void {
    if (isInitialLoading) return;
    if (autosaveTimer !== null) {
      window.clearTimeout(autosaveTimer);
    }
    autosaveTimer = window.setTimeout(async () => {
      try {
        syncCanvasToCurrentPage();
        const note = noteManager.getClassNote();
        note.name = currentBoardName;
        await storageService.saveClassNote(note);
        console.log(`[Smart Board] Autosaved class note "${currentBoardName}" (${note.id})`);
      } catch (err) {
        console.error('[Smart Board] Autosave failed:', err);
      }
      autosaveTimer = null;
    }, 750);
  }

  // Subscribe to BoardState changes for autosave and thumbnails update
  whiteboard.boardState.onChange(() => {
    scheduleAutosave();
  });

  // Manual Save Function
  async function triggerManualSave(showConfirmation: boolean = true): Promise<void> {
    try {
      syncCanvasToCurrentPage();
      const note = noteManager.getClassNote();
      note.name = currentBoardName;
      await storageService.saveClassNote(note);
      if (showConfirmation) {
        showToast('Class note saved');
      }
      console.log(`[Smart Board] Manually saved class note "${currentBoardName}" (${note.id})`);
    } catch (err) {
      console.error('[Smart Board] Save failed:', err);
      showToast('Unable to save class note.');
    }
  }

  // 2. Load Last Opened Document or Create Initial ClassNote
  try {
    const lastOpenedId = await storageService.getLastOpenedNoteId();
    let loaded = false;

    if (lastOpenedId) {
      const storedNote = await storageService.loadClassNote(lastOpenedId);
      if (storedNote) {
        noteManager.setClassNote(storedNote);
        currentBoardId = storedNote.id;
        setBoardName(storedNote.name);
        loadActivePageIntoCanvas();
        loaded = true;
        console.log(`[Smart Board] Auto-loaded last opened class note "${storedNote.name}" (${storedNote.id})`);
      }
    }

    if (!loaded) {
      const newNote = storageService.createNewClassNote('Untitled Class Note');
      noteManager.setClassNote(newNote);
      currentBoardId = newNote.id;
      setBoardName(newNote.name);
      loadActivePageIntoCanvas();
      await storageService.saveClassNote(newNote);
      console.log(`[Smart Board] Created initial empty class note (${currentBoardId})`);
    }
  } catch (err) {
    console.error('[Smart Board] Error initializing class note from IndexedDB:', err);
    showToast('Failed to load storage database.');
  } finally {
    isInitialLoading = false;
  }

  // 3. Setup Top Bar Actions (New, Boards List, Save, Export, Settings)
  const newBoardBtn = document.getElementById('btn-new-board') as HTMLButtonElement | null;
  const boardsListBtn = document.getElementById('btn-boards-list') as HTMLButtonElement | null;
  const saveBtn = document.getElementById('btn-save') as HTMLButtonElement | null;
  const exportBtn = document.getElementById('btn-export') as HTMLButtonElement | null;
  const exportPopover = document.getElementById('export-popover') as HTMLDivElement | null;
  const exportPngBtn = document.getElementById('btn-export-png') as HTMLButtonElement | null;
  const exportSvgBtn = document.getElementById('btn-export-svg') as HTMLButtonElement | null;
  const exportPrintBtn = document.getElementById('btn-export-print') as HTMLButtonElement | null;
  const exportPdfBtn = document.getElementById('btn-export-classnote-pdf') as HTMLButtonElement | null;
  const settingsBtn = document.getElementById('btn-settings') as HTMLButtonElement | null;

  function closeExportPopover(): void {
    if (exportPopover) {
      exportPopover.classList.add('hidden');
    }
  }

  if (exportBtn && exportPopover) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeShapesPopover();
      closeTextPopover();
      exportPopover.classList.toggle('hidden');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', async () => {
      closeExportPopover();
      try {
        syncCanvasToCurrentPage();
        showToast('Exporting class note as PDF...');

        await ClassNotePdfExporter.exportClassNoteToPdf(
          noteManager.getClassNote(),
          whiteboard.boardState,
          (curr, total) => {
            showToast(`Exporting page ${curr} of ${total}...`, 800);
          }
        );

        showToast('Class note exported successfully');
      } catch (err) {
        console.error('[Smart Board] Class note PDF export failed:', err);
        showToast('Unable to export class note.');
      }
    });
  }

  if (exportPngBtn) {
    exportPngBtn.addEventListener('click', async () => {
      closeExportPopover();
      try {
        const currPage = noteManager.getCurrentPage();
        await BoardExporter.exportPNG(whiteboard.boardState, `${currentBoardName} - ${currPage.name}`);
        showToast('Exported PNG');
      } catch (err) {
        console.error('[Smart Board] PNG export failed:', err);
        showToast('Failed to export PNG.');
      }
    });
  }

  if (exportSvgBtn) {
    exportSvgBtn.addEventListener('click', async () => {
      closeExportPopover();
      try {
        const currPage = noteManager.getCurrentPage();
        await BoardExporter.exportSVG(whiteboard.boardState, `${currentBoardName} - ${currPage.name}`);
        showToast('Exported SVG');
      } catch (err) {
        console.error('[Smart Board] SVG export failed:', err);
        showToast('Failed to export SVG.');
      }
    });
  }

  if (exportPrintBtn) {
    exportPrintBtn.addEventListener('click', async () => {
      closeExportPopover();
      try {
        const currPage = noteManager.getCurrentPage();
        await BoardExporter.printBoard(whiteboard.boardState, `${currentBoardName} - ${currPage.name}`);
      } catch (err) {
        console.error('[Smart Board] Print failed:', err);
        showToast('Failed to print board.');
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      triggerManualSave(true);
    });
  }

  if (newBoardBtn) {
    newBoardBtn.addEventListener('click', async () => {
      const hasContent = noteManager.getPages().some((p) => p.objects.length > 0) || whiteboard.boardState.getObjects().length > 0;
      if (hasContent) {
        const confirmed = window.confirm('Create a new class note? Any changes will be saved.');
        if (!confirmed) return;
      }

      // Save current class note before switching
      await triggerManualSave(false);

      // Create new blank ClassNote
      const newNote = storageService.createNewClassNote('Untitled Class Note');
      noteManager.setClassNote(newNote);
      currentBoardId = newNote.id;
      setBoardName(newNote.name);

      loadActivePageIntoCanvas();

      await storageService.saveClassNote(newNote);
      showToast('New class note created');
    });
  }

  // 3.5 PDF Viewer Controls & Page Annotation Setup
  const inputPdfUpload = document.getElementById('input-pdf-upload') as HTMLInputElement | null;
  const uploadPdfBtn = document.getElementById('btn-upload-pdf') as HTMLButtonElement | null;
  const pdfDockPanel = document.getElementById('pdf-dock-panel') as HTMLDivElement | null;
  const pdfDocTitle = document.getElementById('pdf-doc-title') as HTMLSpanElement | null;
  const btnPdfPrev = document.getElementById('btn-pdf-prev') as HTMLButtonElement | null;
  const btnPdfNext = document.getElementById('btn-pdf-next') as HTMLButtonElement | null;
  const pdfPageIndicator = document.getElementById('pdf-page-indicator') as HTMLSpanElement | null;
  const btnPdfFit = document.getElementById('btn-pdf-fit') as HTMLButtonElement | null;
  const btnPdfClose = document.getElementById('btn-pdf-close') as HTMLButtonElement | null;

  async function saveActivePdfPageAnnotations(): Promise<void> {
    if (!pdfViewer.hasPdf()) return;
    const doc = pdfViewer.getCurrentDocument();
    if (!doc) return;
    const pageNum = pdfViewer.getCurrentPageNumber();
    const objs = whiteboard.boardState.getObjects();
    pdfAnnotationManager.setPageAnnotations(doc.id, pageNum, objs);
    await storageService.savePdfAnnotations(doc.id, pageNum, objs);
  }

  async function loadPdfPageWithAnnotations(targetPageNum: number): Promise<void> {
    if (!pdfViewer.hasPdf() || !pdfDockPanel) return;
    const doc = pdfViewer.getCurrentDocument();
    if (!doc) return;

    // 1. Save active annotations for current PDF page before changing page
    const oldPageNum = pdfViewer.getCurrentPageNumber();
    if (oldPageNum !== targetPageNum && pdfAnnotationManager.getActivePdfDocumentId() === doc.id) {
      const currentObjs = whiteboard.boardState.getObjects();
      pdfAnnotationManager.setPageAnnotations(doc.id, oldPageNum, currentObjs);
      await storageService.savePdfAnnotations(doc.id, oldPageNum, currentObjs);
    }

    // 2. Render target PDF page bitmap
    const canvas = await pdfViewer.renderPage(targetPageNum);
    const dimensions = pdfViewer.getPageDimensions()!;

    // 3. Update active page reference in annotation manager
    pdfAnnotationManager.setActivePage(doc.id, targetPageNum);

    // 4. Fetch annotations for target page (from memory or storage)
    let pageObjs = pdfAnnotationManager.getPageAnnotations(doc.id, targetPageNum);
    if (pageObjs.length === 0) {
      pageObjs = await storageService.loadPdfAnnotations(doc.id, targetPageNum);
      pdfAnnotationManager.setPageAnnotations(doc.id, targetPageNum, pageObjs);
    }

    // 5. Load page objects into whiteboard canvas state with clean history for that page
    const pdfPageHistory = new HistoryManager();
    pdfPageHistory.init(pageObjs);
    whiteboard.loadPage(pageObjs, pdfPageHistory);

    // 6. Set PDF background canvas layer
    whiteboard.setPdfPage({
      canvas,
      dimensions,
      pdfDocumentId: doc.id,
      pageNumber: targetPageNum,
    });

    // 7. Update UI status indicators
    const total = pdfViewer.getPageCount();
    if (pdfDocTitle) pdfDocTitle.textContent = doc.fileName || doc.name;
    if (pdfPageIndicator) pdfPageIndicator.textContent = `PDF Page ${targetPageNum} of ${total}`;
    if (btnPdfPrev) btnPdfPrev.disabled = targetPageNum <= 1;
    if (btnPdfNext) btnPdfNext.disabled = targetPageNum >= total;
  }

  if (uploadPdfBtn && inputPdfUpload) {
    uploadPdfBtn.addEventListener('click', () => {
      inputPdfUpload.click();
    });

    inputPdfUpload.addEventListener('change', async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      // Validate PDF MIME type and extension
      const isPdf =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        showToast('Please select a PDF file.');
        target.value = '';
        return;
      }

      if (pdfViewer.hasPdf()) {
        const confirmed = window.confirm('Replace the current PDF?');
        if (!confirmed) {
          target.value = '';
          return;
        }
        await saveActivePdfPageAnnotations();
      }

      try {
        showToast('Loading PDF document...');
        const arrayBuffer = await file.arrayBuffer();
        await pdfViewer.loadPdf(arrayBuffer, file.name);

        if (pdfDockPanel) {
          pdfDockPanel.classList.remove('hidden');
        }

        // Initialize and load Page 1 annotations
        pdfAnnotationManager.clearAll();
        await loadPdfPageWithAnnotations(1);

        const dims = pdfViewer.getPageDimensions();
        if (dims) {
          whiteboard.fitToPdfPage(dims);
        }

        showToast('PDF loaded successfully');
      } catch (err: any) {
        console.error('[Smart Board] Failed to load PDF:', err);
        showToast(err?.message || 'Unable to open this PDF.');
      } finally {
        target.value = '';
      }
    });
  }

  if (btnPdfPrev) {
    btnPdfPrev.addEventListener('click', async () => {
      const curr = pdfViewer.getCurrentPageNumber();
      if (curr > 1) {
        await loadPdfPageWithAnnotations(curr - 1);
      }
    });
  }

  if (btnPdfNext) {
    btnPdfNext.addEventListener('click', async () => {
      const curr = pdfViewer.getCurrentPageNumber();
      if (curr < pdfViewer.getPageCount()) {
        await loadPdfPageWithAnnotations(curr + 1);
      }
    });
  }

  if (btnPdfFit) {
    btnPdfFit.addEventListener('click', () => {
      const dims = pdfViewer.getPageDimensions();
      if (dims) {
        whiteboard.fitToPdfPage(dims);
      }
    });
  }

  if (btnPdfClose) {
    btnPdfClose.addEventListener('click', async () => {
      if (pdfViewer.hasPdf()) {
        await saveActivePdfPageAnnotations();
        pdfViewer.closePdf();
        whiteboard.setPdfPage(null);
        if (pdfDockPanel) {
          pdfDockPanel.classList.add('hidden');
        }
        pdfAnnotationManager.clearAll();
        loadActivePageIntoCanvas();
        showToast('Closed PDF');
      }
    });
  }

  // Saved Class Notes Modal Dialog
  const boardsModalOverlay = document.getElementById('boards-modal-overlay') as HTMLDivElement | null;
  const closeBoardsModalBtn = document.getElementById('btn-close-boards-modal') as HTMLButtonElement | null;
  const boardsListContainer = document.getElementById('boards-list-container') as HTMLDivElement | null;

  function closeBoardsModal(): void {
    if (boardsModalOverlay) {
      boardsModalOverlay.classList.add('hidden');
    }
  }

  async function openBoardsModal(): Promise<void> {
    if (!boardsModalOverlay || !boardsListContainer) return;

    boardsModalOverlay.classList.remove('hidden');
    boardsListContainer.innerHTML = '<div class="empty-boards-message">Loading saved class notes...</div>';

    try {
      const summaries = await storageService.listBoards();
      renderBoardsList(summaries);
    } catch (err) {
      console.error('[Smart Board] Failed to list saved class notes:', err);
      boardsListContainer.innerHTML = '<div class="empty-boards-message">Failed to load saved class notes.</div>';
    }
  }

  function renderBoardsList(boards: StoredBoardSummary[]): void {
    if (!boardsListContainer) return;

    if (boards.length === 0) {
      boardsListContainer.innerHTML = '<div class="empty-boards-message">No saved class notes found.</div>';
      return;
    }

    boardsListContainer.innerHTML = '';

    for (const board of boards) {
      const isCurrent = board.id === currentBoardId;
      const dateStr = new Date(board.updatedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const item = document.createElement('div');
      item.className = `saved-board-item ${isCurrent ? 'active' : ''}`;

      item.innerHTML = `
        <div class="saved-board-info">
          <span class="saved-board-title">${escapeHtml(board.name)} ${isCurrent ? '<small>(Current)</small>' : ''}</span>
          <span class="saved-board-meta">
            <span>${board.pageCount} page${board.pageCount === 1 ? '' : 's'}</span>
            <span>•</span>
            <span>${board.objectCount} object${board.objectCount === 1 ? '' : 's'}</span>
            <span>•</span>
            <span>Updated: ${dateStr}</span>
          </span>
        </div>
        <div class="saved-board-actions">
          ${
            !isCurrent
              ? `<button class="btn-open-board" data-id="${board.id}">Open</button>`
              : ''
          }
          <button class="btn-delete-board" data-id="${board.id}" title="Delete this class note">Delete</button>
        </div>
      `;

      const openBtn = item.querySelector<HTMLButtonElement>('.btn-open-board');
      if (openBtn) {
        openBtn.addEventListener('click', async () => {
          await loadSavedBoard(board.id);
          closeBoardsModal();
        });
      }

      const deleteBtn = item.querySelector<HTMLButtonElement>('.btn-delete-board');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          const confirmed = window.confirm(`Are you sure you want to delete "${board.name}"?`);
          if (!confirmed) return;

          await storageService.deleteBoard(board.id);

          if (board.id === currentBoardId) {
            // Deleted currently active class note -> create a new one
            const newNote = storageService.createNewClassNote('Untitled Class Note');
            noteManager.setClassNote(newNote);
            currentBoardId = newNote.id;
            setBoardName(newNote.name);
            loadActivePageIntoCanvas();
            await storageService.saveClassNote(newNote);
          }

          showToast('Class note deleted');
          const updatedSummaries = await storageService.listBoards();
          renderBoardsList(updatedSummaries);
        });
      }

      boardsListContainer.appendChild(item);
    }
  }

  async function loadSavedBoard(id: string): Promise<void> {
    try {
      // Save current document before switching
      await triggerManualSave(false);

      const storedNote = await storageService.loadClassNote(id);
      if (!storedNote) {
        showToast('Class note not found.');
        return;
      }

      noteManager.setClassNote(storedNote);
      currentBoardId = storedNote.id;
      setBoardName(storedNote.name);

      loadActivePageIntoCanvas();

      showToast(`Opened "${storedNote.name}"`);
      console.log(`[Smart Board] Opened class note "${storedNote.name}" (${storedNote.id})`);
    } catch (err) {
      console.error('[Smart Board] Failed to open class note:', err);
      showToast('Unable to open class note.');
    }
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (boardsListBtn) {
    boardsListBtn.addEventListener('click', () => {
      openBoardsModal();
    });
  }

  if (closeBoardsModalBtn) {
    closeBoardsModalBtn.addEventListener('click', () => {
      closeBoardsModal();
    });
  }

  if (boardsModalOverlay) {
    boardsModalOverlay.addEventListener('click', (e) => {
      if (e.target === boardsModalOverlay) {
        closeBoardsModal();
      }
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      console.log('[Smart Board] Settings clicked');
    });
  }

  // 4. Setup Undo, Redo, and Clear Controls
  const clearBtn = document.getElementById('btn-clear') as HTMLButtonElement | null;

  if (undoBtn && redoBtn) {
    undoBtn.addEventListener('click', () => {
      whiteboard.undo();
      updateHistoryButtons();
      console.log('[Smart Board] Undo action executed.');
    });

    redoBtn.addEventListener('click', () => {
      whiteboard.redo();
      updateHistoryButtons();
      console.log('[Smart Board] Redo action executed.');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (pdfViewer.hasPdf()) {
        const confirmed = window.confirm('Clear all annotations on this PDF page?');
        if (confirmed) {
          whiteboard.boardState.clear();
          whiteboard.history.recordAction([]);
          const doc = pdfViewer.getCurrentDocument()!;
          const pageNum = pdfViewer.getCurrentPageNumber();
          pdfAnnotationManager.clearPageAnnotations(doc.id, pageNum);
          await storageService.savePdfAnnotations(doc.id, pageNum, []);
          whiteboard.render();
          showToast('Cleared PDF page annotations');
        }
      } else {
        whiteboard.clearBoard();
      }
      updateHistoryButtons();
    });
  }

  // 5. Setup Edit Action Buttons (Copy, Paste, Delete)
  const copyBtn = document.getElementById('btn-copy') as HTMLButtonElement | null;
  const pasteBtn = document.getElementById('btn-paste') as HTMLButtonElement | null;
  const deleteBtn = document.getElementById('btn-delete') as HTMLButtonElement | null;

  function updateEditButtonsState(): void {
    const selectedIds = whiteboard.selectionManager.getSelectedIds();
    const selectedObjects = selectedIds
      .map((id) => whiteboard.boardState.getObject(id))
      .filter((obj): obj is BoardObject => obj !== undefined && obj !== null);

    const hasSelection = selectedObjects.length > 0;
    const hasUnlockedSelection = selectedObjects.some((o) => !o.locked);
    const hasClipboard = whiteboard.clipboard.hasObjects();

    if (copyBtn) copyBtn.disabled = !hasSelection;
    if (deleteBtn) deleteBtn.disabled = !hasUnlockedSelection;
    if (pasteBtn) pasteBtn.disabled = !hasClipboard;
  }

  whiteboard.selectionManager.onChange(() => updateEditButtonsState());
  whiteboard.clipboard.onChange(() => updateEditButtonsState());
  whiteboard.boardState.onChange(() => updateEditButtonsState());

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      whiteboard.copySelected();
    });
  }

  if (pasteBtn) {
    pasteBtn.addEventListener('click', () => {
      whiteboard.paste();
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      whiteboard.deleteSelected();
    });
  }

  // 6. Setup Unified Keyboard Shortcuts
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }

    // Ctrl+S (Manual Save)
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      triggerManualSave(true);
      return;
    }

    // Ctrl+P (Print Board)
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      const currPage = noteManager.getCurrentPage();
      BoardExporter.printBoard(whiteboard.boardState, `${currentBoardName} - ${currPage.name}`);
      return;
    }

    // Ctrl+Z (Undo) / Ctrl+Y or Ctrl+Shift+Z (Redo)
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        whiteboard.undo();
        updateHistoryButtons();
        return;
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey)) {
        e.preventDefault();
        whiteboard.redo();
        updateHistoryButtons();
        return;
      }
    }

    // Ctrl+C (Copy)
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'c' || e.key === 'C') && !e.shiftKey) {
      if (whiteboard.selectionManager.hasSelection()) {
        e.preventDefault();
        whiteboard.copySelected();
        return;
      }
    }

    // Ctrl+V (Paste)
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'v' || e.key === 'V') && !e.shiftKey) {
      if (whiteboard.clipboard.hasObjects()) {
        e.preventDefault();
        whiteboard.paste();
        return;
      }
    }

    // Delete / Backspace (Delete selected objects)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (whiteboard.selectionManager.hasSelection()) {
        e.preventDefault();
        whiteboard.deleteSelected();
        return;
      }
    }
  });

  // 7. Setup Color Picker & Stroke Width Slider Controls
  const colorInput = document.getElementById('input-color') as HTMLInputElement | null;
  const widthInput = document.getElementById('input-width') as HTMLInputElement | null;
  const widthValueLabel = document.getElementById('width-value-label') as HTMLElement | null;

  if (colorInput) {
    colorInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      whiteboard.setColor(target.value);
    });
  }

  if (widthInput && widthValueLabel) {
    widthInput.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      const widthVal = parseInt(target.value, 10);
      whiteboard.setWidth(widthVal);
      widthValueLabel.textContent = `${widthVal} px`;
    });
  }

  // 8. Setup Zoom & Pan View Controls
  const zoomInBtn = document.getElementById('btn-zoom-in') as HTMLButtonElement | null;
  const zoomOutBtn = document.getElementById('btn-zoom-out') as HTMLButtonElement | null;
  const zoomResetBtn = document.getElementById('btn-zoom-reset') as HTMLButtonElement | null;
  const zoomValueLabel = document.getElementById('zoom-value-label') as HTMLElement | null;

  function updateZoomLabel(): void {
    if (zoomValueLabel) {
      zoomValueLabel.textContent = `${whiteboard.getZoomPercentage()}%`;
    }
  }

  whiteboard.viewTransform.onChange(() => {
    updateZoomLabel();
  });

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      whiteboard.zoomIn();
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      whiteboard.zoomOut();
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      whiteboard.resetView();
    });
  }

  // 9. Setup Shapes Popover Dropdown Selection
  const shapesToolBtn = document.getElementById('tool-shapes') as HTMLButtonElement | null;
  const shapesPopover = document.getElementById('shapes-popover') as HTMLDivElement | null;
  const shapeOptionBtns = document.querySelectorAll<HTMLButtonElement>('.shape-option-btn');
  const shapesMainIcon = document.getElementById('shapes-main-icon') as SVGElement | null;

  function closeShapesPopover(): void {
    if (shapesPopover) {
      shapesPopover.classList.add('hidden');
    }
  }

  if (shapesToolBtn && shapesPopover) {
    shapesToolBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTextPopover();
      closeExportPopover();
      shapesPopover.classList.toggle('hidden');
    });
  }

  shapeOptionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const shapeType = btn.getAttribute('data-shape') as ShapeType;
      if (!shapeType) return;

      closeShapesPopover();
      whiteboard.setTool(shapeType);

      toolButtons.forEach((b) => b.classList.remove('active'));
      if (shapesToolBtn) {
        shapesToolBtn.classList.add('active');
      }

      if (shapesMainIcon) {
        if (shapeType === 'rectangle') {
          shapesMainIcon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>';
        } else if (shapeType === 'ellipse') {
          shapesMainIcon.innerHTML = '<ellipse cx="12" cy="12" rx="9" ry="7"></ellipse>';
        } else if (shapeType === 'triangle') {
          shapesMainIcon.innerHTML = '<polygon points="12 3 21 20 3 20"></polygon>';
        }
      }

      console.log(`[Smart Board] Selected shape: ${shapeType}`);
    });
  });

  // 10. Setup Text Tool Popover & Font Controls
  const textToolBtn = document.getElementById('tool-text') as HTMLButtonElement | null;
  const textPopover = document.getElementById('text-popover') as HTMLDivElement | null;
  const fontSelect = document.getElementById('select-font-family') as HTMLSelectElement | null;
  const fontSizeInput = document.getElementById('input-font-size') as HTMLInputElement | null;
  const fontSizeLabel = document.getElementById('font-size-label') as HTMLSpanElement | null;
  const alignBtns = document.querySelectorAll<HTMLButtonElement>('.text-align-btn');

  function closeTextPopover(): void {
    if (textPopover) {
      textPopover.classList.add('hidden');
    }
  }

  if (textToolBtn && textPopover) {
    textToolBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeShapesPopover();
      closeExportPopover();
      textPopover.classList.toggle('hidden');
      whiteboard.setTool('text');
      updateActiveToolButton(textToolBtn);
    });
  }

  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      whiteboard.setFontFamily(fontSelect.value);
    });
  }

  if (fontSizeInput && fontSizeLabel) {
    fontSizeInput.addEventListener('input', () => {
      const sizeVal = parseInt(fontSizeInput.value, 10);
      whiteboard.setFontSize(sizeVal);
      fontSizeLabel.textContent = `${sizeVal} px`;
    });
  }

  alignBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const align = btn.getAttribute('data-align') as TextAlign;
      if (!align) return;

      alignBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      whiteboard.setTextAlign(align);
    });
  });

  // Close popovers on click outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (shapesPopover && !shapesPopover.contains(target) && target !== shapesToolBtn) {
      closeShapesPopover();
    }
    if (textPopover && !textPopover.contains(target) && target !== textToolBtn) {
      closeTextPopover();
    }
    if (exportPopover && !exportPopover.contains(target) && target !== exportBtn) {
      closeExportPopover();
    }
    if (
      pagesThumbnailDrawer &&
      !pagesThumbnailDrawer.contains(target) &&
      target !== btnTogglePagesDrawer &&
      !btnTogglePagesDrawer?.contains(target)
    ) {
      pagesThumbnailDrawer.classList.add('hidden');
    }
  });

  // 11. Setup Bottom Toolbar Interactions for Tools
  const toolButtons = document.querySelectorAll<HTMLButtonElement>(
    '.tool-btn:not(.action-btn-history):not(.action-btn-edit)'
  );

  function updateActiveToolButton(activeButton: HTMLButtonElement): void {
    toolButtons.forEach((btn) => btn.classList.remove('active'));
    activeButton.classList.add('active');
  }

  toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const toolName = button.getAttribute('data-tool');
      if (!toolName) return;

      if (toolName === 'shapes' || toolName === 'text') {
        return;
      }

      if (
        toolName === 'pen' ||
        toolName === 'pencil' ||
        toolName === 'highlighter' ||
        toolName === 'eraser' ||
        toolName === 'select' ||
        toolName === 'lasso' ||
        toolName === 'line' ||
        toolName === 'arrow' ||
        toolName === 'equation'
      ) {
        closeShapesPopover();
        closeTextPopover();
        closeExportPopover();
        whiteboard.setTool(toolName as DrawingTool);
        updateActiveToolButton(button);

        // Sync UI inputs with active tool values
        if (
          colorInput &&
          toolName !== 'eraser' &&
          toolName !== 'select' &&
          toolName !== 'lasso'
        ) {
          colorInput.value = whiteboard.getColor();
        }
        if (
          widthInput &&
          widthValueLabel &&
          toolName !== 'select' &&
          toolName !== 'lasso' &&
          toolName !== 'equation'
        ) {
          widthInput.value = whiteboard.getWidth().toString();
          widthValueLabel.textContent = `${whiteboard.getWidth()} px`;
        }

        console.log(`[Smart Board] Active tool: ${toolName}`);
      } else {
        console.log(`[Smart Board] ${toolName} tool will be enabled in upcoming steps.`);
      }
    });
  });

  console.log('[AI Smart Board] Step 20 Multi-Page Class Notes initialized.');
});
