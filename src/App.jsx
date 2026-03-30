import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { auth, googleProvider, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ─── CATEGORIES ───
const CATEGORIES = {
  "Groceries": { icon: "\u{1F6D2}", color: "#10b981" },
  "Eating Out": { icon: "\u{1F354}", color: "#f59e0b" },
  "Transport": { icon: "\u{1F68C}", color: "#3b82f6" },
  "Shopping": { icon: "\u{1F6CD}\uFE0F", color: "#8b5cf6" },
  "Bills & Utilities": { icon: "\u{1F4A1}", color: "#ef4444" },
  "Entertainment": { icon: "\u{1F3AC}", color: "#ec4899" },
  "Health": { icon: "\u{1FA7A}", color: "#14b8a6" },
  "Subscriptions": { icon: "\u{1F504}", color: "#6366f1" },
  "Cash": { icon: "\u{1F4B5}", color: "#84cc16" },
  "Other": { icon: "\u{1F4E6}", color: "#9ca3af" },
};

const CATEGORY_KEYWORDS = {
  "Groceries": ["tesco", "sainsbury", "asda", "aldi", "lidl", "morrisons", "waitrose", "co-op", "coop", "ocado", "iceland", "m&s food", "grocery", "supermarket"],
  "Eating Out": ["mcdonald", "kfc", "nando", "greggs", "costa", "starbucks", "pret", "domino", "pizza", "uber eats", "deliveroo", "just eat", "restaurant", "cafe", "coffee", "burger", "subway"],
  "Transport": ["tfl", "oyster", "uber", "bolt", "train", "bus", "petrol", "shell", "bp", "esso", "parking", "congestion"],
  "Shopping": ["amazon", "ebay", "asos", "zara", "h&m", "primark", "next", "john lewis", "argos", "ikea", "tkmaxx"],
  "Bills & Utilities": ["electric", "gas", "water", "council tax", "rent", "mortgage", "bt ", "virgin media", "sky ", "insurance", "thames"],
  "Entertainment": ["netflix", "spotify", "disney", "cinema", "odeon", "vue", "ticket", "game", "playstation", "xbox", "steam"],
  "Health": ["pharmacy", "boots", "superdrug", "doctor", "dentist", "gym", "puregym", "david lloyd", "nuffield"],
  "Subscriptions": ["apple.com", "google storage", "icloud", "amazon prime", "audible", "youtube premium"],
};

function categorize(description) {
  const lower = description.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return "Other";
}

// ─── CSV PARSER ───
function splitCSVRow(line) {
  const result = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const headerCols = splitCSVRow(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ""));
  const expenses = [];

  // Find columns by header name (supports Lloyds, Barclays, HSBC, Monzo, etc.)
  const dateIdx = headerCols.findIndex(h => /date/.test(h));
  const descIdx = headerCols.findIndex(h => /description|narrative|details|memo|reference/.test(h));
  const debitIdx = headerCols.findIndex(h => /debit|money\s*out|paid\s*out|withdrawal/.test(h));
  const creditIdx = headerCols.findIndex(h => /credit|money\s*in|paid\s*in|deposit/.test(h));
  const amountIdx = headerCols.findIndex(h => /^amount$|^value$/.test(h));
  const useHeaders = descIdx >= 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVRow(lines[i]);
    if (cols.length < 3) continue;

    let date = null, description = null, amount = null;

    if (useHeaders) {
      // Header-based parsing
      date = dateIdx >= 0 ? cols[dateIdx] : null;
      description = cols[descIdx]?.replace(/^['"]|['"]$/g, "");

      if (debitIdx >= 0) {
        const debit = parseFloat((cols[debitIdx] || "").replace(/[\u00A3$,\s]/g, ""));
        if (debit > 0) amount = debit;
      } else if (amountIdx >= 0) {
        const val = parseFloat((cols[amountIdx] || "").replace(/[\u00A3$,\s]/g, ""));
        if (val && val < 0) amount = Math.abs(val); // Negative = spend
        else if (val && val > 0 && creditIdx < 0) amount = val; // No separate credit col
      }
    } else {
      // Fallback: auto-detect columns
      for (let j = 0; j < cols.length; j++) {
        const val = cols[j];
        if (!date && /\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}/.test(val)) date = val;
        else if (!amount && /^-?[\u00A3$]?\d+[.,]\d{2}$/.test(val.replace(/[\u00A3$,\s]/g, ""))) {
          const num = parseFloat(val.replace(/[\u00A3$,\s]/g, ""));
          amount = Math.abs(num);
        }
        else if (!description && val.length > 2 && !/^\d+[.,]?\d*$/.test(val)) description = val;
      }
    }

    if (description && amount && amount > 0) {
      expenses.push({
        id: crypto.randomUUID(),
        date: date || new Date().toISOString().split("T")[0],
        description,
        amount: parseFloat(amount.toFixed(2)),
        category: categorize(description),
        source: "csv",
      });
    }
  }
  return expenses;
}

// ─── PDF TEXT PARSER ───
async function parsePDFText(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group items by Y position to reconstruct lines
    const items = content.items.filter(item => item.str.trim());
    const lineMap = {};
    items.forEach(item => {
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push({ x: item.transform[4], text: item.str });
    });
    const sortedLines = Object.entries(lineMap)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.text).join("  "));
    fullText += sortedLines.join("\n") + "\n";
  }

  // Try to extract transactions from the text
  const expenses = [];
  const lines = fullText.split("\n");

  for (const line of lines) {
    // Pattern 1: "02 Jan 26  Digby's Patisserie  DEB  3.00  5,258.24" (Lloyds-style)
    const lloydsMatch = line.match(/(\d{1,2}\s+\w{3}\s+\d{2,4})\s{2,}(.+?)\s{2,}(?:DEB|DD|SO|BP|FPI|TFR|BGC|FPO|DEP|ATM)\s{2,}(?:[\d,]+\.\d{2}\s{2,})?(\d[\d,]*\.\d{2})\s{2,}[\d,]+\.\d{2}/);
    if (lloydsMatch) {
      const [, date, desc, moneyOut] = lloydsMatch;
      const amount = parseFloat(moneyOut.replace(/,/g, ""));
      if (amount > 0 && desc.trim().length > 1) {
        expenses.push({
          id: crypto.randomUUID(),
          date: date.trim(),
          description: desc.trim(),
          amount: parseFloat(amount.toFixed(2)),
          category: categorize(desc),
          source: "pdf",
        });
        continue;
      }
    }

    // Pattern 2: Generic "date description amount"
    const match = line.match(/(\d{1,2}[\/-]\w{3}[\/-]?\d{0,4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s+(.+?)\s+([\u00A3$]?\d+[.,]\d{2})\s*$/);
    if (match) {
      const [, date, desc, amt] = match;
      const amount = parseFloat(amt.replace(/[\u00A3$,]/g, ""));
      if (amount > 0 && desc.trim().length > 1) {
        expenses.push({
          id: crypto.randomUUID(),
          date: date,
          description: desc.trim(),
          amount: parseFloat(amount.toFixed(2)),
          category: categorize(desc),
          source: "pdf",
        });
      }
    }
  }
  return { expenses, rawText: fullText };
}

// ─── RECEIPT OCR PARSER (Tesseract.js) ───
function extractReceiptData(ocrText) {
  const lines = ocrText.split("\n").map(l => l.trim()).filter(Boolean);
  let merchant = null, total = null, date = null;

  // Extract merchant (usually the first meaningful line)
  for (const line of lines.slice(0, 5)) {
    const clean = line.replace(/[^a-zA-Z0-9\s&'.-]/g, "").trim();
    if (clean.length > 2 && clean.length < 60 && !/^\d+$/.test(clean) && !/tel|phone|fax|vat|reg/i.test(clean)) {
      merchant = clean;
      break;
    }
  }

  // Extract total amount (look for "total", "amount due", "balance", etc.)
  const totalPatterns = [
    /(?:total|amount\s*due|balance\s*due|grand\s*total|to\s*pay|card\s*payment|debit\s*card|visa|mastercard|contactless)\s*[:\s]*£?\s*(\d+[.,]\d{2})/i,
    /£\s*(\d+[.,]\d{2})\s*(?:total|due|paid)/i,
  ];
  for (const line of lines.reverse()) {
    for (const pattern of totalPatterns) {
      const match = line.match(pattern);
      if (match) {
        total = parseFloat(match[1].replace(",", "."));
        break;
      }
    }
    if (total) break;
  }
  // Fallback: find the largest pound amount
  if (!total) {
    let maxAmt = 0;
    for (const line of lines) {
      const amts = [...line.matchAll(/£\s*(\d+[.,]\d{2})/g)];
      for (const m of amts) {
        const v = parseFloat(m[1].replace(",", "."));
        if (v > maxAmt) maxAmt = v;
      }
    }
    if (maxAmt > 0) total = maxAmt;
  }

  // Extract date
  const datePatterns = [
    /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})/i,
  ];
  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) { date = match[1]; break; }
    }
    if (date) break;
  }

  return { merchant, total, date };
}

async function parseReceiptImage(file, onProgress) {
  const Tesseract = await import("tesseract.js");
  const imageUrl = URL.createObjectURL(file);

  try {
    const result = await Tesseract.recognize(imageUrl, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });

    const ocrText = result.data.text;
    const extracted = extractReceiptData(ocrText);

    // Build expense if we got enough info
    const expenses = [];
    if (extracted.total && extracted.total > 0) {
      expenses.push({
        id: crypto.randomUUID(),
        date: extracted.date || new Date().toISOString().split("T")[0],
        description: extracted.merchant || "Receipt purchase",
        amount: parseFloat(extracted.total.toFixed(2)),
        category: extracted.merchant ? categorize(extracted.merchant) : "Other",
        source: "receipt",
      });
    }

    // Get base64 for storage
    const imageData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });

    return { imageData, expenses, rawText: ocrText, extracted };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

// ─── MONTH HELPERS ───
function parseUKDate(dateStr) {
  if (!dateStr) return new Date();
  const s = dateStr.trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return new Date(year, parseInt(m) - 1, parseInt(d));
  }
  // "02 Jan 26" or "02 Jan 2026"
  const dmy2 = s.match(/^(\d{1,2})\s+(\w{3})\s+(\d{2,4})$/);
  if (dmy2) {
    const [, d, mName, y] = dmy2;
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return new Date(year, months[mName.toLowerCase()] ?? 0, parseInt(d));
  }
  const d = new Date(s);
  return isNaN(d) ? new Date() : d;
}

function getMonthKey(dateStr) {
  try {
    const d = parseUKDate(dateStr);
    if (isNaN(d)) return new Date().toISOString().slice(0, 7);
    return d.toISOString().slice(0, 7);
  } catch {
    return new Date().toISOString().slice(0, 7);
  }
}

function formatMonth(key) {
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function formatCurrency(n) {
  return `\u00A3${n.toFixed(2)}`;
}

// ─── MAIN APP ───
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [syncStatus, setSyncStatus] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(null);

  const isFromCloud = useRef(false);
  const userRef = useRef(null);

  // ─── AUTH ───
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      userRef.current = u;
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const handleSignIn = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error(e); }
  };
  const handleSignOut = async () => {
    try { await signOut(auth); setSyncStatus(null); } catch (e) { console.error(e); }
  };

  // ─── FIRESTORE SYNC (listen) ───
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "pennytrack_users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        isFromCloud.current = true;
        if (data.expenses) setExpenses(data.expenses);
        if (data.receipts) setReceipts(data.receipts);
        setSyncStatus("synced");
      }
    });
    return unsub;
  }, [user]);

  // ─── SAVE TO FIRESTORE ───
  useEffect(() => {
    // Save local
    try { localStorage.setItem("pennytrack_expenses", JSON.stringify(expenses)); } catch {}
    try { localStorage.setItem("pennytrack_receipts", JSON.stringify(receipts)); } catch {}

    if (userRef.current) {
      if (isFromCloud.current) { isFromCloud.current = false; return; }
      setSyncStatus("saving...");
      const timeout = setTimeout(() => {
        // Don't save receipt imageData to Firestore (too large) - only metadata
        const receiptsForCloud = receipts.map(r => ({ ...r, imageData: undefined }));
        setDoc(doc(db, "pennytrack_users", userRef.current.uid), {
          expenses, receipts: receiptsForCloud, updatedAt: new Date().toISOString(),
        }, { merge: true })
          .then(() => setSyncStatus("synced"))
          .catch(() => setSyncStatus("error"));
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [expenses, receipts]);

  // ─── LOAD LOCAL ON MOUNT ───
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pennytrack_expenses");
      if (saved) setExpenses(JSON.parse(saved));
      const savedR = localStorage.getItem("pennytrack_receipts");
      if (savedR) setReceipts(JSON.parse(savedR));
    } catch {}
  }, []);

  // ─── EXPENSE OPERATIONS ───
  const addExpense = useCallback((expense) => {
    setExpenses(prev => [expense, ...prev]);
  }, []);

  const deleteExpense = useCallback((id) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateExpense = useCallback((id, updates) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    setEditingId(null);
  }, []);

  // ─── COMPUTED DATA ───
  const filteredExpenses = useMemo(() => {
    if (selectedMonth === "all") return expenses;
    return expenses.filter(e => getMonthKey(e.date) === selectedMonth);
  }, [expenses, selectedMonth]);

  const availableMonths = useMemo(() => {
    const months = new Set(expenses.map(e => getMonthKey(e.date)));
    return Array.from(months).sort().reverse();
  }, [expenses]);

  const totalSpent = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)), color: CATEGORIES[name]?.color || "#9ca3af" }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const monthlyTrend = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const key = getMonthKey(e.date);
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, total]) => ({ month: formatMonth(month), total: parseFloat(total.toFixed(2)) }));
  }, [expenses]);

  const topMerchants = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(e => {
      const key = e.description.substring(0, 30);
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, total]) => ({ name, total: parseFloat(total.toFixed(2)) }));
  }, [filteredExpenses]);

  // ─── FILE IMPORT HANDLER ───
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult({ status: "processing", message: "Reading file..." });

    try {
      let result;
      if (file.name.endsWith(".csv") || file.name.endsWith(".tsv")) {
        const text = await file.text();
        const parsed = parseCSV(text);
        result = { count: parsed.length, expenses: parsed };
      } else if (file.name.endsWith(".pdf")) {
        const parsed = await parsePDFText(file);
        result = { count: parsed.expenses.length, expenses: parsed.expenses, rawText: parsed.rawText };
      } else if (file.type?.startsWith("image/")) {
        setImportResult({ status: "processing", message: "Reading receipt..." });
        setOcrProgress(0);
        const parsed = await parseReceiptImage(file, (p) => setOcrProgress(p));
        setOcrProgress(null);
        setReceipts(prev => [...prev, { id: crypto.randomUUID(), imageData: parsed.imageData, date: new Date().toISOString(), fileName: file.name }]);
        if (parsed.expenses.length > 0) {
          setExpenses(prev => [...parsed.expenses, ...prev]);
          const e = parsed.expenses[0];
          setImportResult({ status: "success", message: `Receipt scanned! Added "${e.description}" for ${formatCurrency(e.amount)}` });
        } else {
          setImportResult({ status: "warning", message: "Receipt saved but couldn't extract the total automatically. You can add it manually." });
        }
        return;
      } else {
        setImportResult({ status: "error", message: "Unsupported file type. Use CSV, PDF, or image files." });
        return;
      }

      if (result.expenses.length > 0) {
        setExpenses(prev => [...result.expenses, ...prev]);
        setImportResult({ status: "success", message: `Imported ${result.count} transactions!` });
      } else {
        setImportResult({ status: "warning", message: `Couldn't detect transactions automatically. ${result.rawText ? "PDF text was extracted but no transaction patterns found." : "Check your CSV format."}` });
      }
    } catch (err) {
      console.error(err);
      setImportResult({ status: "error", message: "Error reading file: " + err.message });
    }

    e.target.value = "";
  };

  // ─── ADD EXPENSE MODAL ───
  const AddExpenseModal = () => {
    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("Other");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!desc.trim() || !amount) return;
      addExpense({
        id: crypto.randomUUID(),
        description: desc.trim(),
        amount: parseFloat(parseFloat(amount).toFixed(2)),
        category,
        date,
        source: "manual",
      });
      setShowAddModal(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Add Expense</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input autoFocus value={desc} onChange={e => { setDesc(e.target.value); if (e.target.value.length > 2) setCategory(categorize(e.target.value)); }}
              placeholder="What did you spend on?" className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-3 text-gray-400 text-sm">{"\u00A3"}</span>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00" className="w-full pl-7 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
              </div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="flex-1 px-3 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CATEGORIES).map(([name, { icon, color }]) => (
                <button type="button" key={name} onClick={() => setCategory(name)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${category === name ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
                  <span>{icon}</span> {name}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
              <button type="submit" disabled={!desc.trim() || !amount} className="flex-1 py-3 text-sm font-medium text-white bg-violet-500 rounded-xl hover:bg-violet-600 transition-all disabled:opacity-40">Add Expense</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ─── EDIT ROW ───
  const EditRow = ({ expense }) => {
    const [cat, setCat] = useState(expense.category);
    return (
      <div className="flex items-center gap-2 py-2 px-3 bg-violet-50 rounded-xl border border-violet-200">
        <select value={cat} onChange={e => { setCat(e.target.value); updateExpense(expense.id, { category: e.target.value }); }}
          className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500">
          {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="flex-1 text-sm text-gray-700 truncate">{expense.description}</span>
        <span className="text-sm font-medium">{formatCurrency(expense.amount)}</span>
        <button onClick={() => setEditingId(null)} className="text-xs text-violet-600 font-medium">Done</button>
      </div>
    );
  };

  // ─── LOADING SCREEN ───
  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><span className="text-4xl block mb-3">{"\u{1F4B7}"}</span><p className="text-gray-400 text-sm">Loading...</p></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-violet-500 rounded-xl flex items-center justify-center"><span className="text-white text-lg">{"\u{1F4B7}"}</span></div>
              <div><h1 className="text-base font-bold text-gray-900 leading-tight">PennyTrack</h1><p className="text-[10px] text-gray-400 leading-tight">Smart Expense Tracker</p></div>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <button onClick={handleSignOut} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 transition-all" title={`Signed in as ${user.email}\nClick to sign out`}>
                  <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                  {syncStatus === "synced" && <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>}
                  {syncStatus === "saving..." && <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>}
                  {syncStatus === "error" && <span className="w-2 h-2 bg-red-400 rounded-full"></span>}
                </button>
              ) : (
                <button onClick={handleSignIn} className="text-xs text-white bg-violet-500 hover:bg-violet-600 px-3 py-1.5 rounded-lg transition-all font-medium">Sign in</button>
              )}
            </div>
          </div>
          {!user && <div className="pb-2"><p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">Sign in with Google to sync across all devices</p></div>}

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {[
              { id: "dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
              { id: "expenses", label: "Expenses", icon: "\u{1F4DD}" },
              { id: "import", label: "Import", icon: "\u{1F4E5}" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === tab.id ? "border-violet-500 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-32">
        {/* ─── DASHBOARD TAB ─── */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            {/* Month filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setSelectedMonth("all")} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${selectedMonth === "all" ? "bg-violet-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>All Time</button>
              {availableMonths.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${selectedMonth === m ? "bg-violet-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>{formatMonth(m)}</button>
              ))}
            </div>

            {expenses.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl mb-4 block">{"\u{1F4B7}"}</span>
                <p className="text-gray-500 font-medium">No expenses yet</p>
                <p className="text-gray-400 text-sm mt-1">Add expenses manually or import a bank statement</p>
              </div>
            ) : (
              <>
                {/* Total card */}
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-5 text-white">
                  <p className="text-violet-200 text-sm font-medium">{selectedMonth === "all" ? "Total Spent" : `Spent in ${formatMonth(selectedMonth)}`}</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(totalSpent)}</p>
                  <p className="text-violet-200 text-xs mt-2">{filteredExpenses.length} transactions</p>
                </div>

                {/* Category breakdown pie */}
                {categoryBreakdown.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Spending by Category</h3>
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="50%" height={180}>
                        <PieChart>
                          <Pie data={categoryBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                            {categoryBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-1.5">
                        {categoryBreakdown.slice(0, 6).map(cat => (
                          <div key={cat.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                              <span className="text-gray-600">{CATEGORIES[cat.name]?.icon} {cat.name}</span>
                            </div>
                            <span className="font-medium text-gray-800">{formatCurrency(cat.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Monthly trend */}
                {monthlyTrend.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Monthly Trend</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={monthlyTrend}>
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `\u00A3${v}`} />
                        <Tooltip formatter={(v) => formatCurrency(v)} />
                        <Bar dataKey="total" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Top merchants */}
                {topMerchants.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Spending</h3>
                    <div className="space-y-2">
                      {topMerchants.map((m, i) => (
                        <div key={m.name} className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center text-xs font-bold">{i + 1}</span>
                          <span className="flex-1 text-sm text-gray-700 truncate">{m.name}</span>
                          <span className="text-sm font-medium text-gray-800">{formatCurrency(m.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── EXPENSES TAB ─── */}
        {activeTab === "expenses" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{expenses.length} total expenses</p>
              <div className="flex gap-2 overflow-x-auto">
                <button onClick={() => setSelectedMonth("all")} className={`px-2 py-1 rounded-md text-xs transition-all ${selectedMonth === "all" ? "bg-violet-100 text-violet-700 font-medium" : "text-gray-400 hover:bg-gray-100"}`}>All</button>
                {availableMonths.slice(0, 3).map(m => (
                  <button key={m} onClick={() => setSelectedMonth(m)} className={`px-2 py-1 rounded-md text-xs transition-all ${selectedMonth === m ? "bg-violet-100 text-violet-700 font-medium" : "text-gray-400 hover:bg-gray-100"}`}>{formatMonth(m)}</button>
                ))}
              </div>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl mb-4 block">{"\u{1F4DD}"}</span>
                <p className="text-gray-500 font-medium">No expenses to show</p>
                <p className="text-gray-400 text-sm mt-1">Add expenses or import a statement</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(expense => (
                  editingId === expense.id ? <EditRow key={expense.id} expense={expense} /> : (
                    <div key={expense.id} className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${CATEGORIES[expense.category]?.color || "#9ca3af"}15` }}>
                        {CATEGORIES[expense.category]?.icon || "\u{1F4E6}"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{expense.description}</p>
                        <p className="text-xs text-gray-400">{expense.date} {"\u2022"} {expense.category}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{formatCurrency(expense.amount)}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingId(expense.id)} className="p-1 text-gray-400 hover:text-violet-500 rounded" title="Edit category">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => deleteExpense(expense.id)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── IMPORT TAB ─── */}
        {activeTab === "import" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <span className="text-4xl block mb-3">{"\u{1F4C4}"}</span>
              <h3 className="text-base font-semibold text-gray-800 mb-1">Import Bank Statement</h3>
              <p className="text-sm text-gray-500 mb-4">Upload a CSV or PDF from your bank</p>
              <label className="inline-flex items-center gap-2 px-5 py-3 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-600 transition-all cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Choose File
                <input type="file" accept=".csv,.tsv,.pdf,image/*" onChange={handleFileImport} className="hidden" />
              </label>
              <p className="text-xs text-gray-400 mt-3">Supports CSV, PDF, and receipt images</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <span className="text-4xl block mb-3">{"\u{1F4F8}"}</span>
              <h3 className="text-base font-semibold text-gray-800 mb-1">Scan Receipt</h3>
              <p className="text-sm text-gray-500 mb-4">Take a photo and we'll read it automatically</p>
              {ocrProgress !== null ? (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-violet-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
                  </div>
                  <p className="text-xs text-violet-600 font-medium">Reading receipt... {ocrProgress}%</p>
                </div>
              ) : (
                <label className="inline-flex items-center gap-2 px-5 py-3 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-600 transition-all cursor-pointer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Take Photo / Upload
                  <input type="file" accept="image/*" capture="environment" onChange={handleFileImport} className="hidden" />
                </label>
              )}
              <p className="text-xs text-gray-400 mt-3">Auto-reads merchant, total & date from receipts</p>
            </div>

            {/* Import result toast */}
            {importResult && (
              <div className={`rounded-xl p-4 text-sm ${importResult.status === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : importResult.status === "warning" ? "bg-amber-50 text-amber-700 border border-amber-200" : importResult.status === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-violet-50 text-violet-700 border border-violet-200"}`}>
                <div className="flex items-center justify-between">
                  <span>{importResult.message}</span>
                  <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600 ml-2">{"\u2715"}</button>
                </div>
              </div>
            )}

            {/* Saved receipts */}
            {receipts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">{"\u{1F4F8}"} Saved Receipts ({receipts.length})</h3>
                <div className="grid grid-cols-3 gap-2">
                  {receipts.map(r => (
                    <div key={r.id} className="aspect-square rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                      {r.imageData ? (
                        <img src={r.imageData} alt="Receipt" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{"\u{1F9FE}"}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How to download statement */}
            <div className="bg-violet-50 rounded-2xl border border-violet-100 p-4">
              <h3 className="text-sm font-semibold text-violet-800 mb-2">How to download your bank statement</h3>
              <div className="text-xs text-violet-700 space-y-1">
                <p>{"\u2022"} Most UK banks let you download CSV from online banking</p>
                <p>{"\u2022"} Look for "Download transactions" or "Export" in your account</p>
                <p>{"\u2022"} Select CSV format and your date range</p>
                <p>{"\u2022"} Upload the file here and we'll categorise everything!</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <button onClick={() => setShowAddModal(true)}
          className="w-14 h-14 bg-violet-500 text-white rounded-2xl shadow-lg hover:bg-violet-600 transition-all flex items-center justify-center text-2xl hover:scale-105">+</button>
      </div>

      {showAddModal && <AddExpenseModal />}
    </div>
  );
}
