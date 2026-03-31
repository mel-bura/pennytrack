import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { auth, googleProvider, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

// CATEGORIES constant with: Groceries, Eating Out, Transport, Shopping, Bills & Utilities, Entertainment, Health, Subscriptions, Cash, Other - each with icon and color

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

// CATEGORY_KEYWORDS - large object mapping category names to arrays of merchant keywords (keep ALL of these exactly as-is)
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

const PAYMENT_PREFIXES = ["paypal *", "paypal*", "pp*", "pp *", "sq *", "sq*", "sqr*", "google *", "google*", "apple.com/bill", "amzn ", "amzn*", "amz*", "goog*", "msft*", "msft *", "izettle*", "sumup*", "sum up*", "stripe*", "zettle*"];

const PAYMENT_TYPES = {
  "BGC": { label: "Bank Giro Credit", icon: "\u{1F3E6}", type: "income" },
  "BP": { label: "Bill Payment", icon: "\u{1F4CB}", type: "expense" },
  "CHG": { label: "Charge", icon: "\u{26A0}\uFE0F", type: "expense" },
  "CHQ": { label: "Cheque", icon: "\u{1F4DD}", type: "expense" },
  "COR": { label: "Correction", icon: "\u{1F504}", type: "neutral" },
  "CPT": { label: "Cashpoint", icon: "\u{1F3E7}", type: "expense" },
  "CR": { label: "Credit", icon: "\u{2705}", type: "income" },
  "DD": { label: "Direct Debit", icon: "\u{1F4C5}", type: "expense", recurring: true },
  "DEB": { label: "Debit Card", icon: "\u{1F4B3}", type: "expense" },
  "DEP": { label: "Deposit", icon: "\u{1F4E5}", type: "income" },
  "DR": { label: "Debit", icon: "\u{1F534}", type: "expense" },
  "FEE": { label: "Fixed Service Fee", icon: "\u{1F4B8}", type: "expense" },
  "FPI": { label: "Faster Payment In", icon: "\u{26A1}", type: "income" },
  "FPO": { label: "Faster Payment Out", icon: "\u{26A1}", type: "expense" },
  "MPI": { label: "Mobile Payment In", icon: "\u{1F4F1}", type: "income" },
  "MPO": { label: "Mobile Payment Out", icon: "\u{1F4F1}", type: "expense" },
  "PAY": { label: "Payment", icon: "\u{1F4B7}", type: "expense" },
  "SO": { label: "Standing Order", icon: "\u{1F501}", type: "expense", recurring: true },
  "TFR": { label: "Transfer", icon: "\u{1F500}", type: "neutral" },
};

function detectPaymentType(description) {
  if (!description) return null;
  const upper = description.toUpperCase().trim();
  // Check if the description starts with or contains a payment type code
  // Common patterns: "DD NETFLIX", "SO MORTGAGE", "FPI JOHN SMITH", "DEB 25DEC TESCO"
  for (const code of Object.keys(PAYMENT_TYPES)) {
    // Match at start: "DD NETFLIX", "DD-NETFLIX"
    if (upper.startsWith(code + " ") || upper.startsWith(code + "-") || upper.startsWith(code + "/")) return code;
    // Match with date pattern: "DEB 25DEC"
    if (upper.startsWith(code + " ")) return code;
    // Match in common bank formats: ") DD ", " DD "
    if (upper.includes(") " + code + " ") || upper.includes(" " + code + " ")) return code;
    // Match at end after amount/ref: "NETFLIX DD"
    if (upper.endsWith(" " + code)) return code;
  }
  // Also check for specific bank format patterns
  if (/\bD\/D\b/.test(upper) || /\bDIR(?:ECT)?\s*DEB(?:IT)?\b/.test(upper)) return "DD";
  if (/\bS\/O\b/.test(upper) || /\bSTAND(?:ING)?\s*ORD(?:ER)?\b/.test(upper)) return "SO";
  if (/\bFAST(?:ER)?\s*PAY(?:MENT)?\s*(?:IN|REC)\b/.test(upper)) return "FPI";
  if (/\bFAST(?:ER)?\s*PAY(?:MENT)?\s*(?:OUT|SENT)\b/.test(upper)) return "FPO";
  if (/\bBACS\b/.test(upper) || /\bCREDIT\b/.test(upper) && /\bBACS\b/.test(upper)) return "BGC";
  if (/\bCARD\s*PAYMENT\b/.test(upper) || /\bCONTACTLESS\b/.test(upper) || /\bVISA\b/.test(upper)) return "DEB";
  if (/\bCASH\s*(?:MACHINE|POINT|ATM|WITHDRAWAL)\b/.test(upper)) return "CPT";
  if (/\bCHEQUE\b/.test(upper) || /\bCHQ\b/.test(upper)) return "CHQ";
  if (/\bTRANSFER\b/.test(upper)) return "TFR";
  if (/\bMOBILE\s*(?:PAYMENT|PAY)\b/.test(upper)) return upper.includes("IN") || upper.includes("REC") ? "MPI" : "MPO";
  return null;
}

function normaliseDesc(desc) {
  let normalized = desc.toLowerCase().trim();
  for (const prefix of PAYMENT_PREFIXES) {
    if (normalized.startsWith(prefix.toLowerCase())) {
      normalized = normalized.substring(prefix.length).trim();
      break;
    }
  }
  // Remove trailing reference numbers (e.g., "NETFLIX CH8OP68ACS" -> "NETFLIX")
  normalized = normalized.replace(/\s+[A-Z0-9]{6,}$/, "");
  return normalized;
}

function categorize(description, overrides = {}) {
  const normalized = normaliseDesc(description).toLowerCase();
  if (overrides[normalized]) return overrides[normalized];
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  return "Other";
}

function splitCSVRow(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text, overrides = {}) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  const firstRow = splitCSVRow(lines[0]);
  const useHeaders =
    firstRow.some((h) => h.toLowerCase().includes("date")) &&
    firstRow.some((h) => h.toLowerCase().includes("amount"));

  const expenses = [];
  const startIdx = useHeaders ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const parts = splitCSVRow(lines[i]);
    if (parts.length < 3) continue;

    let date, description, amount;

    if (useHeaders) {
      const dateIdx = firstRow.findIndex((h) =>
        h.toLowerCase().includes("date")
      );
      const descIdx = firstRow.findIndex((h) =>
        h.toLowerCase().includes("description")
      );
      const amtIdx = firstRow.findIndex((h) =>
        h.toLowerCase().includes("amount")
      );
      date = parts[dateIdx]?.trim() || "";
      description = parts[descIdx]?.trim() || "";
      amount = parseFloat(parts[amtIdx]?.replace(/[^0-9.-]/g, "")) || 0;
    } else {
      date = parts[0]?.trim() || "";
      description = parts[1]?.trim() || "";
      amount = parseFloat(parts[2]?.replace(/[^0-9.-]/g, "")) || 0;
    }

    if (!date || !description || !amount) continue;

    expenses.push({
      id: `${Date.now()}-${Math.random()}`,
      date,
      description,
      amount: Math.abs(amount),
      category: categorize(description, overrides),
      source: "csv",
      paymentType: detectPaymentType(description),
    });
  }

  return expenses;
}

function parsePDFText(file, overrides = {}) {
  const expenses = [];
  const lines = file.split("\n");

  for (const line of lines) {
    // Lloyds bank format: Date (2 cols) | Description | Type | Debit | Balance
    const lloydsMatch = line.match(
      /(\d{1,2}\s+\w{3}\s+\d{2,4})\s{2,}(.+?)\s{2,}(DEB|DD|SO|BP|FPI|TFR|BGC|FPO|DEP|ATM|CPT|CHQ|CHG|FEE|CR|DR|PAY|MPI|MPO|COR)\s{2,}(?:[\d,]+\.\d{2}\s{2,})?(\d[\d,]*\.\d{2})\s{2,}[\d,]+\.\d{2}/
    );

    if (lloydsMatch) {
      const date = lloydsMatch[1];
      const desc = lloydsMatch[2];
      const paymentType = lloydsMatch[3];
      const amount = parseFloat(lloydsMatch[4].replace(/,/g, ""));

      expenses.push({
        id: `${Date.now()}-${Math.random()}`,
        date,
        description: desc,
        amount,
        category: categorize(desc, overrides),
        source: "pdf",
        paymentType,
      });
    } else {
      // Generic attempt
      const match = line.match(
        /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+\w{3})\s+(.+?)\s+([\d,]+\.\d{2})/
      );
      if (match) {
        const date = match[1];
        const desc = match[2];
        const amount = parseFloat(match[3].replace(/,/g, ""));

        expenses.push({
          id: `${Date.now()}-${Math.random()}`,
          date,
          description: desc,
          amount,
          category: categorize(desc, overrides),
          source: "pdf",
          paymentType: detectPaymentType(desc),
        });
      }
    }
  }

  return expenses;
}

function extractReceiptData(ocrText) {
  const lines = ocrText.split("\n");
  let total = null;
  let merchant = null;
  let date = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!total) {
      const totalMatch = trimmed.match(/(?:total|amount|price):\s*[\$Â£â¬]?\s*([\d.]+)/i);
      if (totalMatch) total = parseFloat(totalMatch[1]);
    }

    const dateMatch = trimmed.match(
      /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+\w{3}\s+\d{2,4})/
    );
    if (dateMatch && !date) date = dateMatch[1];

    if (!merchant && trimmed.length > 5 && trimmed.length < 50) {
      const upper = trimmed.toUpperCase();
      if (
        !upper.includes("TOTAL") &&
        !upper.includes("PRICE") &&
        !upper.includes("SUBTOTAL") &&
        !upper.includes("TAX") &&
        !upper.match(/^\d/)
      ) {
        merchant = trimmed;
      }
    }
  }

  return { total: total || 0, merchant: merchant || "Receipt", date: date || new Date().toLocaleDateString() };
}

async function parseReceiptImage(file, onProgress, overrides = {}) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const Tesseract = window.Tesseract;
        if (!Tesseract) {
          resolve([]);
          return;
        }

        const { createWorker } = Tesseract;
        const worker = await createWorker();
        const {
          data: { text },
        } = await worker.recognize(reader.result);
        await worker.terminate();

        const { total, merchant, date } = extractReceiptData(text);

        resolve([
          {
            id: `${Date.now()}-${Math.random()}`,
            date,
            description: merchant,
            amount: total,
            category: categorize(merchant, overrides),
            source: "receipt",
            paymentType: null,
          },
        ]);
      } catch {
        resolve([]);
      }
    };
    reader.readAsDataURL(file);
  });
}

function parseUKDate(dateStr) {
  const patterns = [
    /(\d{1,2})\s+(\w+)\s+(\d{4})/,
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
    /(\d{4})-(\d{2})-(\d{2})/,
  ];

  const months = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (!match) continue;

    if (pattern === patterns[0]) {
      const day = parseInt(match[1]);
      const month = months[match[2].toLowerCase()];
      const year = parseInt(match[3]);
      if (month !== undefined) return new Date(year, month, day);
    } else if (pattern === patterns[1]) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      let year = parseInt(match[3]);
      if (year < 100) year += year < 50 ? 2000 : 1900;
      return new Date(year, month, day);
    } else if (pattern === patterns[2]) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const day = parseInt(match[3]);
      return new Date(year, month, day);
    }
  }

  throw new Error("Invalid date format");
}

function getMonthKey(dateStr) {
  const date = parseUKDate(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(key) {
  const [year, month] = key.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "long" });
}

function formatCurrency(n) {
  return "Â£" + n.toFixed(2);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [categoryOverrides, setCategoryOverrides] = useState({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [syncStatus, setSyncStatus] = useState("idle");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState("expense");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [editingId, setEditingId] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [drillCategory, setDrillCategory] = useState(null);
  const [savingsBalance, setSavingsBalance] = useState(0);
  const [editingRecurringDate, setEditingRecurringDate] = useState(null);

  // Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sync to Firestore
  useEffect(() => {
    if (!user) return;
    setSyncStatus("syncing");
    const docRef = doc(db, "users", user.uid);
    setDoc(
      docRef,
      {
        expenses,
        incomes,
        receipts,
        categoryOverrides,
        savingsBalance,
        lastUpdated: new Date(),
      },
      { merge: true }
    )
      .then(() => setSyncStatus("idle"))
      .catch(() => setSyncStatus("error"));
  }, [user, expenses, incomes, receipts, categoryOverrides, savingsBalance]);

  // Sync from Firestore
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.expenses) setExpenses(data.expenses);
        if (data.incomes) setIncomes(data.incomes);
        if (data.receipts) setReceipts(data.receipts);
        if (data.categoryOverrides) setCategoryOverrides(data.categoryOverrides);
        if (data.savingsBalance !== undefined) setSavingsBalance(data.savingsBalance);
      }
    });
    return unsubscribe;
  }, [user]);

  // localStorage backup
  useEffect(() => {
    localStorage.setItem("pennytrack_expenses", JSON.stringify(expenses));
    localStorage.setItem("pennytrack_incomes", JSON.stringify(incomes));
    localStorage.setItem("pennytrack_receipts", JSON.stringify(receipts));
    localStorage.setItem("pennytrack_overrides", JSON.stringify(categoryOverrides));
    localStorage.setItem("pennytrack_savings", JSON.stringify(savingsBalance));
  }, [expenses, incomes, receipts, categoryOverrides, savingsBalance]);

  // Load from localStorage if no user
  useEffect(() => {
    if (user) return;
    const stored = localStorage.getItem("pennytrack_expenses");
    const storedIncomes = localStorage.getItem("pennytrack_incomes");
    const storedOverrides = localStorage.getItem("pennytrack_overrides");
    const storedSavings = localStorage.getItem("pennytrack_savings");
    if (stored) setExpenses(JSON.parse(stored));
    if (storedIncomes) setIncomes(JSON.parse(storedIncomes));
    if (storedOverrides) setCategoryOverrides(JSON.parse(storedOverrides));
    if (storedSavings) setSavingsBalance(JSON.parse(storedSavings));
  }, [user]);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
    { id: "expenses", label: "Expenses", icon: "\u{1F4B5}" },
    { id: "income", label: "Income", icon: "\u{1F4B0}" },
    { id: "recurring", label: "Recurring", icon: "\u{1F501}" },
    { id: "import", label: "Import", icon: "\u{1F4C1}" },
  ];

  // Filter by month
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => getMonthKey(e.date) === selectedMonth),
    [expenses, selectedMonth]
  );

  const filteredIncomes = useMemo(
    () => incomes.filter((i) => getMonthKey(i.date) === selectedMonth),
    [incomes, selectedMonth]
  );

  // Available months
  const availableMonths = useMemo(() => {
    const months = new Set();
    expenses.forEach((e) => months.add(getMonthKey(e.date)));
    incomes.forEach((i) => months.add(getMonthKey(i.date)));
    return Array.from(months).sort().reverse();
  }, [expenses, incomes]);

  // Totals
  const totalSpent = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  const totalIncome = useMemo(
    () => filteredIncomes.reduce((sum, i) => sum + i.amount, 0),
    [filteredIncomes]
  );

  const netAmount = totalIncome - totalSpent;

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    filteredExpenses.forEach((e) => {
      breakdown[e.category] = (breakdown[e.category] || 0) + e.amount;
    });
    return Object.entries(breakdown)
      .map(([name, amount]) => ({
        name,
        value: parseFloat(amount.toFixed(2)),
        icon: CATEGORIES[name]?.icon || "\u{1F4E6}",
        color: CATEGORIES[name]?.color || "#9ca3af",
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const trend = {};
    expenses.forEach((e) => {
      const key = getMonthKey(e.date);
      trend[key] = (trend[key] || 0) + e.amount;
    });
    return Object.entries(trend)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, amount]) => ({
        month: formatMonth(month).split(" ")[0],
        spending: parseFloat(amount.toFixed(2)),
      }));
  }, [expenses]);

  // Top merchants
  const topMerchants = useMemo(() => {
    const merchants = {};
    filteredExpenses.forEach((e) => {
      const key = normaliseDesc(e.description);
      merchants[key] = (merchants[key] || 0) + e.amount;
    });
    return Object.entries(merchants)
      .map(([name, amount]) => ({ name, amount: parseFloat(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredExpenses]);

  // Recurring transactions
  const recurringTransactions = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      if (e.paymentType === "DD" || e.paymentType === "SO") {
        const key = normaliseDesc(e.description);
        if (!map[key]) {
          map[key] = {
            description: e.description,
            paymentType: e.paymentType,
            amounts: [],
            dates: [],
            category: e.category,
            lastDate: e.date,
          };
        }
        map[key].amounts.push(e.amount);
        map[key].dates.push(e.date);
        // Track the most recent date
        try {
          if (parseUKDate(e.date) > parseUKDate(map[key].lastDate)) {
            map[key].lastDate = e.date;
          }
        } catch {}
      }
    });
    return Object.entries(map).map(([key, data]) => ({
      key,
      description: data.description,
      paymentType: data.paymentType,
      category: data.category,
      avgAmount: parseFloat((data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length).toFixed(2)),
      lastAmount: data.amounts[data.amounts.length - 1],
      lastDate: data.lastDate,
      count: data.amounts.length,
      // Try to detect the day of month
      dayOfMonth: (() => {
        try {
          const d = parseUKDate(data.lastDate);
          return d.getDate();
        } catch { return null; }
      })(),
    })).sort((a, b) => b.avgAmount - a.avgAmount);
  }, [expenses]);

  // Drill category
  const drillExpenses = useMemo(() => {
    if (!drillCategory) return [];
    return filteredExpenses.filter((e) => e.category === drillCategory);
  }, [filteredExpenses, drillCategory]);

  // Login
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setExpenses([]);
      setIncomes([]);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // CRUD
  const addExpense = useCallback((expense) => {
    setExpenses((prev) => [...prev, { ...expense, id: `${Date.now()}-${Math.random()}` }]);
    setShowAddModal(false);
  }, []);

  const addIncome = useCallback((income) => {
    setIncomes((prev) => [...prev, { ...income, id: `${Date.now()}-${Math.random()}` }]);
    setShowAddModal(false);
  }, []);

  const editExpense = useCallback((id, updates) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    setEditingId(null);
  }, []);

  const deleteExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setEditingId(null);
  }, []);

  const deleteIncome = useCallback((id) => {
    setIncomes((prev) => prev.filter((i) => i.id !== id));
    setEditingId(null);
  }, []);

  const importExpenses = useCallback((newExpenses) => {
    setExpenses((prev) => [...prev, ...newExpenses]);
  }, []);

  if (authLoading) return <div className="flex items-center justify-center h-screen">{"\u231B"}</div>;

  // ============ COMPONENTS ============

  function AddModal() {
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("Other");

    const handleAdd = () => {
      if (!description || !amount) return;
      if (addModalType === "expense") {
        addExpense({
          date: (() => {
            const d = new Date(date);
            return `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" }).split(" ")[0]} ${d.getFullYear()}`;
          })(),
          description,
          amount: parseFloat(amount),
          category,
          source: "manual",
          paymentType: null,
        });
      } else {
        addIncome({
          date: (() => {
            const d = new Date(date);
            return `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" }).split(" ")[0]} ${d.getFullYear()}`;
          })(),
          description,
          amount: parseFloat(amount),
          source: "manual",
          paymentType: null,
        });
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-end z-50">
        <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
          <h3 className="text-xl font-bold">Add {addModalType === "expense" ? "Expense" : "Income"}</h3>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
          />
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
          />
          {addModalType === "expense" && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded-lg px-4 py-2"
            >
              {Object.keys(CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(false)}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="flex-1 bg-violet-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  function EditRow({ expense, isIncome = false }) {
    const [editData, setEditData] = useState(expense);

    return (
      <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-3">
        <input
          type="date"
          value={(() => {
            try {
              const d = parseUKDate(editData.date);
              return d.toISOString().split("T")[0];
            } catch {
              return "";
            }
          })()}
          onChange={(e) => {
            const d = new Date(e.target.value);
            setEditData({
              ...editData,
              date: `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" }).split(" ")[0]} ${d.getFullYear()}`,
            });
          }}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={editData.description}
          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        {!isIncome && (
          <select
            value={editData.category}
            onChange={(e) => setEditData({ ...editData, category: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            {Object.keys(CATEGORIES).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
        <input
          type="number"
          value={editData.amount}
          onChange={(e) => setEditData({ ...editData, amount: parseFloat(e.target.value) })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingId(null);
            }}
            className="flex-1 text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (isIncome) {
                deleteIncome(editData.id);
              } else {
                deleteExpense(editData.id);
              }
            }}
            className="flex-1 text-sm px-3 py-2 bg-red-100 text-red-700 rounded-lg"
          >
            Delete
          </button>
          <button
            onClick={() => {
              if (isIncome) {
                setIncomes((prev) =>
                  prev.map((i) => (i.id === editData.id ? editData : i))
                );
              } else {
                editExpense(editData.id, editData);
              }
            }}
            className="flex-1 text-sm px-3 py-2 bg-violet-600 text-white rounded-lg"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  function CategoryDrillDown() {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b">
          <button
            onClick={() => setDrillCategory(null)}
            className="text-violet-600 font-medium"
          >
            {"\u2190"} Back
          </button>
          <h3 className="text-lg font-bold">{drillCategory}</h3>
        </div>

        {drillExpenses.map((e) => (
          <div key={e.id} className="bg-white rounded-lg border border-gray-100 p-4 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-800">{e.description}</p>
                <p className="text-xs text-gray-400">
                  {e.date} {"\u2022"} {e.category}
                  {e.paymentType && (
                    <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      PAYMENT_TYPES[e.paymentType]?.type === "income" ? "bg-emerald-100 text-emerald-700" :
                      PAYMENT_TYPES[e.paymentType]?.recurring ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {PAYMENT_TYPES[e.paymentType]?.icon} {e.paymentType}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800">{formatCurrency(e.amount)}</p>
                {editingId === e.id && (
                  <EditRow expense={e} />
                )}
                {editingId !== e.id && (
                  <button
                    onClick={() => setEditingId(e.id)}
                    className="text-xs text-violet-600 hover:text-violet-800 font-medium mt-1"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ============ RENDER ============

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-violet-600 to-purple-600 text-white">
        <h1 className="text-5xl font-bold mb-4">{"\u{1F4B5}"}</h1>
        <h2 className="text-3xl font-bold mb-2">PennyTrack</h2>
        <p className="text-violet-100 mb-8 text-center max-w-sm">
          Smart expense tracking with AI-powered categorization and bank statement import.
        </p>
        <button
          onClick={handleLogin}
          className="bg-white text-violet-600 px-8 py-3 rounded-lg font-bold hover:bg-gray-50 transition-all"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{"\u{1F4B5}"} PennyTrack</h1>
            {syncStatus === "syncing" && <span className="text-xs text-gray-500">{"\u231B"}</span>}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-40">
        <div className="max-w-6xl mx-auto px-4 flex gap-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? "border-violet-600 text-violet-600"
                  : "border-transparent text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Totals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <p className="text-gray-600 text-sm font-medium">Spent</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{formatCurrency(totalSpent)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatMonth(selectedMonth)}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <p className="text-gray-600 text-sm font-medium">Income</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{formatCurrency(totalIncome)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatMonth(selectedMonth)}</p>
              </div>
              <div className={`bg-white rounded-2xl p-6 border border-gray-100 ${netAmount >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <p className="text-gray-600 text-sm font-medium">Net</p>
                <p className={`text-3xl font-bold mt-2 ${netAmount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(Math.abs(netAmount))}
                </p>
                <p className="text-xs text-gray-400 mt-1">{netAmount >= 0 ? "Surplus" : "Deficit"}</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              {categoryBreakdown.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-bold mb-4">Spending by Category</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Bar Chart */}
              {monthlyTrend.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-bold mb-4">Monthly Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyTrend}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="spending" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Categories */}
            {categoryBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <h3 className="text-lg font-bold mb-4">Categories</h3>
                <div className="space-y-3">
                  {categoryBreakdown.map((cat) => (
                    <div
                      key={cat.name}
                      onClick={() => setDrillCategory(cat.name)}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-all"
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: cat.color + "20" }}>
                        {cat.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{cat.name}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${(cat.value / totalSpent) * 100}%`, backgroundColor: cat.color }}
                          />
                        </div>
                      </div>
                      <p className="font-bold text-gray-800">{formatCurrency(cat.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Merchants */}
            {topMerchants.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <h3 className="text-lg font-bold mb-4">Top Merchants</h3>
                <div className="space-y-2">
                  {topMerchants.map((m) => (
                    <div key={m.name} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg">
                      <p className="text-gray-700 font-medium">{m.name}</p>
                      <p className="text-gray-800 font-bold">{formatCurrency(m.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Month Picker */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <label className="text-sm font-medium text-gray-700">Select Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="mt-2 w-full border rounded-lg px-4 py-2"
              >
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatMonth(month)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Expenses */}
        {activeTab === "expenses" && (
          <div className="space-y-4">
            {editingId && (
              <EditRow expense={filteredExpenses.find((e) => e.id === editingId)} />
            )}
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 font-medium">{"\u{1F4B5}"} No expenses this month</p>
              </div>
            ) : (
              filteredExpenses
                .sort((a, b) => {
                  try {
                    return parseUKDate(b.date) - parseUKDate(a.date);
                  } catch {
                    return 0;
                  }
                })
                .map((e) => (
                  <div key={e.id} className="bg-white rounded-lg border border-gray-100 p-4 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{e.description}</p>
                        <p className="text-xs text-gray-400">
                          {e.date} {"\u2022"} {e.category}
                          {e.paymentType && (
                            <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              PAYMENT_TYPES[e.paymentType]?.type === "income" ? "bg-emerald-100 text-emerald-700" :
                              PAYMENT_TYPES[e.paymentType]?.recurring ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {PAYMENT_TYPES[e.paymentType]?.icon} {e.paymentType}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">{formatCurrency(e.amount)}</p>
                        {editingId !== e.id && (
                          <button
                            onClick={() => setEditingId(e.id)}
                            className="text-xs text-violet-600 hover:text-violet-800 font-medium mt-1"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {editingId === e.id && (
                      <div className="mt-4">
                        <EditRow expense={e} />
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        )}

        {/* Income */}
        {activeTab === "income" && (
          <div className="space-y-4">
            {filteredIncomes.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 font-medium">{"\u{1F4B0}"} No income this month</p>
              </div>
            ) : (
              filteredIncomes
                .sort((a, b) => {
                  try {
                    return parseUKDate(b.date) - parseUKDate(a.date);
                  } catch {
                    return 0;
                  }
                })
                .map((i) => (
                  <div key={i.id} className="bg-white rounded-lg border border-gray-100 p-4 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{i.description}</p>
                        <p className="text-xs text-gray-400">{i.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">{formatCurrency(i.amount)}</p>
                        {editingId !== i.id && (
                          <button
                            onClick={() => setEditingId(i.id)}
                            className="text-xs text-violet-600 hover:text-violet-800 font-medium mt-1"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {editingId === i.id && (
                      <div className="mt-4">
                        <EditRow expense={i} isIncome={true} />
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        )}

        {/* Recurring */}
        {activeTab === "recurring" && (
          <div className="space-y-4">
            {/* Summary */}
            {recurringTransactions.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-4 text-white">
                  <p className="text-blue-200 text-xs font-medium">Direct Debits</p>
                  <p className="text-2xl font-bold mt-1">{recurringTransactions.filter(r => r.paymentType === "DD").length}</p>
                  <p className="text-blue-200 text-[10px] mt-1">{formatCurrency(recurringTransactions.filter(r => r.paymentType === "DD").reduce((s, r) => s + r.avgAmount, 0))}/month avg</p>
                </div>
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 text-white">
                  <p className="text-violet-200 text-xs font-medium">Standing Orders</p>
                  <p className="text-2xl font-bold mt-1">{recurringTransactions.filter(r => r.paymentType === "SO").length}</p>
                  <p className="text-violet-200 text-[10px] mt-1">{formatCurrency(recurringTransactions.filter(r => r.paymentType === "SO").reduce((s, r) => s + r.avgAmount, 0))}/month avg</p>
                </div>
              </div>
            )}

            {recurringTransactions.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl mb-4 block">{"\u{1F501}"}</span>
                <p className="text-gray-500 font-medium">No recurring payments found</p>
                <p className="text-gray-400 text-sm mt-1">Import a bank statement and we'll detect Direct Debits & Standing Orders</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">All Recurring Payments</h3>
                {recurringTransactions.map(r => (
                  <div key={r.key} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${r.paymentType === "DD" ? "bg-blue-50" : "bg-violet-50"}`}>
                        {PAYMENT_TYPES[r.paymentType]?.icon || "\u{1F501}"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${r.paymentType === "DD" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"}`}>
                            {r.paymentType === "DD" ? "Direct Debit" : "Standing Order"}
                          </span>
                          <span className="text-xs text-gray-400">{r.category}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-800">{formatCurrency(r.lastAmount)}</p>
                        <p className="text-[10px] text-gray-400">avg {formatCurrency(r.avgAmount)}</p>
                      </div>
                    </div>
                    {/* Date info - editable */}
                    <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{"\u{1F4C5}"} Last:</span>
                        {editingRecurringDate === r.key ? (
                          <input
                            type="date"
                            defaultValue={(() => { try { const d = parseUKDate(r.lastDate); return d.toISOString().split("T")[0]; } catch { return ""; } })()}
                            onBlur={(e) => {
                              if (e.target.value) {
                                // Update all matching expenses with the new date
                                const normKey = r.key;
                                setExpenses(prev => prev.map(exp => {
                                  if ((exp.paymentType === "DD" || exp.paymentType === "SO") && normaliseDesc(exp.description) === normKey && exp.date === r.lastDate) {
                                    return { ...exp, date: e.target.value };
                                  }
                                  return exp;
                                }));
                              }
                              setEditingRecurringDate(null);
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingRecurringDate(null); }}
                            autoFocus
                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                        ) : (
                          <span className="text-xs font-medium text-gray-700">{r.lastDate}</span>
                        )}
                        {r.dayOfMonth && !editingRecurringDate && (
                          <span className="text-[10px] text-gray-400">(~{r.dayOfMonth}{r.dayOfMonth === 1 ? "st" : r.dayOfMonth === 2 ? "nd" : r.dayOfMonth === 3 ? "rd" : "th"} of month)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{r.count}x seen</span>
                        <button
                          onClick={() => setEditingRecurringDate(r.key)}
                          className="text-xs text-violet-500 hover:text-violet-700 font-medium"
                        >
                          Edit date
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info box */}
            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">{"\u{1F4A1}"} About Payment Types</h3>
              <div className="text-xs text-blue-700 space-y-1">
                <p>{"\u2022"} <strong>DD</strong> - Direct Debit: Automatic payments to companies (bills, subscriptions)</p>
                <p>{"\u2022"} <strong>SO</strong> - Standing Order: Fixed regular payments you've set up</p>
                <p>{"\u2022"} <strong>FPI/FPO</strong> - Faster Payments: Instant bank transfers in/out</p>
                <p>{"\u2022"} <strong>DEB</strong> - Debit Card: Card payments in shops or online</p>
                <p>{"\u2022"} <strong>BGC</strong> - Bank Giro Credit: Credits into your account (salary, refunds)</p>
                <p>{"\u2022"} Payment types are auto-detected from your bank statement</p>
              </div>
            </div>
          </div>
        )}

        {/* Import */}
        {activeTab === "import" && (
          <div className="space-y-6">
            {importResult && (
              <div className={`rounded-2xl border p-4 ${importResult.success ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                <p className={importResult.success ? "text-emerald-800 font-medium" : "text-red-800 font-medium"}>
                  {importResult.message}
                </p>
                {importResult.count !== undefined && (
                  <p className={`text-sm mt-1 ${importResult.success ? "text-emerald-700" : "text-red-700"}`}>
                    {importResult.count} items imported
                  </p>
                )}
              </div>
            )}

            {/* CSV Import */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-lg font-bold mb-4">{"\u{1F4C1}"} Import CSV</h3>
              <input
                type="file"
                accept=".csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const newExpenses = parseCSV(text, categoryOverrides);
                  importExpenses(newExpenses);
                  setImportResult({
                    success: true,
                    message: "CSV imported successfully",
                    count: newExpenses.length,
                  });
                  setTimeout(() => setImportResult(null), 3000);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
            </div>

            {/* PDF Import */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-lg font-bold mb-4">{"\u{1F4C4}"} Import PDF</h3>
              <input
                type="file"
                accept=".pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const newExpenses = parsePDFText(text, categoryOverrides);
                  importExpenses(newExpenses);
                  setImportResult({
                    success: true,
                    message: "PDF imported successfully",
                    count: newExpenses.length,
                  });
                  setTimeout(() => setImportResult(null), 3000);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
            </div>

            {/* Receipt Upload */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-lg font-bold mb-4">{"\u{1F4F7}"} Receipt Photos</h3>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setOcrProgress(50);
                  const receipts = await parseReceiptImage(file, setOcrProgress, categoryOverrides);
                  importExpenses(receipts);
                  setOcrProgress(100);
                  setImportResult({
                    success: true,
                    message: "Receipt scanned successfully",
                    count: receipts.length,
                  });
                  setTimeout(() => setImportResult(null), 3000);
                  setOcrProgress(0);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
              {ocrProgress > 0 && ocrProgress < 100 && (
                <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 bg-violet-600 rounded-full transition-all"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Drill Category */}
        {drillCategory && (
          <div className="mt-8">
            <CategoryDrillDown />
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3">
        <button
          onClick={() => {
            setAddModalType("income");
            setShowAddModal(true);
          }}
          className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center text-2xl hover:bg-emerald-700 shadow-lg transition-all"
        >
          {"\u{1F4B0}"}
        </button>
        <button
          onClick={() => {
            setAddModalType("expense");
            setShowAddModal(true);
          }}
          className="w-14 h-14 rounded-full bg-violet-600 text-white flex items-center justify-center text-2xl hover:bg-violet-700 shadow-lg transition-all"
        >
          {"\u{2795}"}
        </button>
      </div>

      {/* Modal */}
      {showAddModal && <AddModal />}
    </div>
  );
}
