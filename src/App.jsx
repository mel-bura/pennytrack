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
  "Groceries": ["tesco", "sainsbury", "asda", "aldi", "lidl", "morrisons", "waitrose", "co-op", "coop", "ocado", "iceland", "m&s food", "m&s simply", "marks & spencer food", "grocery", "supermarket", "spar ", "nisa ", "londis", "budgens", "one stop", "farmfoods", "heron foods", "home bargains", "poundland", "costco", "whole foods", "planet organic", "abel & cole", "riverford", "gousto", "hello fresh", "mindful chef", "getir", "gorillas", "jiffy", "zapp"],
  "Eating Out": ["mcdonald", "kfc", "nando", "greggs", "costa", "starbucks", "pret", "domino", "pizza", "uber eats", "ubereats", "deliveroo", "just eat", "justeat", "restaurant", "cafe", "coffee", "burger", "subway", "wetherspoon", "wagamama", "zizzi", "five guys", "leon ", "itsu", "tortilla", "wasabi", "yo sushi", "caffe nero", "tim hortons", "krispy kreme", "bakery", "chippy", "kebab", "takeaway", "take away", "food order", "dining", "pub ", "brewdog", "toby carvery", "harvester", "beefeater", "prezzo", "carluccio", "bill's", "honest burger", "tgi friday", "bella italia", "ask italian", "patisserie", "gourmet burger", "shake shack", "chipotle", "taco bell", "popeyes", "wendy's", "chick-fil-a", "gopuff"],
  "Transport": ["tfl", "oyster", "uber", "bolt", "train", "bus", "petrol", "shell", "bp ", "esso", "parking", "congestion", "national rail", "trainline", "avanti", "gwr", "lner", "scotrail", "southeastern", "thameslink", "eurostar", "jet2", "easyjet", "ryanair", "british airways", "wizzair", "flybe", "heathrow", "gatwick", "stansted", "luton airport", "taxi", "addison lee", "freenow", "texaco", "total ", "ncp ", "ringgo", "paybyphone", "justpark", "dvla", "mot ", "halfords", "kwik fit", "rac ", "aa ", "green flag", "national express", "megabus", "flixbus", "stagecoach", "arriva", "first bus", "santander cycles", "lime scooter", "fuel", "motorway"],
  "Shopping": ["amazon", "ebay", "asos", "zara", "h&m", "primark", "next ", "john lewis", "argos", "ikea", "tkmaxx", "tk maxx", "river island", "new look", "boohoo", "shein", "uniqlo", "gap ", "mango", "reiss", "ted baker", "superdry", "fat face", "joules", "white stuff", "currys", "pc world", "apple store", "samsung", "cex ", "smyths", "waterstones", "whsmith", "the works", "hobbycraft", "wilko", "the range", "dunelm", "wayfair", "screwfix", "toolstation", "wickes", "b&q", "homebase", "b&m ", "sports direct", "jd sports", "decathlon", "go outdoors", "mountain warehouse", "aliexpress", "etsy", "notonthehighstreet", "selfridges", "harrods", "debenhams", "vinted", "depop", "temu", "wish.com"],
  "Bills & Utilities": ["electric", "gas", "water", "council tax", "council", "rent", "mortgage", "bt ", "virgin media", "sky ", "insurance", "thames", "octopus energy", "british gas", "eon ", "e.on", "edf ", "sse ", "scottish power", "bulb ", "ovo energy", "utilita", "shell energy", "npower", "southern water", "united utilities", "severn trent", "anglian water", "yorkshire water", "south west water", "welsh water", "wessex water", "starlink", "plusnet", "talktalk", "hyperoptic", "vodafone", "three broadband", "ee broadband", "openreach", "mbna", "barclaycard", "capital one", "vanquis", "credit card", "loan ", "klarna", "clearpay", "aviva", "direct line", "admiral", "hastings direct", "churchill", "esure", "axa ", "zurich", "legal & general", "pension", "tv licence", "tv license", "hmrc", "tax", "self assessment", "student loan", "slc ", "somerset council", "devon council", "dorset council", "bristol council", "cornwall council", "wiltshire council", "ee ", "o2 ", "three ", "giffgaff", "voxi", "lebara", "lycamobile", "smarty", "broadband", "fibre", "phone bill", "mobile bill", "sim only"],
  "Entertainment": ["netflix", "spotify", "disney", "cinema", "odeon", "vue", "ticket", "game", "playstation", "xbox", "steam", "cineworld", "curzon", "everyman", "showcase", "amazon video", "prime video", "now tv", "britbox", "apple tv", "paramount", "dazn", "sky sports", "bt sport", "apple music", "tidal", "deezer", "youtube music", "theatre", "concert", "gig ", "live nation", "ticketmaster", "eventbrite", "bowling", "escape room", "theme park", "alton towers", "thorpe park", "legoland", "zoo ", "aquarium", "museum", "national trust", "english heritage", "lottery", "lotto", "bet365", "betfair", "paddy power", "william hill", "ladbrokes", "sky bet", "twitch", "crunchyroll", "funimation", "mubi", "hayu"],
  "Health": ["pharmacy", "boots", "superdrug", "doctor", "dentist", "gym", "puregym", "david lloyd", "nuffield", "bupa", "vitality", "nhs", "hospital", "optician", "specsavers", "vision express", "the gym group", "fitness first", "virgin active", "anytime fitness", "jd gyms", "leisure centre", "swimming", "yoga", "pilates", "crossfit", "peloton", "myprotein", "holland & barrett", "health food", "vitamin", "supplement", "prescription", "chiropractor", "physiotherapist", "counselling", "therapy", "headspace", "calm app"],
  "Subscriptions": ["apple.com", "apple.com/bill", "google storage", "google one", "icloud", "amazon prime", "audible", "youtube premium", "patreon", "substack", "github", "dropbox", "microsoft 365", "office 365", "adobe", "canva", "notion", "1password", "nordvpn", "expressvpn", "proton", "grammarly", "chatgpt", "chat gpt", "openai", "open ai", "open.ai", "figma", "slack", "zoom ", "vercel", "netlify", "aws ", "domain", "hosting", "wordpress", "squarespace", "shopify", "uppbeat", "upbeat", "subscripti", "midjourney", "mid journey", "anthropic", "claude", "copilot", "co pilot", "linkedin premium", "linkedin", "medium.com", "medium ", "skillshare", "coursera", "udemy", "masterclass", "blinkist", "kindle unlimited", "scribd"],
  "Cash": ["atm", "cash", "withdrawal", "cashback"],
};

// Common payment processor prefixes to strip for better matching
const PAYMENT_PREFIXES = ["paypal *", "paypal*", "pp*", "pp *", "sq *", "sq*", "sqr*", "google *", "google*", "apple.com/bill", "amzn ", "amzn*", "amz*", "goog*", "msft*", "msft *", "izettle*", "sumup*", "sum up*", "stripe*", "zettle*"];

// Normalise description for override lookups
function normaliseDesc(desc) {
  let d = desc.toLowerCase().trim();
  for (const prefix of PAYMENT_PREFIXES) {
    if (d.startsWith(prefix)) { d = d.slice(prefix.length).trim(); break; }
  }
  // Remove trailing reference numbers/dates
  d = d.replace(/\s+\d{6,}$/, "").replace(/\s+\d{2}[\/\-]\d{2}[\/\-]?\d{0,4}$/, "").trim();
  return d;
}

function categorize(description, overrides = {}) {
  const lower = description.toLowerCase().trim();
  const normKey = normaliseDesc(description);

  // 1. Check user overrides first (self-learning)
  if (overrides[normKey]) return overrides[normKey];
  if (overrides[lower]) return overrides[lower];

  // 2. Try matching the full description
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  // 3. Strip payment processor prefixes and try again
  let stripped = lower;
  for (const prefix of PAYMENT_PREFIXES) {
    if (stripped.startsWith(prefix)) { stripped = stripped.slice(prefix.length).trim(); break; }
  }
  if (stripped !== lower) {
    if (overrides[stripped]) return overrides[stripped];
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => stripped.includes(kw))) return cat;
    }
  }
  // 4. PayPal fallback
  if (lower.includes("paypal")) return "Shopping";
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

function parseCSV(text, overrides = {}) {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const headerCols = splitCSVRow(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ""));
  const expenses = [];

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
      date = dateIdx >= 0 ? cols[dateIdx] : null;
      description = cols[descIdx]?.replace(/^['"]|['"]$/g, "");

      if (debitIdx >= 0) {
        const debit = parseFloat((cols[debitIdx] || "").replace(/[\u00A3$,\s]/g, ""));
        if (debit > 0) amount = debit;
      } else if (amountIdx >= 0) {
        const val = parseFloat((cols[amountIdx] || "").replace(/[\u00A3$,\s]/g, ""));
        if (val && val < 0) amount = Math.abs(val);
        else if (val && val > 0 && creditIdx < 0) amount = val;
      }
    } else {
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
        category: categorize(description, overrides),
        source: "csv",
      });
    }
  }
  return expenses;
}

// ─── PDF TEXT PARSER ───
async function parsePDFText(file, overrides = {}) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
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

  const expenses = [];
  const lines = fullText.split("\n");

  for (const line of lines) {
    const lloydsMatch = line.match(/(\d{1,2}\s+\w{3}\s+\d{2,4})\s{2,}(.+?)\s{2,}(?:DEB|DD|SO|BP|FPI|TFR|BGC|FPO|DEP|ATM)\s{2,}(?:[\d,]+\.\d{2}\s{2,})?(\d[\d,]*\.\d{2})\s{2,}[\d,]+\.\d{2}/);
    if (lloydsMatch) {
      const [, date, desc, moneyOut] = lloydsMatch;
      const amount = parseFloat(moneyOut.replace(/,/g, ""));
      if (amount > 0 && desc.trim().length > 1) {
        expenses.push({
          id: crypto.randomUUID(), date: date.trim(), description: desc.trim(),
          amount: parseFloat(amount.toFixed(2)), category: categorize(desc, overrides), source: "pdf",
        });
        continue;
      }
    }

    const match = line.match(/(\d{1,2}[\/-]\w{3}[\/-]?\d{0,4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s+(.+?)\s+([\u00A3$]?\d+[.,]\d{2})\s*$/);
    if (match) {
      const [, date, desc, amt] = match;
      const amount = parseFloat(amt.replace(/[\u00A3$,]/g, ""));
      if (amount > 0 && desc.trim().length > 1) {
        expenses.push({
          id: crypto.randomUUID(), date, description: desc.trim(),
          amount: parseFloat(amount.toFixed(2)), category: categorize(desc, overrides), source: "pdf",
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

  for (const line of lines.slice(0, 5)) {
    const clean = line.replace(/[^a-zA-Z0-9\s&'.-]/g, "").trim();
    if (clean.length > 2 && clean.length < 60 && !/^\d+$/.test(clean) && !/tel|phone|fax|vat|reg/i.test(clean)) {
      merchant = clean; break;
    }
  }

  const totalPatterns = [
    /(?:total|amount\s*due|balance\s*due|grand\s*total|to\s*pay|card\s*payment|debit\s*card|visa|mastercard|contactless)\s*[:\s]*£?\s*(\d+[.,]\d{2})/i,
    /£\s*(\d+[.,]\d{2})\s*(?:total|due|paid)/i,
  ];
  for (const line of lines.reverse()) {
    for (const pattern of totalPatterns) {
      const match = line.match(pattern);
      if (match) { total = parseFloat(match[1].replace(",", ".")); break; }
    }
    if (total) break;
  }
  if (!total) {
    let maxAmt = 0;
    for (const line of lines) {
      const amts = [...line.matchAll(/£\s*(\d+[.,]\d{2})/g)];
      for (const m of amts) { const v = parseFloat(m[1].replace(",", ".")); if (v > maxAmt) maxAmt = v; }
    }
    if (maxAmt > 0) total = maxAmt;
  }

  const datePatterns = [/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/, /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})/i];
  for (const line of lines) {
    for (const pattern of datePatterns) { const match = line.match(pattern); if (match) { date = match[1]; break; } }
    if (date) break;
  }

  return { merchant, total, date };
}

async function parseReceiptImage(file, onProgress, overrides = {}) {
  const Tesseract = await import("tesseract.js");
  const imageUrl = URL.createObjectURL(file);

  try {
    const result = await Tesseract.recognize(imageUrl, "eng", {
      logger: (m) => { if (m.status === "recognizing text" && onProgress) onProgress(Math.round(m.progress * 100)); },
    });

    const ocrText = result.data.text;
    const extracted = extractReceiptData(ocrText);

    const expenses = [];
    if (extracted.total && extracted.total > 0) {
      expenses.push({
        id: crypto.randomUUID(),
        date: extracted.date || new Date().toISOString().split("T")[0],
        description: extracted.merchant || "Receipt purchase",
        amount: parseFloat(extracted.total.toFixed(2)),
        category: extracted.merchant ? categorize(extracted.merchant, overrides) : "Other",
        source: "receipt",
      });
    }

    const imageData = await new Promise((resolve) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file);
    });

    return { imageData, expenses, rawText: ocrText, extracted };
  } finally { URL.revokeObjectURL(imageUrl); }
}

// ─── MONTH HELPERS ───
function parseUKDate(dateStr) {
  if (!dateStr) return new Date();
  const s = dateStr.trim();
  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return new Date(year, parseInt(m) - 1, parseInt(d));
  }
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
  try { const d = parseUKDate(dateStr); if (isNaN(d)) return new Date().toISOString().slice(0, 7); return d.toISOString().slice(0, 7); }
  catch { return new Date().toISOString().slice(0, 7); }
}

function formatMonth(key) {
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function formatCurrency(n) { return `\u00A3${n.toFixed(2)}`; }

// ─── MAIN APP ───
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [categoryOverrides, setCategoryOverrides] = useState({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [syncStatus, setSyncStatus] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState("expense"); // "expense" or "income"
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(null);
  const [drillCategory, setDrillCategory] = useState(null); // category drill-down
  const [savingsBalance, setSavingsBalance] = useState(0);

  const isFromCloud = useRef(false);
  const userRef = useRef(null);
  const overridesRef = useRef({});

  // Keep overridesRef in sync
  useEffect(() => { overridesRef.current = categoryOverrides; }, [categoryOverrides]);

  // ─── AUTH ───
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); userRef.current = u; setAuthLoading(false); });
    return unsub;
  }, []);

  const handleSignIn = async () => { try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error(e); } };
  const handleSignOut = async () => { try { await signOut(auth); setSyncStatus(null); } catch (e) { console.error(e); } };

  // ─── FIRESTORE SYNC (listen) ───
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "pennytrack_users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        isFromCloud.current = true;
        if (data.expenses) setExpenses(data.expenses);
        if (data.incomes) setIncomes(data.incomes);
        if (data.receipts) setReceipts(data.receipts);
        if (data.categoryOverrides) setCategoryOverrides(data.categoryOverrides);
        if (data.savingsBalance !== undefined) setSavingsBalance(data.savingsBalance);
        setSyncStatus("synced");
      }
    });
    return unsub;
  }, [user]);

  // ─── SAVE TO FIRESTORE ───
  useEffect(() => {
    try { localStorage.setItem("pennytrack_expenses", JSON.stringify(expenses)); } catch {}
    try { localStorage.setItem("pennytrack_incomes", JSON.stringify(incomes)); } catch {}
    try { localStorage.setItem("pennytrack_receipts", JSON.stringify(receipts)); } catch {}
    try { localStorage.setItem("pennytrack_overrides", JSON.stringify(categoryOverrides)); } catch {}
    try { localStorage.setItem("pennytrack_savings", JSON.stringify(savingsBalance)); } catch {}

    if (userRef.current) {
      if (isFromCloud.current) { isFromCloud.current = false; return; }
      setSyncStatus("saving...");
      const timeout = setTimeout(() => {
        const receiptsForCloud = receipts.map(r => ({ ...r, imageData: undefined }));
        setDoc(doc(db, "pennytrack_users", userRef.current.uid), {
          expenses, incomes, receipts: receiptsForCloud, categoryOverrides, savingsBalance,
          updatedAt: new Date().toISOString(),
        }, { merge: true })
          .then(() => setSyncStatus("synced"))
          .catch(() => setSyncStatus("error"));
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [expenses, incomes, receipts, categoryOverrides, savingsBalance]);

  // ─── LOAD LOCAL ON MOUNT ───
  useEffect(() => {
    try { const saved = localStorage.getItem("pennytrack_expenses"); if (saved) setExpenses(JSON.parse(saved)); } catch {}
    try { const saved = localStorage.getItem("pennytrack_incomes"); if (saved) setIncomes(JSON.parse(saved)); } catch {}
    try { const saved = localStorage.getItem("pennytrack_receipts"); if (saved) setReceipts(JSON.parse(saved)); } catch {}
    try { const saved = localStorage.getItem("pennytrack_overrides"); if (saved) setCategoryOverrides(JSON.parse(saved)); } catch {}
    try { const saved = localStorage.getItem("pennytrack_savings"); if (saved) setSavingsBalance(JSON.parse(saved)); } catch {}
  }, []);

  // ─── EXPENSE OPERATIONS ───
  const addExpense = useCallback((expense) => { setExpenses(prev => [expense, ...prev]); }, []);
  const deleteExpense = useCallback((id) => { setExpenses(prev => prev.filter(e => e.id !== id)); }, []);

  const updateExpense = useCallback((id, updates) => {
    setExpenses(prev => {
      const expense = prev.find(e => e.id === id);
      if (expense && updates.category && updates.category !== expense.category) {
        // Self-learning: remember this category choice for similar descriptions
        const normKey = normaliseDesc(expense.description);
        setCategoryOverrides(ov => ({ ...ov, [normKey]: updates.category }));
      }
      return prev.map(e => e.id === id ? { ...e, ...updates } : e);
    });
    setEditingId(null);
  }, []);

  // ─── INCOME OPERATIONS ───
  const addIncome = useCallback((income) => { setIncomes(prev => [income, ...prev]); }, []);
  const deleteIncome = useCallback((id) => { setIncomes(prev => prev.filter(e => e.id !== id)); }, []);

  // ─── RE-CATEGORISE ALL (apply overrides to existing transactions) ───
  const recategoriseAll = useCallback(() => {
    setExpenses(prev => prev.map(e => ({
      ...e,
      category: categorize(e.description, overridesRef.current),
    })));
  }, []);

  // ─── COMPUTED DATA ───
  const filteredExpenses = useMemo(() => {
    if (selectedMonth === "all") return expenses;
    return expenses.filter(e => getMonthKey(e.date) === selectedMonth);
  }, [expenses, selectedMonth]);

  const filteredIncomes = useMemo(() => {
    if (selectedMonth === "all") return incomes;
    return incomes.filter(e => getMonthKey(e.date) === selectedMonth);
  }, [incomes, selectedMonth]);

  const availableMonths = useMemo(() => {
    const months = new Set([
      ...expenses.map(e => getMonthKey(e.date)),
      ...incomes.map(e => getMonthKey(e.date)),
    ]);
    return Array.from(months).sort().reverse();
  }, [expenses, incomes]);

  const totalSpent = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);
  const totalIncome = useMemo(() => filteredIncomes.reduce((s, e) => s + e.amount, 0), [filteredIncomes]);
  const netAmount = useMemo(() => totalIncome - totalSpent, [totalIncome, totalSpent]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)), color: CATEGORIES[name]?.color || "#9ca3af" }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const monthlyTrend = useMemo(() => {
    const map = {};
    expenses.forEach(e => { const key = getMonthKey(e.date); map[key] = (map[key] || { spent: 0, income: 0 }); map[key].spent += e.amount; });
    incomes.forEach(e => { const key = getMonthKey(e.date); map[key] = (map[key] || { spent: 0, income: 0 }); map[key].income += e.amount; });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({ month: formatMonth(month), spent: parseFloat(data.spent.toFixed(2)), income: parseFloat(data.income.toFixed(2)) }));
  }, [expenses, incomes]);

  const topMerchants = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(e => { const key = e.description.substring(0, 30); map[key] = (map[key] || 0) + e.amount; });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([name, total]) => ({ name, total: parseFloat(total.toFixed(2)) }));
  }, [filteredExpenses]);

  // Drill-down expenses for selected category
  const drillExpenses = useMemo(() => {
    if (!drillCategory) return [];
    return filteredExpenses.filter(e => e.category === drillCategory).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredExpenses, drillCategory]);

  // ─── FILE IMPORT HANDLER ───
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult({ status: "processing", message: "Reading file..." });

    try {
      let result;
      if (file.name.endsWith(".csv") || file.name.endsWith(".tsv")) {
        const text = await file.text();
        const parsed = parseCSV(text, overridesRef.current);
        result = { count: parsed.length, expenses: parsed };
      } else if (file.name.endsWith(".pdf")) {
        const parsed = await parsePDFText(file, overridesRef.current);
        result = { count: parsed.expenses.length, expenses: parsed.expenses, rawText: parsed.rawText };
      } else if (file.type?.startsWith("image/")) {
        setImportResult({ status: "processing", message: "Reading receipt..." });
        setOcrProgress(0);
        const parsed = await parseReceiptImage(file, (p) => setOcrProgress(p), overridesRef.current);
        setOcrProgress(null);
        setReceipts(prev => [...prev, { id: crypto.randomUUID(), imageData: parsed.imageData, date: new Date().toISOString(), fileName: file.name }]);
        if (parsed.expenses.length > 0) {
          setExpenses(prev => [...parsed.expenses, ...prev]);
          const ex = parsed.expenses[0];
          setImportResult({ status: "success", message: `Receipt scanned! Added "${ex.description}" for ${formatCurrency(ex.amount)}` });
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

  // ─── ADD MODAL (Expense or Income) ───
  const AddModal = () => {
    const isIncome = addModalType === "income";
    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState(isIncome ? "" : "Other");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!desc.trim() || !amount) return;
      if (isIncome) {
        addIncome({
          id: crypto.randomUUID(), description: desc.trim(),
          amount: parseFloat(parseFloat(amount).toFixed(2)), date, source: "manual",
        });
      } else {
        addExpense({
          id: crypto.randomUUID(), description: desc.trim(),
          amount: parseFloat(parseFloat(amount).toFixed(2)),
          category: categorize(desc, overridesRef.current) !== "Other" ? categorize(desc, overridesRef.current) : category,
          date, source: "manual",
        });
      }
      setShowAddModal(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">{isIncome ? "Add Income" : "Add Expense"}</h2>
          {/* Toggle between expense/income */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
            <button type="button" onClick={() => setAddModalType("expense")}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${!isIncome ? "bg-white text-violet-700 shadow-sm" : "text-gray-500"}`}>Expense</button>
            <button type="button" onClick={() => setAddModalType("income")}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${isIncome ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"}`}>Income</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input autoFocus value={desc} onChange={e => { setDesc(e.target.value); if (!isIncome && e.target.value.length > 2) setCategory(categorize(e.target.value, overridesRef.current)); }}
              placeholder={isIncome ? "Where's the money from?" : "What did you spend on?"} className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-3 text-gray-400 text-sm">{"\u00A3"}</span>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00" className="w-full pl-7 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
              </div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="flex-1 px-3 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
            </div>
            {!isIncome && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CATEGORIES).map(([name, { icon }]) => (
                  <button type="button" key={name} onClick={() => setCategory(name)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${category === name ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
                    <span>{icon}</span> {name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
              <button type="submit" disabled={!desc.trim() || !amount}
                className={`flex-1 py-3 text-sm font-medium text-white rounded-xl transition-all disabled:opacity-40 ${isIncome ? "bg-emerald-500 hover:bg-emerald-600" : "bg-violet-500 hover:bg-violet-600"}`}>
                {isIncome ? "Add Income" : "Add Expense"}
              </button>
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

  // ─── CATEGORY DRILL-DOWN VIEW ───
  const CategoryDrillDown = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={() => setDrillCategory(null)} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">{CATEGORIES[drillCategory]?.icon}</span>
          <div>
            <h2 className="text-base font-bold text-gray-900">{drillCategory}</h2>
            <p className="text-xs text-gray-500">{drillExpenses.length} transactions {"\u2022"} {formatCurrency(drillExpenses.reduce((s, e) => s + e.amount, 0))}</p>
          </div>
        </div>
      </div>

      {/* Re-categorise hint */}
      {Object.keys(categoryOverrides).length > 0 && (
        <div className="bg-violet-50 rounded-xl border border-violet-100 p-3 flex items-center justify-between">
          <p className="text-xs text-violet-700">{"\u{1F9E0}"} PennyTrack learns from your edits!</p>
          <button onClick={recategoriseAll} className="text-xs text-violet-600 font-medium bg-white px-2 py-1 rounded-lg border border-violet-200 hover:bg-violet-50">Re-categorise all</button>
        </div>
      )}

      <div className="space-y-1.5">
        {drillExpenses.map(expense => (
          editingId === expense.id ? <EditRow key={expense.id} expense={expense} /> : (
            <div key={expense.id} className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{expense.description}</p>
                <p className="text-xs text-gray-400">{expense.date}</p>
              </div>
              <span className="text-sm font-semibold text-gray-800">{formatCurrency(expense.amount)}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditingId(expense.id)} className="p-1 text-gray-400 hover:text-violet-500 rounded" title="Change category">
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
    </div>
  );

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
              { id: "income", label: "Income", icon: "\u{1F4B0}" },
              { id: "import", label: "Import", icon: "\u{1F4E5}" },
            ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setDrillCategory(null); }}
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
          drillCategory ? <CategoryDrillDown /> : (
          <div className="space-y-4">
            {/* Month filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setSelectedMonth("all")} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${selectedMonth === "all" ? "bg-violet-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>All Time</button>
              {availableMonths.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${selectedMonth === m ? "bg-violet-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>{formatMonth(m)}</button>
              ))}
            </div>

            {expenses.length === 0 && incomes.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl mb-4 block">{"\u{1F4B7}"}</span>
                <p className="text-gray-500 font-medium">No transactions yet</p>
                <p className="text-gray-400 text-sm mt-1">Add expenses/income manually or import a bank statement</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 text-white">
                    <p className="text-violet-200 text-xs font-medium">Total Spent</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(totalSpent)}</p>
                    <p className="text-violet-200 text-[10px] mt-1">{filteredExpenses.length} transactions</p>
                  </div>
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white">
                    <p className="text-emerald-200 text-xs font-medium">Total Income</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(totalIncome)}</p>
                    <p className="text-emerald-200 text-[10px] mt-1">{filteredIncomes.length} entries</p>
                  </div>
                </div>

                {/* Net & Savings row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <p className="text-gray-500 text-xs font-medium">Net (Income - Spend)</p>
                    <p className={`text-xl font-bold mt-1 ${netAmount >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {netAmount >= 0 ? "+" : ""}{formatCurrency(netAmount)}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-gray-500 text-xs font-medium">{"\u{1F3E6}"} Savings</p>
                      <button onClick={() => {
                        const val = prompt("Enter current savings balance (\u00A3):", savingsBalance);
                        if (val !== null && !isNaN(parseFloat(val))) setSavingsBalance(parseFloat(parseFloat(val).toFixed(2)));
                      }} className="text-[10px] text-violet-500 hover:text-violet-700">Edit</button>
                    </div>
                    <p className="text-xl font-bold mt-1 text-blue-600">{formatCurrency(savingsBalance)}</p>
                  </div>
                </div>

                {/* Category breakdown pie - CLICKABLE */}
                {categoryBreakdown.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Spending by Category</h3>
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="50%" height={180}>
                        <PieChart>
                          <Pie data={categoryBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}
                            onClick={(_, idx) => setDrillCategory(categoryBreakdown[idx]?.name)}>
                            {categoryBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} className="cursor-pointer" />)}
                          </Pie>
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-1.5">
                        {categoryBreakdown.slice(0, 6).map(cat => (
                          <button key={cat.name} onClick={() => setDrillCategory(cat.name)}
                            className="flex items-center justify-between text-xs w-full hover:bg-gray-50 rounded-lg px-1.5 py-1 transition-all">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                              <span className="text-gray-600">{CATEGORIES[cat.name]?.icon} {cat.name}</span>
                            </div>
                            <span className="font-medium text-gray-800">{formatCurrency(cat.value)}</span>
                          </button>
                        ))}
                        {categoryBreakdown.length > 6 && (
                          <p className="text-[10px] text-gray-400 text-center">+ {categoryBreakdown.length - 6} more categories</p>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 text-center mt-2">Tap a category to see all transactions</p>
                  </div>
                )}

                {/* Monthly trend - now shows income vs spending */}
                {monthlyTrend.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Monthly Trend</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={monthlyTrend}>
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `\u00A3${v}`} />
                        <Tooltip formatter={(v) => formatCurrency(v)} />
                        <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} name="Income" />
                        <Bar dataKey="spent" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Spent" />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
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

                {/* Self-learning indicator */}
                {Object.keys(categoryOverrides).length > 0 && (
                  <div className="bg-violet-50 rounded-2xl border border-violet-100 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-violet-800 font-medium">{"\u{1F9E0}"} Smart Categories Active</p>
                      <p className="text-[10px] text-violet-600">{Object.keys(categoryOverrides).length} custom rules learned from your edits</p>
                    </div>
                    <button onClick={recategoriseAll} className="text-xs text-violet-600 font-medium bg-white px-3 py-1.5 rounded-lg border border-violet-200 hover:bg-violet-50">Apply to all</button>
                  </div>
                )}
              </>
            )}
          </div>
          )
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
              <div className="text-center py-16"><span className="text-5xl mb-4 block">{"\u{1F4DD}"}</span><p className="text-gray-500 font-medium">No expenses to show</p></div>
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

        {/* ─── INCOME TAB ─── */}
        {activeTab === "income" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{incomes.length} income entries</p>
              <button onClick={() => { setAddModalType("income"); setShowAddModal(true); }}
                className="text-xs text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-all font-medium">+ Add Income</button>
            </div>

            {/* Income total card */}
            {filteredIncomes.length > 0 && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
                <p className="text-emerald-200 text-sm font-medium">{selectedMonth === "all" ? "Total Income" : `Income in ${formatMonth(selectedMonth)}`}</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(totalIncome)}</p>
              </div>
            )}

            {filteredIncomes.length === 0 ? (
              <div className="text-center py-16"><span className="text-5xl mb-4 block">{"\u{1F4B0}"}</span><p className="text-gray-500 font-medium">No income recorded</p><p className="text-gray-400 text-sm mt-1">Tap "+ Add Income" to get started</p></div>
            ) : (
              <div className="space-y-1.5">
                {filteredIncomes.sort((a, b) => new Date(b.date) - new Date(a.date)).map(income => (
                  <div key={income.id} className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-emerald-50">{"\u{1F4B0}"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{income.description}</p>
                      <p className="text-xs text-gray-400">{income.date}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">+{formatCurrency(income.amount)}</span>
                    <button onClick={() => deleteIncome(income.id)} className="p-1 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
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
                  <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-violet-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div></div>
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

            {importResult && (
              <div className={`rounded-xl p-4 text-sm ${importResult.status === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : importResult.status === "warning" ? "bg-amber-50 text-amber-700 border border-amber-200" : importResult.status === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-violet-50 text-violet-700 border border-violet-200"}`}>
                <div className="flex items-center justify-between">
                  <span>{importResult.message}</span>
                  <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600 ml-2">{"\u2715"}</button>
                </div>
              </div>
            )}

            {receipts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">{"\u{1F4F8}"} Saved Receipts ({receipts.length})</h3>
                <div className="grid grid-cols-3 gap-2">
                  {receipts.map(r => (
                    <div key={r.id} className="aspect-square rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                      {r.imageData ? <img src={r.imageData} alt="Receipt" className="w-full h-full object-cover" /> : <span className="text-2xl">{"\u{1F9FE}"}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
        <button onClick={() => { setAddModalType("expense"); setShowAddModal(true); }}
          className="w-14 h-14 bg-violet-500 text-white rounded-2xl shadow-lg hover:bg-violet-600 transition-all flex items-center justify-center text-2xl hover:scale-105">+</button>
      </div>

      {showAddModal && <AddModal />}
    </div>
  );
}
