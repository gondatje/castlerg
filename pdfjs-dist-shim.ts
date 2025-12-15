export type TextItem = { str?: string };

export type PDFPageProxy = {
  getTextContent: () => Promise<{ items: TextItem[] }>;
};

export type PDFDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
  destroy?: () => Promise<void> | void;
};

const PDFJS_VERSION = "4.10.38";
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;
const WORKER_SRC = `${PDFJS_BASE}/pdf.worker.min.mjs`;

const loadPdfjs = async () => {
  const pdfjs = (await import(/* @vite-ignore */ `${PDFJS_BASE}/pdf.mjs`)) as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> };
  };

  if (pdfjs.GlobalWorkerOptions.workerSrc !== WORKER_SRC) {
    pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
  }

  return pdfjs;
};

export const GlobalWorkerOptions = {
  workerSrc: WORKER_SRC,
};

export const getDocument = (options: { data: ArrayBuffer }) => {
  const taskPromise = loadPdfjs().then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = GlobalWorkerOptions.workerSrc;
    return pdfjs.getDocument(options);
  });

  return {
    promise: taskPromise.then((task) => task.promise),
  };
};
