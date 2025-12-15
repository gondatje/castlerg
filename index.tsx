import React, { useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { getDocument, type PDFDocumentProxy, type TextItem } from "pdfjs-dist";

// --- Types ---
interface ReturningGuest {
  guestName: string;
  confirmationNumber: string;
  identifiedBy: "Fixed Charge" | "Previous Stays" | "Both";
  numberOfPreviousStays: string | number;
  fixedChargeDescription: string;
  fixedChargeAmount: string;
  accompanyingGuests: string;
}

// --- Utils ---
const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const toPositiveAmount = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const match = value.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!match) return "N/A";
  const numeric = Math.abs(parseFloat(match[0].replace(/,/g, "")));
  return numeric.toFixed(2);
};

const extractPdfText = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf: PDFDocumentProxy = await getDocument({ data: arrayBuffer }).promise;

  try {
    const pageTexts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => {
          const textItem = item as TextItem;
          return textItem?.str ?? "";
        })
        .join(" ");
      pageTexts.push(pageText);
    }

    return pageTexts.join("\n");
  } finally {
    await pdf.destroy?.();
  }
};

const extractAccompanyingGuests = (section: string) => {
  const match = section.match(/Accompanying Guests?\s*[:\-]?\s*([^\n]+?)(?=Confirmation Number|Number of stays|$)/i);
  if (match && match[1]) {
    const value = normalizeWhitespace(match[1]);
    if (value && !/none/i.test(value)) return value;
  }
  return "None";
};

const parseReturningGuests = (text: string): ReturningGuest[] => {
  const normalized = text.replace(/\r/g, "\n");
  const sections = normalized.split(/(?=Confirmation Number\s*[:#]?\s*[A-Za-z0-9-]+)/gi);

  const guests: ReturningGuest[] = [];

  for (const section of sections) {
    const confirmationMatch = section.match(/Confirmation Number\s*[:#]?\s*([A-Za-z0-9-]+)/i);
    if (!confirmationMatch) continue;

    const confirmationNumber = confirmationMatch[1].trim();

    const nameMatch =
      section.match(/Primary Guest\s*[:\-]?\s*([^\n]+?)(?=Confirmation Number|Number of stays|Return|$)/i) ||
      section.match(/Guest Name\s*[:\-]?\s*([^\n]+?)(?=Confirmation Number|Number of stays|Return|$)/i);
    const guestName = nameMatch ? normalizeWhitespace(nameMatch[1]) : "Unknown Guest";

    const staysMatch = section.match(/Number of stays\s*[:#]?\s*(\d+)/i);
    const numberOfPreviousStays = staysMatch ? parseInt(staysMatch[1], 10) : 0;

    const fixedChargeRegex = /(Returning? Guest Credit|Return Guest Credit|Return Guest Thank[^\n]*)/i;
    const fixedChargeMatch = section.match(fixedChargeRegex);
    const amountMatch = section.match(/Return(?:ing)? Guest[^\d\n]*([-+]?\$?\d[\d,]*(?:\.\d+)?)/i);

    const hasFixedCharge = Boolean(fixedChargeMatch);
    const hasPreviousStays = numberOfPreviousStays >= 1;

    if (!hasFixedCharge && !hasPreviousStays) continue;

    const identifiedBy: ReturningGuest["identifiedBy"] =
      hasFixedCharge && hasPreviousStays
        ? "Both"
        : hasFixedCharge
          ? "Fixed Charge"
          : "Previous Stays";

    const fixedChargeDescription = hasFixedCharge
      ? normalizeWhitespace(fixedChargeMatch?.[0] || "Return Guest Credit")
      : "None";

    const fixedChargeAmount = hasFixedCharge ? toPositiveAmount(amountMatch?.[1]) : "N/A";

    const accompanyingGuests = extractAccompanyingGuests(section);

    guests.push({
      guestName,
      confirmationNumber,
      identifiedBy,
      numberOfPreviousStays: hasPreviousStays ? numberOfPreviousStays : "0",
      fixedChargeDescription,
      fixedChargeAmount,
      accompanyingGuests,
    });
  }

  return guests;
};

// --- Styles ---
const styles = `
  :root {
    --bg-color: #F5F5F7;
    --text-primary: #1d1d1f;
    --text-secondary: #86868b;
    --accent-blue: #0071e3;
    --card-bg: #ffffff;
    --border-color: #d2d2d7;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
    line-height: 1.5;
    padding: 40px 20px;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
  }

  .header {
    text-align: center;
    margin-bottom: 40px;
  }

  .header h1 {
    font-size: 32px;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
  }

  .header p {
    color: var(--text-secondary);
    font-size: 17px;
  }

  /* Dropzone */
  .dropzone {
    background: var(--card-bg);
    border: 2px dashed var(--border-color);
    border-radius: 12px;
    padding: 60px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 40px;
  }

  .dropzone:hover, .dropzone.active {
    border-color: var(--accent-blue);
    background-color: rgba(0, 113, 227, 0.02);
  }

  .dropzone-icon {
    font-size: 48px;
    color: var(--accent-blue);
    margin-bottom: 16px;
    display: block;
  }

  .dropzone-text {
    font-size: 19px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .dropzone-subtext {
    color: var(--text-secondary);
    font-size: 14px;
  }

  /* Results */
  .results-grid {
    display: grid;
    gap: 24px;
  }

  .guest-card {
    background: var(--card-bg);
    border-radius: 16px;
    padding: 24px;
    box-shadow: var(--shadow-md);
    transition: transform 0.2s ease;
  }

  .guest-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #f0f0f0;
  }

  .guest-name {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .guest-conf {
    font-family: "SF Mono", SFMono-Regular, ui-monospace, monospace;
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge-blue { background: rgba(0, 113, 227, 0.1); color: var(--accent-blue); }
  .badge-purple { background: rgba(175, 82, 222, 0.1); color: #af52de; }
  .badge-green { background: rgba(52, 199, 89, 0.1); color: #34c759; }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
  }

  .detail-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    margin-bottom: 4px;
    font-weight: 600;
  }

  .detail-value {
    font-size: 15px;
    color: var(--text-primary);
  }

  /* Loading Spinner */
  .spinner-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(0, 113, 227, 0.1);
    border-radius: 50%;
    border-top-color: var(--accent-blue);
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    color: var(--text-secondary);
    font-size: 15px;
  }

  .error-message {
    background-color: #fff2f2;
    border: 1px solid #ffcccc;
    color: #ff3b30;
    padding: 16px;
    border-radius: 8px;
    text-align: center;
    margin-bottom: 24px;
  }
`;

// --- Components ---

const LoadingState = () => (
  <div className="spinner-container">
    <div className="spinner"></div>
    <div className="loading-text">Analyzing Arrivals Report...</div>
  </div>
);

const GuestCard: React.FC<{ guest: ReturningGuest }> = ({ guest }) => {
  let badgeColor = "badge-blue";
  if (guest.identifiedBy === "Previous Stays") badgeColor = "badge-green";
  if (guest.identifiedBy === "Both") badgeColor = "badge-purple";

  return (
    <div className="guest-card">
      <div className="guest-card-header">
        <div>
          <div className="guest-name">{guest.guestName}</div>
          <div className="guest-conf">#{guest.confirmationNumber}</div>
        </div>
        <span className={`badge ${badgeColor}`}>{guest.identifiedBy}</span>
      </div>
      
      <div className="details-grid">
        <div className="detail-item">
          <span className="detail-label">Prev. Stays</span>
          <span className="detail-value">{guest.numberOfPreviousStays}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Accompanying</span>
          <span className="detail-value">{guest.accompanyingGuests}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Fixed Charge</span>
          <span className="detail-value">{guest.fixedChargeDescription}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Amount</span>
          <span className="detail-value">{guest.fixedChargeAmount}</span>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ReturningGuest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Local PDF Parsing Logic ---
  const analyzeFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const pdfText = await extractPdfText(file);
      const parsedData = parseReturningGuests(pdfText);
      setResults(parsedData);
    } catch (err: any) {
      console.error("PDF parsing failed:", err);
      const humanMessage = err?.message && /InvalidPDF/i.test(err.message)
        ? "We couldn't read that PDF file. Please make sure it's a valid Arrivals PDF and try again."
        : err?.message
          ? `Unable to analyze PDF: ${err.message}`
          : "Unable to analyze PDF.";
      setError(humanMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Event Handlers ---
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type === "application/pdf") {
          analyzeFile(file);
        } else {
          setError("Please upload a PDF file to analyze.");
        }
      }
    },
    [analyzeFile],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      analyzeFile(e.target.files[0]);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="container">
        <header className="header">
          <h1>Return Guest Analyser</h1>
          <p>Identify returning guests automatically.</p>
        </header>

        {!results && !isLoading && (
          <div 
            className={`dropzone ${dragActive ? "active" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf" 
              style={{ display: "none" }} 
              onChange={handleFileInput} 
            />
            <span className="dropzone-icon">📄</span>
            <div className="dropzone-text">Drag & drop Arrivals PDF</div>
            <div className="dropzone-subtext">or click to browse</div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {isLoading && <LoadingState />}

        {results && (
          <div className="results-grid">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Returning Guests Found ({results.length})</h2>
              <button 
                onClick={() => setResults(null)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--accent-blue)', 
                  cursor: 'pointer', 
                  fontSize: '15px' 
                }}
              >
                Analyze Another
              </button>
            </div>
            
            {results.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                No returning guests identified in this report.
              </div>
            ) : (
              results.map((guest, idx) => (
                <GuestCard key={idx} guest={guest} />
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);