import React, { useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Schema, Type } from "@google/genai";

// --- Types ---
interface ReturningGuest {
  guestName: string;
  confirmationNumber: string;
  arrivalDate: string;
  departureDate: string;
  identifiedBy: "Fixed Charge" | "Previous Stays" | "Both";
  numberOfPreviousStays: string | number;
  fixedChargeDescription: string;
  fixedChargeAmount: string;
  accompanyingGuests: string;
}

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
          <span className="detail-label">Arrival</span>
          <span className="detail-value">{guest.arrivalDate}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Departure</span>
          <span className="detail-value">{guest.departureDate}</span>
        </div>

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

  // --- Gemini API Logic ---
  const analyzeFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      // 1. Convert File to Base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
           // remove data:application/pdf;base64, prefix
           const base64String = (reader.result as string).split(',')[1];
           resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. Prepare Gemini Request
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // We define the schema to strictly format the output as JSON for the UI
      const schema: Schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            guestName: { type: Type.STRING },
            confirmationNumber: { type: Type.STRING },
            arrivalDate: { type: Type.STRING },
            departureDate: { type: Type.STRING },
            identifiedBy: { type: Type.STRING, enum: ["Fixed Charge", "Previous Stays", "Both"] },
            numberOfPreviousStays: { type: Type.STRING },
            fixedChargeDescription: { type: Type.STRING },
            fixedChargeAmount: { type: Type.STRING },
            accompanyingGuests: { type: Type.STRING },
          },
          required: ["guestName", "confirmationNumber", "arrivalDate", "departureDate", "identifiedBy", "numberOfPreviousStays", "fixedChargeDescription", "fixedChargeAmount", "accompanyingGuests"],
        },
      };

      const systemPrompt = `
        You are an intelligent document-analysis assistant.
        Your task is to identify all returning guests from the provided "Castle Hot Springs Arrivals Detailed" PDF.
        
        PRIMARY GOAL
        Identify guests who are returning guests using either:
        1) A Fixed Charge that explicitly indicates a return guest (e.g., "Return Guest", "Return Guest Credit", "RG").
        2) A Previous Stays / Number of Stays value of 1 or greater.

        If either is true, the guest is a Returning Guest.

        DATA TO EXTRACT (For each returning guest):
        - Primary Guest Name (Preserve exact spelling, Last, First)
        - Confirmation Number
        - Arrival Date (e.g. MM/DD/YY)
        - Departure Date (e.g. MM/DD/YY)
        - Returning Guest Identified By: "Fixed Charge", "Previous Stays", or "Both"
        - Number of Previous Stays: Numeric value or "N/A"
        - Fixed Charge Description: 
          **STRICT FILTER:** Only include description if it contains "Return Guest", "RG", or "Return Guest Credit". 
          If the description is "1185 Return Guest Thank", extract it as "Return Guest Credit".
          If the fixed charge is NOT related to Return Guest (e.g. "Amenity", "Package", "Parking"), set this to "None".
        - Fixed Charge Amount: Amount or "N/A". 
          **IMPORTANT RULE: Always extract as a positive number (e.g. convert -100.00 to 100.00). Remove any negative signs.**
          If Fixed Charge Description is "None" (due to filtering), set Amount to "N/A".
        - Accompanying Guest(s): Full name(s) or "None"

        INTERPRETATION RULES:
        - Do not infer missing data.
        - Treat each reservation independently.
        - If "Prev. Stays" is blank/missing, assume 0/N/A unless Fixed Charge is present.
      `;

      // 3. Call API
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Data
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });

      // 4. Parse Response
      const jsonText = response.text;
      if (!jsonText) throw new Error("No data returned from AI");
      
      const parsedData = JSON.parse(jsonText);
      setResults(parsedData);

    } catch (err: any) {
      console.error(err);
      setError("Failed to analyze the file. Please ensure it is a valid PDF and try again.");
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        analyzeFile(file);
      } else {
        setError("Please upload a valid PDF file.");
      }
    }
  }, []);

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