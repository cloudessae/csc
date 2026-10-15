// PART 1 OF 7: IMPORTS, CONFIGURATION & INDEXEDDB CACHING ENGINE

// explanation // Import core React hooks for state, lifecycle, memoization, and references
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// explanation // Import charting components from Recharts for bar and pie analytics
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
  PieChart, Pie, Cell, Legend
} from 'recharts';

// explanation // Import visual glyphs and iconography from lucide-react
import { 
  Wrench, Layers, CheckSquare, RefreshCw, Sun, Moon, Search,
  CheckCircle2, Clock, Plus, Edit2, Trash2, X, Database,
  Package, IndianRupee, Eye, AlertCircle, Percent,
  RotateCcw, Tag, DownloadCloud, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, Check, SlidersHorizontal, Menu, Sparkles
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                CONFIGURATION                               */
/* -------------------------------------------------------------------------- */

// explanation // Target Google Sheet document ID containing all operational tables
const SPREADSHEET_ID = "1pFP8C3cz26s4ZBXkwptMIZsl-3qkQz-Xs5pQfMMnuJc";

// explanation // Exact column header schema expected by the Spare Approval tab
const APPROVAL_COLUMN_HEADERS = [
  'Req ID', 'Req Date', 'Order Number', 'Requester Comment', 'BU Name',
  'Task Owner', 'Part Code', 'Part Decription', 'Quanitity', 'Price',
  'Task No.', 'Ordered By', 'Part Transaction', 'Transaction Type',
  'Tax Category', 'Approval Status', 'Status', 'Status Date', 'Remarks'
];

// explanation // Complete list of selectable business units (branches)
const PRESET_BU_LIST = [
  'Ahmedabad', 'Baroda', 'Indore', 'Goa', 'Hubli', 'Mangalore', 'Mysore', 'BSC',
  'Chennai', 'Coimbatore', 'NCR', 'Pondicherry', 'Cochin', 'Tirupati', 'Dindigul',
  'Erode', 'Madurai', 'Salem', 'Tirunelveli', 'Mohali', 'Haridwar', 'Jaipur',
  'Lucknow', 'Hosur', 'Bhubaneshwar', 'Kolkata', 'Mumbai', 'Nagpur', 'Nasik',
  'Pune', 'Vijayawada', 'Vizag', 'Hyderabad'
];

// explanation // Automated routing mapping each business unit to its respective team lead code
const PRESET_BU_TO_TL = {
  Ahmedabad: 'AKB', Baroda: 'AKB', Indore: 'AKB', Goa: 'AKB', Hubli: 'AKB',
  Mangalore: 'AKB', Mysore: 'AKB', BSC: 'AKB', Chennai: 'YKR', Coimbatore: 'YKR',
  NCR: 'AKB', Pondicherry: 'YKR', Cochin: 'YKR', Tirupati: 'YKR', Dindigul: 'YKR',
  Erode: 'YKR', Madurai: 'YKR', Salem: 'YKR', Tirunelveli: 'YKR', Mohali: 'AKB',
  Haridwar: 'AKB', Jaipur: 'AKB', Lucknow: 'AKB', Hosur: 'YKR', Bhubaneshwar: 'YKR',
  Kolkata: 'YKR', Mumbai: 'AKB', Nagpur: 'AKB', Nasik: 'AKB', Pune: 'AKB',
  Vijayawada: 'YKR', Vizag: 'YKR', Hyderabad: 'YKR'
};

// explanation // Preset source entity categories for spare requisitions
const PRESET_ORDERED_BY = ['CSC', 'BU'];

// explanation // Standardized classification types for spare transactions
const PRESET_PART_TRANSACTIONS = ['RMR', 'ICSL', 'ST', 'PBS', 'CSC Warranty'];

// explanation // Transaction billing codes accepted in the approval ledger
const PRESET_TRANSACTION_TYPES = [
  'BOM_BU_Transfer_Permanent_Ord', 'BOM_BU_DC_Permanent_Ord',
  'BOM_Branch_Stock_Transf_Order', 'BOM_DC_Stock_Transf_Order',
  'BOM_FOC_Local_Warranty', 'BOM_FOC_Interstate_Warranty'
];

// explanation // Automated tax bracket assignment based on transaction type
const TRANSACTION_TYPE_TO_TAX = {
  BOM_BU_Transfer_Permanent_Ord: 'Bom:Insterstate 18%',
  BOM_BU_DC_Permanent_Ord: 'Bom:Local 0%',
  BOM_Branch_Stock_Transf_Order: 'Bom:Interstate 18%',
  BOM_DC_Stock_Transf_Order: 'Bom:Local 0%',
  BOM_FOC_Local_Warranty: 'Bom:Local 0%',
  BOM_FOC_Interstate_Warranty: 'Bom:Interstate 0%'
};

// explanation // Month lookup abbreviations for date formatting
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// explanation // Consistent palette definitions for pie chart slices
const PIE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#22d3ee', '#fb923c', '#94a3b8'];

/* -------------------------------------------------------------------------- */
/*                            INDEXED-DB STORAGE ENGINE                       */
/* -------------------------------------------------------------------------- */

// explanation // Local browser database identifier
const DB_NAME = 'CSCDashboardDB';
// explanation // Database schema versioning counter
const DB_VERSION = 1;
// explanation // Target object store table for caching fetched spreadsheet rows
const STORE_NAME = 'sheet_cache';

// explanation // Initializes or connects to the local IndexedDB instance
function getDB() {
  return new Promise((resolve, reject) => {
    // explanation // Open connection request to IndexedDB
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    // explanation // Setup schema and object store if running for the first time
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    // explanation // Return initialized database handle
    request.onsuccess = () => resolve(request.result);
    // explanation // Forward failure errors to caller
    request.onerror = () => reject(request.error);
  });
}

// explanation // Saves key-value data persistently in browser storage
async function setDbItem(key, value) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      // explanation // Initiate read-write transaction
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB setItem error:', err);
  }
}

// explanation // Retrieves cached dataset from IndexedDB by cache key
async function getDbItem(key) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      // explanation // Initiate read-only transaction
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB getItem error:', err);
    return null;
  }
}
// PART 2 OF 7: PARSING, NORMALIZING & LIVE CSV FETCH ENGINE

/* -------------------------------------------------------------------------- */
/*              STRICT DATE NORMALIZER & FORMATTER (DD-MMM-YYYY)              */
/* -------------------------------------------------------------------------- */

// explanation // Converts varied date inputs (Excel serials, ISO, GViz) into JavaScript Date instances
function parseDate(val) {
  // explanation // Return null immediately if input is empty or undefined
  if (!val) return null;
  // explanation // Pass through existing Date objects if valid
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  // explanation // Handle numeric Excel serial date representation
  if (typeof val === 'number' && val > 20000 && val < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + val * 86400000);
  }

  const strVal = String(val).trim();
  // explanation // Parse Google Visualization Date(YYYY,M,D) formatted strings
  const gvizMatch = strVal.match(/Date\((\d+),(\d+),(\d+)/);
  if (gvizMatch) {
    return new Date(parseInt(gvizMatch[1], 10), parseInt(gvizMatch[2], 10), parseInt(gvizMatch[3], 10));
  }

  const cleaned = strVal.split(' ')[0];
  // explanation // Parse DD-MMM-YYYY format (e.g. 15-Oct-2026)
  const dashMatch = cleaned.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})$/);
  if (dashMatch) {
    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    const day = parseInt(dashMatch[1], 10);
    const month = months[dashMatch[2].toLowerCase()];
    let year = parseInt(dashMatch[3], 10);
    if (year < 100) year += 2000;
    if (month !== undefined) return new Date(year, month, day);
  }

  // explanation // Parse ISO format YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }

  // explanation // Parse DD-MM-YYYY format
  const ddmmyyyyMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (ddmmyyyyMatch) {
    let year = parseInt(ddmmyyyyMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, parseInt(ddmmyyyyMatch[2], 10) - 1, parseInt(ddmmyyyyMatch[1], 10));
  }

  // explanation // Fallback to standard JavaScript date parser
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// explanation // Consistently formats date instances into DD-MMM-YYYY strings
function formatDate(val) {
  if (!val || val === '-' || val === 'N/A' || val === 'null' || val === 'undefined') return '-';
  const d = val instanceof Date ? val : parseDate(val);
  if (!d || isNaN(d.getTime())) {
    return typeof val === 'string' && val.trim() ? val.trim() : '-';
  }
  return `${String(d.getDate()).padStart(2, '0')}-${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
}

// explanation // Converts date values into YYYY-MM-DD format for HTML date input controls
function toISODateInput(dateStrOrObj) {
  if (!dateStrOrObj) return '';
  const d = typeof dateStrOrObj === 'string' ? parseDate(dateStrOrObj) : dateStrOrObj;
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// explanation // Strips non-numeric characters and parses clean currency floats
function parseCurrency(val) {
  if (!val) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

// explanation // Extracts terminal integer sequence from alphanumeric IDs
function extractIdNumber(idStr) {
  if (!idStr) return 0;
  const match = String(idStr).match(/\d+/g);
  return match ? parseInt(match[match.length - 1], 10) : 0;
}

// explanation // Normalizes category text into standardized business categories
function parseCategoryValue(val) {
  if (!val) return 'NA';
  const clean = String(val).trim().toUpperCase();
  if (clean.startsWith('WA')) return 'Warranty';
  if (clean.startsWith('AMC')) return 'ASC';
  return 'NA';
}

/* -------------------------------------------------------------------------- */
/*                 ROBUST CSV FETCH ENGINE & STREAMING PARSER                 */
/* -------------------------------------------------------------------------- */

// explanation // Downloads and parses public Google Sheet tabs via GViz CSV export endpoint
async function fetchGoogleSheetData(sheetName) {
  // explanation // Encode sheet name safely for HTTP URL query parameter
  const encodedSheet = encodeURIComponent(sheetName);
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`;

  // explanation // Execute fetch request against Google Sheets
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet "${sheetName}". Ensure the sheet is public.`);
  }
  const csvText = await response.text();

  // explanation // Stateful character-by-character CSV tokenizer supporting quotes and commas
  const parseCSV = (text) => {
    const lines = [];
    let row = [];
    let entry = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      // explanation // Handle escaped quotes and toggle quote boundaries
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          entry += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // explanation // Complete current field on unquoted comma
        row.push(entry.trim());
        entry = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        // explanation // Complete current row on line-break
        if (char === '\r' && nextChar === '\n') i++;
        row.push(entry.trim());
        if (row.some(cell => cell !== '')) lines.push(row);
        row = [];
        entry = '';
      } else {
        entry += char;
      }
    }
    // explanation // Flush remaining buffer after final character
    if (entry || row.length > 0) {
      row.push(entry.trim());
      if (row.some(cell => cell !== '')) lines.push(row);
    }
    return lines;
  };

  const parsed = parseCSV(csvText);
  if (!parsed || parsed.length === 0) {
    return { cols: [], rows: [] };
  }

  // explanation // Extract column titles from the first row
  const rawHeaders = parsed[0];
  const cols = rawHeaders.map((h, i) => (h && h.trim()) ? h.trim() : `Col_${i}`);

  // explanation // Transform rows into structured key-value maps retaining raw indexes
  const rows = parsed.slice(1).map(dataRow => {
    const rowObj = {};
    const rawArray = [];
    cols.forEach((colName, idx) => {
      const val = dataRow[idx] !== undefined && dataRow[idx] !== null ? String(dataRow[idx]).trim() : '';
      rowObj[colName] = val;
      rawArray[idx] = val;
    });
    rowObj.__raw = rawArray;
    return rowObj;
  });

  return { cols, rows };
}
// PART 3 OF 7: ACCESSIBLE GLASS MULTI-SELECT DROPDOWN COMPONENT

/* -------------------------------------------------------------------------- */
/*           HIGH-Z-INDEX ACCESSIBLE GLASS MULTI-SELECT DROPDOWN              */
/* -------------------------------------------------------------------------- */

// explanation // Reusable dropdown supporting item search, multi-selection, and outside-click dismissal
function MultiSelectDropdown({ label, options = [], selected = [], onChange, isDark, placeholder = "All" }) {
  // explanation // Local open/closed state of the popup panel
  const [isOpen, setIsOpen] = useState(false);
  // explanation // Search term to filter available options inside the menu
  const [filterQuery, setFilterQuery] = useState('');
  // explanation // Ref attached to container for detecting outside clicks
  const containerRef = useRef(null);

  // explanation // Listen for global mousedown events to close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // explanation // Toggles presence of an option inside the active selection array
  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(item => item !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  // explanation // Selects all available options
  const selectAll = () => onChange([...options]);
  // explanation // Clears all selections
  const clearAll = () => onChange([]);

  // explanation // Computes filtered options list based on active search query
  const filteredOptions = useMemo(() => {
    if (!filterQuery.trim()) return options;
    const q = filterQuery.toLowerCase();
    return options.filter(o => String(o).toLowerCase().includes(q));
  }, [options, filterQuery]);

  // explanation // Formats label summary shown on the closed trigger button
  const buttonText = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) return selected[0];
    return `${label ? label + ': ' : ''}(${selected.length})`;
  }, [selected, placeholder, label]);

  return (
    // explanation // Container maintains higher stacking context when open to avoid being overlapped
    <div className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-300/80 mb-1.5 truncate">
          {label}
        </label>
      )}
      {/* explanation // Interactive trigger button for opening dropdown */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full text-xs min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-md flex items-center justify-between gap-1.5 text-left font-medium transition duration-200 cursor-pointer shadow-xs select-none ${
          selected.length > 0
            ? 'border-indigo-400/80 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 dark:border-indigo-500/50 shadow-indigo-500/10'
            : isDark
              ? 'bg-slate-900/80 border-white/10 text-slate-200 hover:bg-slate-800 hover:border-white/20'
              : 'bg-white/80 border-slate-200 text-slate-800 hover:bg-white hover:border-slate-300'
        }`}
      >
        <span className="truncate">{buttonText}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* explanation // Floating popover panel showing search box and options list */}
      {isOpen && (
        <div className={`absolute top-full left-0 z-[60] mt-1.5 w-full min-w-[210px] sm:min-w-[240px] max-w-[calc(100vw-2.5rem)] rounded-2xl border backdrop-blur-2xl shadow-2xl p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150 ${
          isDark 
            ? 'bg-slate-950/95 border-white/15 text-slate-100 shadow-black/80' 
            : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-400/50'
        }`}>
          {/* explanation // Filter input rendered only when options list exceeds 6 entries */}
          {options.length > 6 && (
            <input
              type="text"
              placeholder="Search..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className={`w-full text-xs min-h-[38px] px-3 py-1.5 rounded-xl border backdrop-blur-sm focus:outline-hidden transition ${
                isDark 
                  ? 'bg-slate-900/90 border-white/10 text-slate-100 focus:border-indigo-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'
              }`}
            />
          )}

          {/* explanation // Header with Select All and Clear shortcuts */}
          <div className="flex items-center justify-between text-[11px] px-1 py-1 border-b border-white/10 dark:border-white/10">
            <button
              type="button"
              onClick={selectAll}
              className="min-h-[34px] px-2 text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="min-h-[34px] px-2 text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>

          {/* explanation // Scrollable list of selectable options */}
          <div className="max-h-52 overflow-y-auto space-y-1 text-xs pr-1 overscroll-contain">
            {filteredOptions.length === 0 ? (
              <div className="text-[11px] text-slate-400 p-3 text-center">No options match</div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`min-h-[42px] flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition select-none ${
                      isChecked
                        ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/30'
                        : isDark
                          ? 'hover:bg-white/10 text-slate-300'
                          : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="truncate pr-2">{opt}</span>
                    {isChecked && <Check className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// PART 4 OF 7: ROOT APPLICATION SHELL, SIDEBAR & DATA SYNC

/* -------------------------------------------------------------------------- */
/*                                ROOT DASHBOARD                              */
/* -------------------------------------------------------------------------- */

// explanation // Main container component managing state, theme, and tab navigation
export default function App() {
  // explanation // Active workspace tab: 'operations', 'used', or 'approval'
  const [activeTab, setActiveTab] = useState('operations');
  // explanation // Responsive sidebar drawer toggle for mobile screens
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // explanation // Desktop hover expansion state for sidebar
  const [isHovered, setIsHovered] = useState(false);
  // explanation // Theme state toggle between dark and light mode
  const [theme, setTheme] = useState('dark');
  const isDark = theme === 'dark';

  // explanation // Datasets for each module
  const [opsData, setOpsData] = useState([]);
  const [usedData, setUsedData] = useState([]);
  const [approvalData, setApprovalData] = useState([]);

  // explanation // Background sync progress indicators
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  // explanation // Resolved sidebar state based on hover or pin
  const isExpanded = isSidebarOpen || isHovered;

  // explanation // Syncs document body theme class with React state
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // explanation // Load cached datasets from IndexedDB upon initial application mount
  useEffect(() => {
    let isMounted = true;
    async function loadCache() {
      const cachedOps = await getDbItem('csc_ops_data_v25');
      const cachedUsed = await getDbItem('csc_used_data_v25');
      const cachedApproval = await getDbItem('csc_approval_data_v25');

      if (isMounted) {
        if (cachedOps) setOpsData(cachedOps);
        if (cachedUsed) setUsedData(cachedUsed);
        if (cachedApproval) setApprovalData(cachedApproval);

        // explanation // Auto-fetch live sheets if local cache is completely empty
        if (!cachedOps && !cachedUsed) {
          importAllSheets();
        }
      }
    }
    loadCache();
    return () => { isMounted = false; };
  }, []);

  // explanation // Parallel fetcher downloading and parsing all 3 Google Sheets
  const importAllSheets = useCallback(async () => {
    setIsImportingAll(true);
    setImportStatus({ type: 'info', message: 'Connecting to Google Sheets & fetching complete data...' });

    try {
      // explanation // 1. Fetch Service Operations sheet
      const opsResult = await fetchGoogleSheetData('Service Operations');
      const parsedOps = opsResult.rows.map(row => {
        const raw = row.__raw || Object.values(row);

        const srNumberVal = String(raw[0] !== undefined && raw[0] !== null ? raw[0] : (row['SR Number'] || '')).trim();
        const srTypeVal = String(raw[1] !== undefined && raw[1] !== null ? raw[1] : (row['SR Type'] || '')).trim();
        const taskNoVal = String(raw[2] !== undefined && raw[2] !== null ? raw[2] : (row['Task No'] || '')).trim();
        const taskTypeVal = String(raw[3] !== undefined && raw[3] !== null ? raw[3] : (row['Task Type'] || '')).trim();
        const branchVal = String(raw[4] !== undefined && raw[4] !== null ? raw[4] : (row['Branch Name'] || '')).trim();
        const assigneeVal = String(raw[5] !== undefined && raw[5] !== null ? raw[5] : (row['Assignee'] || '')).trim();
        const taskNameVal = String(raw[6] !== undefined && raw[6] !== null ? raw[6] : (row['Task Name'] || '')).trim();
        const customerVal = String(raw[11] !== undefined && raw[11] !== null ? raw[9] : (row['Customer Name'] || '')).trim();
        const slNoVal = String(raw[14] !== undefined && raw[14] !== null ? raw[14] : (row['Sl no'] || '')).trim();
        const descriptionVal = String(raw[15] !== undefined && raw[15] !== null ? raw[15] : (row['desc'] || row['Description'] || '')).trim();

        const rawColQ = String(raw[16] !== undefined ? raw[16] : '').trim();
        const problemCodeVal = (rawColQ && rawColQ !== '-') ? rawColQ : 'Not Specified';

        const rawColT = String(raw[19] || '').trim();
        const categoryVal = parseCategoryValue(rawColT);

        const rawSrDate = raw[18] !== undefined && raw[18] !== null ? raw[18] : (row['SR Date'] || '');
        const rawTaskDate = raw[19] !== undefined && raw[19] !== null ? raw[19] : (row['Task Date'] || '');
        const srDateVal = formatDate(rawSrDate);
        const taskDateVal = formatDate(rawTaskDate);

        const taskStatusVal = String(raw[32] !== undefined && raw[32] !== null ? raw[32] : (row['Task Status'] || '')).trim();
        const srStatusVal = String(raw[33] !== undefined && raw[33] !== null ? raw[33] : (row['SR Status'] || '')).trim();

        let productVal = String(raw[35] !== undefined && raw[35] !== null ? raw[35] : (row['Product'] || '')).trim();
        let modelVal = String(raw[36] !== undefined && raw[36] !== null ? raw[36] : (row['Model'] || '')).trim();

        if (/^\d+$/.test(productVal) || productVal.length > 50) productVal = '';
        if (modelVal.toLowerCase() === customerVal.toLowerCase() || /^\d+$/.test(modelVal) || modelVal.length > 40) {
          modelVal = '';
        }

        const dateObj = parseDate(rawTaskDate || rawSrDate);

        return {
          srNumber: srNumberVal || '-',
          srType: srTypeVal || 'General',
          taskNo: taskNoVal || '-',
          taskType: taskTypeVal || 'General',
          branch: branchVal || '-',
          customer: customerVal || '-',
          slNo: slNoVal || '-',
          description: descriptionVal || '-',
          srDate: srDateVal,
          taskDate: taskDateVal,
          taskStatus: taskStatusVal || 'Pending',
          srStatus: srStatusVal || 'Pending',
          product: productVal || '-',
          model: modelVal || '-',
          problemCode: problemCodeVal,
          category: categoryVal,
          assignee: assigneeVal,
          taskName: taskNameVal || '-',
          dateObj,
          formattedDate: taskDateVal !== '-' ? taskDateVal : srDateVal
        };
      }).filter(r => r.taskNo !== '-' || r.srNumber !== '-' || r.customer !== '-');

      // explanation // Save normalized operations data to local storage
      await setDbItem('csc_ops_data_v25', parsedOps);
      setOpsData(parsedOps);

      // explanation // 2. Fetch Spare Used sheet
      const usedResult = await fetchGoogleSheetData('Spare Used');
      await setDbItem('csc_used_data_v25', usedResult.rows);
      await setDbItem('csc_used_headers_v25', usedResult.cols);
      setUsedData(usedResult.rows);

      // explanation // 3. Fetch Spare Approval sheet
      const approvalResult = await fetchGoogleSheetData('Spare Approval');
      const approvalRows = approvalResult.rows.map((row, idx) => {
        const raw = row.__raw || Object.values(row);
        const rowArr = APPROVAL_COLUMN_HEADERS.map((h, hIdx) => {
          let val = row[h] !== undefined && row[h] !== '' ? row[h] : raw[hIdx];
          if (val !== null && typeof val === 'object') {
            val = val.f !== undefined && val.f !== null ? val.f : (val.v !== undefined ? val.v : '');
          }
          return val !== null && val !== undefined ? String(val).trim() : '';
        });
        return { index_: idx + 2, row: rowArr };
      });

      await setDbItem('csc_approval_data_v25', approvalRows);
      setApprovalData(approvalRows);

      setImportStatus({ 
        type: 'success', 
        message: `Imported successfully! Service Operations: ${parsedOps.length} rows, Spare Used: ${usedResult.rows.length} rows, Spare Approval: ${approvalRows.length} rows.` 
      });

      setTimeout(() => setImportStatus(null), 7000);
    } catch (err) {
      console.error(err);
      setImportStatus({ 
        type: 'error', 
        message: `Import failed: ${err.message}. Please verify Google Sheet link sharing.` 
      });
    } finally {
      setIsImportingAll(false);
    }
  }, []);

  // explanation // Configuration definitions for the 3 main workspace modules
  const moduleTiles = [
    {
      id: 'operations',
      title: 'Service Operation',
      subtitle: 'Service Requests & Tasks',
      icon: Wrench,
      count: opsData.length,
      gradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
      glow: 'shadow-blue-500/20',
      activeBorder: 'border-blue-400 bg-blue-500/20 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30',
      badgeBg: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-400/40'
    },
    {
      id: 'used',
      title: 'Spare Used',
      subtitle: 'Spares Used in All Tasks',
      icon: Layers,
      count: usedData.length,
      gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      glow: 'shadow-emerald-500/20',
      activeBorder: 'border-emerald-400 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30',
      badgeBg: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/40'
    },
    {
      id: 'approval',
      title: 'Spare Approval',
      subtitle: 'Non Commercial Spare Approvals',
      icon: CheckSquare,
      count: approvalData.length,
      gradient: 'from-fuchsia-500/20 via-purple-500/10 to-transparent',
      glow: 'shadow-purple-500/20',
      activeBorder: 'border-purple-400 bg-purple-500/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/30',
      badgeBg: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-400/40'
    }
  ];

  return (
    <div className={`min-h-screen relative font-sans antialiased selection:bg-indigo-500 selection:text-white transition-colors duration-300 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* explanation // Atmospheric background blur ornaments */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-pink-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col md:flex-row">
        {/* explanation // Backdrop overlay for closing drawer on mobile devices */}
        {isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md md:hidden transition-opacity"
          />
        )}

        {/* explanation // Glassmorphic collapsible navigation sidebar */}
        <aside 
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`fixed md:sticky top-0 h-screen z-50 md:z-20 overflow-y-auto backdrop-blur-xl border-r transition-all duration-300 ease-in-out flex flex-col justify-between shrink-0 shadow-2xl md:shadow-none ${
            isDark 
              ? 'bg-slate-950/80 border-white/10' 
              : 'bg-white/80 border-slate-200/80'
          } ${
            isSidebarOpen 
              ? 'translate-x-0 w-72' 
              : '-translate-x-full md:translate-x-0'
          } ${
            isExpanded ? 'md:w-64' : 'md:w-20'
          }`}
        >
          <div>
            <div className={`h-16 flex items-center border-b border-inherit px-3.5 ${
              isExpanded ? 'justify-between' : 'justify-center'
            }`}>
              {isExpanded ? (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-500/30 shrink-0">
                      CSC
                    </div>
                    <div className="min-w-0">
                      <h1 className="font-extrabold text-sm tracking-tight truncate bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                        CSC Operations
                      </h1>
                      <p className="text-[10px] text-slate-400 truncate">Glass Workspace Suite</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setIsHovered(false);
                    }}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                    title="Collapse sidebar"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-indigo-500/30 hover:scale-105 transition group cursor-pointer"
                  title="Expand sidebar"
                >
                  <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>

            {/* explanation // Sidebar module selection list */}
            <div className="p-3 space-y-2">
              {isExpanded && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400/80 px-2.5 py-1">
                  Modules
                </div>
              )}

              {moduleTiles.map((tile) => {
                const Icon = tile.icon;
                const isActive = activeTab === tile.id;
                return (
                  <div
                    key={tile.id}
                    onClick={() => {
                      setActiveTab(tile.id);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`rounded-2xl border backdrop-blur-md cursor-pointer transition-all duration-200 flex items-center justify-between p-3 select-none min-h-[48px] ${
                      isActive
                        ? `${tile.activeBorder} shadow-lg ${tile.glow}`
                        : isDark
                          ? 'bg-slate-900/40 border-white/5 hover:bg-slate-800/50 hover:border-white/10 text-slate-400 hover:text-slate-100'
                          : 'bg-white/50 border-slate-200/80 hover:bg-white/80 hover:border-slate-300 text-slate-600 hover:text-slate-900'
                    }`}
                    title={!isExpanded ? tile.title : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${tile.badgeBg}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {isExpanded && (
                        <div className="min-w-0">
                          <h3 className={`text-xs font-bold truncate ${isActive ? 'text-slate-900 dark:text-white' : ''}`}>
                            {tile.title}
                          </h3>
                          <p className="text-[10px] text-slate-400 truncate">
                            {tile.subtitle}
                          </p>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border shrink-0 ml-1.5 ${tile.badgeBg}`}>
                        {tile.count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* explanation // Theme toggle button at bottom of sidebar */}
          <div className="p-3 border-t border-inherit space-y-2">
            <button
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              className={`w-full min-h-[46px] flex items-center justify-center gap-2 p-2.5 rounded-2xl text-xs font-semibold border backdrop-blur-md transition duration-200 cursor-pointer ${
                isDark 
                  ? 'bg-slate-900/40 border-white/10 hover:bg-slate-800/70 text-slate-200' 
                  : 'bg-white/60 border-slate-200 hover:bg-white/90 text-slate-800 shadow-sm'
              }`}
              title="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400 shrink-0" /> : <Moon className="w-4 h-4 text-indigo-600 shrink-0" />}
              {isExpanded && <span>{isDark ? 'Light Glass' : 'Dark Glass'}</span>}
            </button>
          </div>
        </aside>

        {/* explanation // Main application header and routing viewport */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className={`h-16 px-3.5 sm:px-6 border-b sticky top-0 z-30 flex items-center justify-between backdrop-blur-xl ${
            isDark 
              ? 'bg-slate-950/70 border-white/10' 
              : 'bg-white/70 border-slate-200/80 shadow-xs'
          }`}>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl border border-inherit text-slate-600 dark:text-slate-300 hover:bg-white/10 md:hidden cursor-pointer"
                title="Open Navigation"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div>
                <h1 className="text-xs sm:text-base font-extrabold tracking-tight truncate flex items-center gap-1.5">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                    CSC OPERATIONS
                  </span>
                  <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 font-mono">
                    LIVE
                  </span>
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Workspace: <span className="font-semibold text-indigo-600 dark:text-indigo-400 capitalize">{activeTab.replace('-', ' ')}</span>
                </p>
              </div>
            </div>

            {/* explanation // Global sheet sync button */}
            <div className="flex items-center gap-2">
              <button
                onClick={importAllSheets}
                disabled={isImportingAll}
                className="min-h-[42px] flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-90 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <DownloadCloud className={`w-3.5 h-3.5 ${isImportingAll ? 'animate-bounce' : ''}`} />
                <span className="hidden sm:inline">{isImportingAll ? 'Syncing Sheets...' : 'Sync Complete Data'}</span>
                <span className="sm:hidden">Sync</span>
              </button>

              <button
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-2xl border border-inherit text-slate-600 dark:text-slate-300 hover:bg-white/10 md:hidden cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
              </button>
            </div>
          </header>

          {/* explanation // Mobile horizontal workspace quick-selector tabs */}
          <div className="md:hidden px-3 pt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {moduleTiles.map(tile => {
              const Icon = tile.icon;
              const isActive = activeTab === tile.id;
              return (
                <button
                  key={tile.id}
                  onClick={() => setActiveTab(tile.id)}
                  className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold whitespace-nowrap backdrop-blur-md cursor-pointer transition shrink-0 ${
                    isActive 
                      ? `${tile.activeBorder} shadow-md`
                      : isDark ? 'bg-slate-900/50 border-white/10 text-slate-300' : 'bg-white/70 border-slate-200 text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tile.title}</span>
                  <span className="text-[10px] font-mono opacity-80">({tile.count})</span>
                </button>
              );
            })}
          </div>

          {/* explanation // Dynamic workspace router rendering current active tab view */}
          <main className="flex-1 p-3 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
            {importStatus && (
              <div className={`p-3.5 sm:p-4 rounded-2xl border backdrop-blur-xl flex items-center justify-between text-xs font-semibold shadow-lg transition animate-in fade-in ${
                importStatus.type === 'error'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-rose-500/10'
                  : importStatus.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-emerald-500/10'
                    : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 shadow-indigo-500/10'
              }`}>
                <div className="flex items-center gap-2.5 truncate">
                  {importStatus.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Database className="w-4 h-4 shrink-0" />}
                  <span className="truncate">{importStatus.message}</span>
                </div>
                <button onClick={() => setImportStatus(null)} className="min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer ml-2 hover:opacity-75">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {activeTab === 'operations' && (
              <ServiceOpsTab 
                isDark={isDark} 
                tasks={opsData} 
                setTasks={setOpsData} 
              />
            )}

            {activeTab === 'used' && (
              <SpareUsedTab 
                isDark={isDark} 
                items={usedData} 
                setItems={setUsedData} 
                tasks={opsData} 
              />
            )}

            {activeTab === 'approval' && (
              <SpareApprovalTab 
                isDark={isDark} 
                items={approvalData} 
                setItems={setApprovalData} 
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
// PART 5 OF 7: TAB 1 - SERVICE OPERATIONS WORKSPACE COMPONENT

/* -------------------------------------------------------------------------- */
/*                        TAB 1: SERVICE OPERATIONS TAB                       */
/* -------------------------------------------------------------------------- */

// explanation // Comprehensive workspace component for managing service requests, task status, and issue codes
function ServiceOpsTab({ isDark, tasks = [], setTasks }) {
  // explanation // Loading state for refresh button
  const [loading, setLoading] = useState(false);
  // explanation // Filter and search state hooks
  const [search, setSearch] = useState('');
  const [selectedTaskTypes, setSelectedTaskTypes] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedProblemCodes, setSelectedProblemCodes] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // explanation // Date range boundary filters
  const [fromDateStr, setFromDateStr] = useState('');
  const [toDateStr, setToDateStr] = useState('');

  // explanation // Display layout toggle ('grid' cards or 'table' rows)
  const [viewMode, setViewMode] = useState('grid');
  // explanation // Active pagination page
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // explanation // Active item opened inside detailed modal
  const [viewingTask, setViewingTask] = useState(null);

  // explanation // Refetches operations sheet directly
  const refreshOps = async () => {
    setLoading(true);
    try {
      const res = await fetchGoogleSheetData('Service Operations');
      const parsed = res.rows.map(row => {
        const raw = row.__raw || Object.values(row);

        const srNumberVal = String(raw[0] !== undefined && raw[0] !== null ? raw[0] : (row['SR Number'] || '')).trim();
        const srTypeVal = String(raw[1] !== undefined && raw[1] !== null ? raw[1] : (row['SR Type'] || '')).trim();
        const taskNoVal = String(raw[2] !== undefined && raw[2] !== null ? raw[2] : (row['Task No'] || '')).trim();
        const taskTypeVal = String(raw[3] !== undefined && raw[3] !== null ? raw[3] : (row['Task Type'] || '')).trim();
        const branchVal = String(raw[4] !== undefined && raw[4] !== null ? raw[4] : (row['Branch Name'] || '')).trim();
        const assigneeVal = String(raw[5] !== undefined && raw[5] !== null ? raw[5] : (row['Assignee'] || '')).trim();
        const taskNameVal = String(raw[7] !== undefined && raw[7] !== null ? raw[7] : (row['Task Name'] || '')).trim();
        const customerVal = String(raw[9] !== undefined && raw[9] !== null ? raw[9] : (row['Customer Name'] || '')).trim();
        const slNoVal = String(raw[10] !== undefined && raw[10] !== null ? raw[10] : (row['Sl no'] || '')).trim();
        const descriptionVal = String(raw[11] !== undefined && raw[11] !== null ? raw[11] : (row['desc'] || row['Description'] || '')).trim();

        const rawColQ = String(raw[16] !== undefined ? raw[16] : '').trim();
        const problemCodeVal = (rawColQ && rawColQ !== '-') ? rawColQ : 'Not Specified';

        const rawColT = String(raw[19] || '').trim();
        const categoryVal = parseCategoryValue(rawColT);

        const rawSrDate = raw[18] !== undefined && raw[18] !== null ? raw[18] : (row['SR Date'] || '');
        const rawTaskDate = raw[19] !== undefined && raw[19] !== null ? raw[19] : (row['Task Date'] || '');
        const srDateVal = formatDate(rawSrDate);
        const taskDateVal = formatDate(rawTaskDate);

        const taskStatusVal = String(raw[32] !== undefined && raw[32] !== null ? raw[32] : (row['Task Status'] || '')).trim();
        const srStatusVal = String(raw[33] !== undefined && raw[33] !== null ? raw[33] : (row['SR Status'] || '')).trim();

        let productVal = String(raw[35] !== undefined && raw[35] !== null ? raw[35] : (row['Product'] || '')).trim();
        let modelVal = String(raw[36] !== undefined && raw[36] !== null ? raw[36] : (row['Model'] || '')).trim();

        if (/^\d+$/.test(productVal) || productVal.length > 50) productVal = '';
        if (modelVal.toLowerCase() === customerVal.toLowerCase() || /^\d+$/.test(modelVal) || modelVal.length > 40) {
          modelVal = '';
        }

        const dateObj = parseDate(rawTaskDate || rawSrDate);

        return {
          srNumber: srNumberVal || '-',
          srType: srTypeVal || 'General',
          taskNo: taskNoVal || '-',
          taskType: taskTypeVal || 'General',
          branch: branchVal || '-',
          customer: customerVal || '-',
          slNo: slNoVal || '-',
          description: descriptionVal || '-',
          srDate: srDateVal,
          taskDate: taskDateVal,
          taskStatus: taskStatusVal || 'Pending',
          srStatus: srStatusVal || 'Pending',
          product: productVal || '-',
          model: modelVal || '-',
          problemCode: problemCodeVal,
          category: categoryVal,
          assignee: assigneeVal,
          taskName: taskNameVal || '-',
          dateObj,
          formattedDate: taskDateVal !== '-' ? taskDateVal : srDateVal
        };
      }).filter(r => r.taskNo !== '-' || r.srNumber !== '-' || r.customer !== '-');

      await setDbItem('csc_ops_data_v25', parsed);
      setTasks(parsed);
    } catch (e) {
      alert("Error refreshing Service Operations: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // explanation // Toggles selection chip for task type strip
  const handleToggleTaskType = (type) => {
    setCurrentPage(1);
    setSelectedTaskTypes(prev => {
      if (prev.includes(type)) return prev.filter(t => t !== type);
      return [...prev, type];
    });
  };

  // explanation // Distinct product names memoized for filter options
  const products = useMemo(() => {
    return Array.from(
      new Set(
        tasks.map(t => String(t.product || '').trim())
          .filter(p => p !== '' && p !== '-' && p !== 'null' && p !== 'undefined' && !/^\d+$/.test(p))
      )
    ).sort();
  }, [tasks]);

  // explanation // Distinct model names memoized for filter options
  const models = useMemo(() => {
    const customerSet = new Set(tasks.map(t => String(t.customer || '').toLowerCase().trim()));
    return Array.from(
      new Set(
        tasks.map(t => String(t.model || '').trim())
          .filter(m => (
            m !== '' && 
            m !== '-' && 
            m !== 'null' && 
            m !== 'undefined' && 
            !/^\d+$/.test(m) && 
            !customerSet.has(m.toLowerCase())
          ))
      )
    ).sort();
  }, [tasks]);

  // explanation // Distinct problem issue codes
  const problemCodes = useMemo(() => {
    return Array.from(
      new Set(
        tasks.map(t => String(t.problemCode || '').trim())
          .filter(code => code !== '' && code !== '-')
      )
    ).sort();
  }, [tasks]);

  // explanation // Unique status values
  const statuses = useMemo(() => {
    return Array.from(new Set(tasks.map(t => String(t.srStatus || t.taskStatus || '').trim()).filter(s => s !== '' && s !== '-'))).sort();
  }, [tasks]);

  // explanation // Unique branch locations
  const branches = useMemo(() => {
    return Array.from(new Set(tasks.map(t => String(t.branch || '').trim()).filter(b => b !== '' && b !== '-'))).sort();
  }, [tasks]);

  const categories = ['Warranty', 'ASC', 'NA'];

  // explanation // Aggregate count of tasks per task-type
  const taskTypeCounts = useMemo(() => {
    const counts = {};
    tasks.forEach(t => {
      const type = t.taskType || 'Unassigned';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [tasks]);

  // explanation // Comprehensive multi-variable filter applying all active criteria
  const filtered = useMemo(() => {
    const parsedFrom = fromDateStr.trim() ? parseDate(fromDateStr.trim()) : null;
    const parsedTo = toDateStr.trim() ? parseDate(toDateStr.trim()) : null;

    if (parsedTo) {
      parsedTo.setHours(23, 59, 59, 999);
    }

    return tasks.filter(t => {
      if (selectedTaskTypes.length > 0 && !selectedTaskTypes.includes(t.taskType)) return false;
      if (selectedProducts.length > 0 && !selectedProducts.includes(t.product)) return false;
      if (selectedModels.length > 0 && !selectedModels.includes(t.model)) return false;
      if (selectedProblemCodes.length > 0 && !selectedProblemCodes.includes(t.problemCode)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(t.srStatus) && !selectedStatuses.includes(t.taskStatus)) return false;
      if (selectedBranches.length > 0 && !selectedBranches.includes(t.branch)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(t.category)) return false;

      if (t.dateObj) {
        if (parsedFrom && t.dateObj < parsedFrom) return false;
        if (parsedTo && t.dateObj > parsedTo) return false;
      } else if (parsedFrom || parsedTo) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.srNumber.toLowerCase().includes(q) ||
          t.srType.toLowerCase().includes(q) ||
          t.taskNo.toLowerCase().includes(q) ||
          t.taskType.toLowerCase().includes(q) ||
          t.branch.toLowerCase().includes(q) ||
          t.customer.toLowerCase().includes(q) ||
          t.product.toLowerCase().includes(q) ||
          t.model.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.slNo.toLowerCase().includes(q) ||
          t.taskStatus.toLowerCase().includes(q) ||
          t.srStatus.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, selectedTaskTypes, selectedProducts, selectedModels, selectedProblemCodes, selectedStatuses, selectedBranches, selectedCategories, fromDateStr, toDateStr, search]);

  // explanation // Reset all active filters to default empty states
  const resetAllFilters = () => {
    setSelectedTaskTypes([]);
    setSelectedProducts([]);
    setSelectedModels([]);
    setSelectedProblemCodes([]);
    setSelectedStatuses([]);
    setSelectedBranches([]);
    setSelectedCategories([]);
    setFromDateStr('');
    setToDateStr('');
    setSearch('');
    setCurrentPage(1);
  };

  // explanation // Computes KPI summary numbers
  const metrics = useMemo(() => {
    const total = filtered.length;
    let completed = 0;
    filtered.forEach(t => {
      const s = String(t.srStatus || t.taskStatus).toLowerCase();
      if (s === 'completed' || s === 'closed' || s === 'resolved') completed++;
    });
    return {
      total,
      completed,
      pending: total - completed,
      rate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0
    };
  }, [filtered]);

  // explanation // Computes problem code breakdown for pie chart
  const { problemCodePieData, unassignedProblemCount } = useMemo(() => {
    const counts = {};
    let unassigned = 0;

    filtered.forEach(t => {
      const code = String(t.problemCode || '').trim();
      if (!code || code === '-' || code.toLowerCase() === 'not specified' || code.toLowerCase() === 'unspecified') {
        unassigned++;
      } else {
        counts[code] = (counts[code] || 0) + 1;
      }
    });

    const specifiedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top5 = specifiedEntries.slice(0, 5);
    const top5Total = top5.reduce((sum, [, count]) => sum + count, 0);

    const pieData = top5.map(([name, value]) => ({
      name,
      value,
      percent: top5Total > 0 ? ((value / top5Total) * 100).toFixed(1) : 0
    }));

    return {
      problemCodePieData: pieData,
      unassignedProblemCount: unassigned
    };
  }, [filtered]);

  // explanation // Top 5 branches by volume
  const branchChartData = useMemo(() => {
    const counts = {};
    filtered.forEach(t => { if (t.branch && t.branch !== '-') counts[t.branch] = (counts[t.branch] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, total]) => ({ name, total }));
  }, [filtered]);

  // explanation // Top 5 models by volume
  const modelChartData = useMemo(() => {
    const counts = {};
    filtered.forEach(t => { if (t.model && t.model !== '-') counts[t.model] = (counts[t.model] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, total]) => ({ name, total }));
  }, [filtered]);

  // explanation // Calculates total pagination pages
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  const isAnyFilterActive = 
    selectedTaskTypes.length > 0 || 
    selectedProducts.length > 0 || 
    selectedModels.length > 0 || 
    selectedProblemCodes.length > 0 || 
    selectedStatuses.length > 0 || 
    selectedBranches.length > 0 || 
    selectedCategories.length > 0 || 
    fromDateStr.trim() !== '' || 
    toDateStr.trim() !== '' || 
    search.trim() !== '';

  // explanation // Custom SVG renderer for centered pie slice values
  const renderPieLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = '', percent = 0 }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono text-[11px] font-bold pointer-events-none drop-shadow-md"
      >
        {value}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      {/* explanation // Title strip with refresh trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400">
              Service Operations Workspace
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live operations feed connected to Google Sheet
          </p>
        </div>

        <button
          onClick={refreshOps}
          disabled={loading}
          className="min-h-[44px] self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition active:scale-95 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* explanation // Task Type horizontal click filter tiles */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-blue-500" /> Task Type Filter Strip
            {selectedTaskTypes.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-mono border border-blue-500/30">
                {selectedTaskTypes.length} active
              </span>
            )}
          </span>
          {selectedTaskTypes.length > 0 && (
            <button
              onClick={() => { setSelectedTaskTypes([]); setCurrentPage(1); }}
              className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 overflow-x-auto pb-1.5 sm:pb-0 no-scrollbar">
          <div
            onClick={() => { setSelectedTaskTypes([]); setCurrentPage(1); }}
            className={`min-w-[125px] sm:min-w-0 p-3.5 rounded-2xl border backdrop-blur-md cursor-pointer transition flex flex-col justify-between shrink-0 shadow-sm ${
              selectedTaskTypes.length === 0
                ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-400 shadow-lg shadow-blue-500/25'
                : isDark 
                  ? 'bg-slate-900/40 border-white/10 hover:bg-slate-800/60 text-slate-300' 
                  : 'bg-white/60 border-slate-200 hover:bg-white/90 text-slate-700'
            }`}
          >
            <span className={`text-[11px] font-semibold truncate ${selectedTaskTypes.length === 0 ? 'text-white' : 'text-slate-400'}`}>
              All Types
            </span>
            <span className="text-lg font-black mt-2">
              {tasks.length}
            </span>
          </div>

          {taskTypeCounts.map(([type, count]) => {
            const isSelected = selectedTaskTypes.includes(type);
            return (
              <div
                key={type}
                onClick={() => handleToggleTaskType(type)}
                className={`min-w-[125px] sm:min-w-0 p-3.5 rounded-2xl border backdrop-blur-md cursor-pointer transition flex flex-col justify-between select-none shrink-0 shadow-sm ${
                  isSelected
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-400 shadow-lg shadow-blue-500/25'
                    : isDark 
                      ? 'bg-slate-900/40 border-white/10 hover:bg-slate-800/60 text-slate-300' 
                      : 'bg-white/60 border-slate-200 hover:bg-white/90 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[11px] font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-400'}`} title={type}>
                    {type}
                  </span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                </div>
                <span className={`text-lg font-black mt-2 ${isSelected ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* explanation // Filter dropdown controls container */}
      <div className={`relative z-40 overflow-visible p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg space-y-4 ${
        isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" /> Operational Filters
          </span>
          {isAnyFilterActive && (
            <button
              onClick={resetAllFilters}
              className="text-xs text-rose-500 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          <MultiSelectDropdown
            label="Product"
            options={products}
            selected={selectedProducts}
            onChange={(val) => { setSelectedProducts(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Products"
          />

          <MultiSelectDropdown
            label="Model"
            options={models}
            selected={selectedModels}
            onChange={(val) => { setSelectedModels(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Models"
          />

          <MultiSelectDropdown
            label="Problem"
            options={problemCodes}
            selected={selectedProblemCodes}
            onChange={(val) => { setSelectedProblemCodes(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Problems"
          />

          <MultiSelectDropdown
            label="Status"
            options={statuses}
            selected={selectedStatuses}
            onChange={(val) => { setSelectedStatuses(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Statuses"
          />

          <MultiSelectDropdown
            label="Branch"
            options={branches}
            selected={selectedBranches}
            onChange={(val) => { setSelectedBranches(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Branches"
          />

          <MultiSelectDropdown
            label="Category"
            options={categories}
            selected={selectedCategories}
            onChange={(val) => { setSelectedCategories(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Categories"
          />

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-300/80 mb-1.5 truncate">
              From Date {fromDateStr && <span className="text-blue-400 font-mono">({formatDate(fromDateStr)})</span>}
            </label>
            <input
              type="date"
              value={toISODateInput(fromDateStr)}
              onChange={(e) => {
                if (!e.target.value) {
                  setFromDateStr('');
                } else {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setFromDateStr(formatDate(new Date(y, m - 1, d)));
                }
                setCurrentPage(1);
              }}
              className={`w-full min-h-[44px] text-xs px-3.5 py-2.5 rounded-2xl border backdrop-blur-md font-mono cursor-pointer transition ${
                isDark 
                  ? 'bg-slate-900/60 border-white/10 text-slate-200 focus:border-blue-500 [color-scheme:dark]' 
                  : 'bg-white/70 border-slate-200 text-slate-800 focus:border-blue-500 shadow-xs'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-300/80 mb-1.5 truncate">
              To Date {toDateStr && <span className="text-blue-400 font-mono">({formatDate(toDateStr)})</span>}
            </label>
            <input
              type="date"
              value={toISODateInput(toDateStr)}
              onChange={(e) => {
                if (!e.target.value) {
                  setToDateStr('');
                } else {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setToDateStr(formatDate(new Date(y, m - 1, d)));
                }
                setCurrentPage(1);
              }}
              className={`w-full min-h-[44px] text-xs px-3.5 py-2.5 rounded-2xl border backdrop-blur-md font-mono cursor-pointer transition ${
                isDark 
                  ? 'bg-slate-900/60 border-white/10 text-slate-200 focus:border-blue-500 [color-scheme:dark]' 
                  : 'bg-white/70 border-slate-200 text-slate-800 focus:border-blue-500 shadow-xs'
              }`}
            />
          </div>
        </div>
      </div>

      {/* explanation // Top 4 Key Performance Indicator stat cards */}
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-blue-500/20 shadow-blue-950/20' : 'bg-white/70 border-blue-200 shadow-blue-500/5'
        }`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-blue-500">
            <span>TOTAL TASKS</span>
            <Package className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {metrics.total.toLocaleString()}
          </div>
        </div>

        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-emerald-500/20 shadow-emerald-950/20' : 'bg-white/70 border-emerald-200 shadow-emerald-500/5'
        }`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-emerald-500">
            <span>RESOLVED</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-500">
            {metrics.completed.toLocaleString()}
          </div>
        </div>

        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-amber-500/20 shadow-amber-950/20' : 'bg-white/70 border-amber-200 shadow-amber-500/5'
        }`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-amber-500">
            <span>PENDING</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-500">
            {metrics.pending.toLocaleString()}
          </div>
        </div>

        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-purple-500/20 shadow-purple-950/20' : 'bg-white/70 border-purple-200 shadow-purple-500/5'
        }`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-purple-500">
            <span>RESOLUTION RATE</span>
            <Percent className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-purple-500">
            {metrics.rate}%
          </div>
        </div>
      </div>

      {/* explanation // Charts row with Branch bar chart, Model bar chart, and Problem code pie */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Branch Chart */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Top 5 Branches</h3>
          <div style={{ width: '100%', height: 256, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={256} debounce={100}>
              <BarChart data={branchChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)', 
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '1rem'
                  }}
                />
                <Bar dataKey="total" fill="url(#blueIndigoGrad)" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="total" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                </Bar>
                <defs>
                  <linearGradient id="blueIndigoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Chart */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Top 5 Models</h3>
          <div style={{ width: '100%', height: 256, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={256} debounce={100}>
              <BarChart data={modelChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)', 
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '1rem'
                  }}
                />
                <Bar dataKey="total" fill="url(#emeraldTealGrad)" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="total" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                </Bar>
                <defs>
                  <linearGradient id="emeraldTealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#0d9488" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Problem Code Pie */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg flex flex-col justify-between min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Top 5 Problem Codes
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {selectedModels.length > 0 
                    ? `Breakdown for selected models (${selectedModels.length})` 
                    : 'Top issues across models'}
                </p>
              </div>

              {unassignedProblemCount > 0 && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                  isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  Unspecified: <strong>{unassignedProblemCount}</strong>
                </span>
              )}
            </div>
          </div>

          <div style={{ width: '100%', height: 256, minWidth: 0 }}>
            {problemCodePieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {unassignedProblemCount > 0 ? 'All tasks are unassigned' : 'No records'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={256} debounce={100}>
                <PieChart>
                  <Tooltip 
                    formatter={(val, name, item) => [`${val} tasks (${item.payload.percent}%)`, name]}
                    contentStyle={{ 
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)', 
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem'
                    }}
                  />
                  <Pie
                    data={problemCodePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={42}
                    outerRadius={80}
                    paddingAngle={4}
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {problemCodePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    formatter={(value, entry) => (
                      <span className={isDark ? "text-slate-300 text-[10px]" : "text-slate-700 text-[10px]"}>
                        {value} (<strong className="text-blue-400 font-mono">{entry.payload.value}</strong>)
                      </span>
                    )}
                    wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* explanation // Task Records table & grid layout card */}
      <div className={`relative z-10 rounded-3xl border backdrop-blur-xl shadow-xl overflow-hidden ${
        isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
      }`}>
        <div className="p-3.5 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 border-inherit">
          <div className="flex items-center flex-wrap gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search SR, Customer, Model..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className={`text-xs pl-9 pr-3.5 py-2.5 rounded-2xl border backdrop-blur-sm w-full focus:outline-hidden transition min-h-[44px] ${
                  isDark ? 'bg-slate-950/60 border-white/10 text-slate-100 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'
                }`}
              />
            </div>

            <div className={`flex items-center p-1 rounded-2xl border ${
              isDark ? 'bg-slate-950/60 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Table
              </button>
            </div>
          </div>

          <span className="text-xs text-slate-400">
            Page {currentPage} of {totalPages} ({filtered.length} entries)
          </span>
        </div>

        {viewMode === 'grid' ? (
          <div className="p-3.5 sm:p-5 max-h-[680px] overflow-y-auto">
            {paginated.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No matching records found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {paginated.map((item, idx) => {
                  const tlCode = PRESET_BU_TO_TL[item.branch] || 'YKR';
                  const isCompleted = String(item.srStatus).toLowerCase() === 'completed' || String(item.srStatus).toLowerCase() === 'closed';

                  return (
                    <div
                      key={idx}
                      onClick={() => setViewingTask(item)}
                      className={`rounded-2xl border backdrop-blur-md p-4 flex flex-col justify-between transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-xl cursor-pointer ${
                        isDark 
                          ? 'bg-slate-900/60 border-white/10 hover:border-indigo-500/50 hover:bg-slate-800/80' 
                          : 'bg-white/80 border-slate-200 hover:border-indigo-400 hover:bg-white'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                            <span className="font-bold text-sm text-indigo-400 font-mono">
                              {item.srNumber || '000000'}
                            </span>
                            {item.product && item.product !== '-' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                {item.product}
                              </span>
                            )}
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${
                            isCompleted
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}>
                            {item.srStatus || 'Pending'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 leading-relaxed space-y-1">
                          <div className="truncate">
                            SR Date: <span className="font-semibold text-slate-200 font-mono">{formatDate(item.srDate)}</span>
                          </div>
                          <div className="truncate">
                            Task No: <span className="font-mono font-semibold text-amber-300">{item.taskNo || '-'}</span>
                          </div>
                          <div className="truncate">
                            Task Date: <span className="font-semibold text-amber-300 font-mono">{formatDate(item.taskDate)}</span>
                          </div>
                          <div className="flex items-center gap-1 font-medium">
                            <span>Task Status:</span>
                            <span className="font-semibold text-blue-400">{item.taskStatus || 'Pending'}</span>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-xs uppercase text-slate-100 truncate" title={item.customer}>
                            {item.customer || 'Unnamed Customer'}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 truncate">
                            <span className="font-semibold text-slate-300 truncate">{item.branch || '-'}</span>
                            <span>•</span>
                            <span>TL: {tlCode}</span>
                            <span>•</span>
                            <span className="font-semibold text-teal-400">{item.category}</span>
                          </div>
                        </div>

                        <div className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                          isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-slate-400 text-[11px]">Model:</span>
                            <span className="font-bold uppercase tracking-tight text-right truncate text-emerald-400">
                              {item.model || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-slate-400 text-[11px] shrink-0">Sl No:</span>
                            <span className="font-mono font-semibold text-right truncate text-slate-300 text-[11px]">
                              {item.slNo}
                            </span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-slate-400 text-[11px] shrink-0">Desc:</span>
                            <span className="font-medium text-right truncate text-slate-400 text-[11px] max-w-[130px]" title={item.description}>
                              {item.description}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-inherit flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-[10px] uppercase text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/30">
                            {item.srType}
                          </span>
                          <span className="font-bold text-[10px] uppercase text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                            {item.taskType}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className={`uppercase text-[10px] tracking-wider border-b border-inherit sticky top-0 backdrop-blur-md ${
                isDark ? 'bg-slate-900/90 text-slate-200' : 'bg-slate-100 text-slate-700 font-bold'
              }`}>
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap">SR Number</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">SR Date</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">SR Type</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task Date</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task Type</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Branch Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Customer Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Product</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Model</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Sl No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Description</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task Status</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">SR Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-12 text-slate-400">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((row, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setViewingTask(row)}
                      className="hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-indigo-400 whitespace-nowrap">
                        {row.srNumber}
                      </td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-slate-300">
                        {formatDate(row.srDate)}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {row.srType}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-amber-200 whitespace-nowrap">
                        {row.taskNo}
                      </td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-amber-300">
                        {formatDate(row.taskDate)}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {row.taskType}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-200">
                        {row.branch}
                      </td>
                      <td className="py-3 px-3.5 text-slate-200 truncate max-w-[150px] font-medium" title={row.customer}>
                        {row.customer}
                      </td>
                      <td className="py-3 px-3.5 text-slate-300 whitespace-nowrap">
                        {row.product}
                      </td>
                      <td className="py-3 px-3.5 text-emerald-400 font-semibold whitespace-nowrap">
                        {row.model}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                        {row.slNo}
                      </td>
                      <td className="py-3 px-3.5 text-slate-400 truncate max-w-[150px]" title={row.description}>
                        {row.description}
                      </td>
                      <td className="py-3 px-3.5 text-amber-300 font-medium whitespace-nowrap">
                        {row.taskStatus}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          String(row.srStatus).toLowerCase() === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {row.srStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* explanation // Pagination footer controls */}
        <div className="p-3.5 border-t border-inherit flex items-center justify-between text-xs text-slate-400">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-medium transition"
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-medium transition"
          >
            Next
          </button>
        </div>
      </div>

      {/* explanation // Detail inspect popup modal for individual tasks */}
      {viewingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className={`w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border backdrop-blur-2xl shadow-2xl ${
            isDark ? 'bg-slate-950/90 border-white/15 text-slate-100 shadow-indigo-950/50' : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50'
          }`}>
            <div className="p-4 sm:p-5 border-b flex items-center justify-between border-inherit">
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-mono font-bold text-indigo-400 text-base">SR: {viewingTask.srNumber}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-bold uppercase">{viewingTask.srType}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase">{viewingTask.taskType}</span>
              </div>
              <button onClick={() => setViewingTask(null)} className="min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 text-xs overscroll-contain">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block mb-0.5">Customer Name</span>
                  <strong className="text-sm block text-slate-100">{viewingTask.customer}</strong>
                </div>
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block mb-0.5">Model</span>
                  <strong className="text-sm block text-emerald-400">{viewingTask.model}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">Task No</span>
                  <strong className="font-mono text-amber-300">{viewingTask.taskNo}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">Sl No</span>
                  <strong className="font-mono text-slate-200">{viewingTask.slNo}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block">Branch</span>
                  <strong className="text-white">{viewingTask.branch}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">SR Date</span>
                  <strong className="font-mono text-blue-400">{formatDate(viewingTask.srDate)}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">Task Date</span>
                  <strong className="font-mono text-amber-300">{formatDate(viewingTask.taskDate)}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block">Product</span>
                  <strong className="text-white">{viewingTask.product}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">Task Status</span>
                  <strong className="text-amber-400">{viewingTask.taskStatus}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">SR Status</span>
                  <strong className="text-blue-400">{viewingTask.srStatus}</strong>
                </div>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                <span className="text-slate-400 block">Description:</span>
                <p className="text-slate-200">{viewingTask.description}</p>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                <span className="text-slate-400 block">Problem Code:</span>
                <p className="font-mono text-indigo-400 font-bold">{viewingTask.problemCode}</p>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end border-inherit">
              <button
                onClick={() => setViewingTask(null)}
                className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 text-xs font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white cursor-pointer hover:opacity-90 shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// PART 6 OF 7: TAB 2 - SPARE USED CONSUMPTION & ANALYTICS COMPONENT

/* -------------------------------------------------------------------------- */
/*                            TAB 2: SPARE USED TAB                           */
/* -------------------------------------------------------------------------- */

// explanation // Comprehensive workspace component for spare parts consumption metrics and model drilldowns
function SpareUsedTab({ isDark, items = [], setItems, tasks = [] }) {
  // explanation // Dynamically captured column headers from Google Sheet
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [viewMode, setViewMode] = useState('grid');
  const safeItems = Array.isArray(items) ? items : [];

  // explanation // Operational filter states
  const [selectedTaskTypes, setSelectedTaskTypes] = useState([]);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [fromDateStr, setFromDateStr] = useState('');
  const [toDateStr, setToDateStr] = useState('');

  // explanation // Dedicated states for interactive drilldown charts
  const [modelChartSelectedModels, setModelChartSelectedModels] = useState([]);
  const [sparesInModelSelectedModel, setSparesInModelSelectedModel] = useState('');
  const [sparesInModelLimit, setSparesInModelLimit] = useState(5);

  // explanation // Selected spare row opened inside detail view modal
  const [viewingSpare, setViewingSpare] = useState(null);

  // explanation // Retrieve cached column headers on mount
  useEffect(() => {
    let isMounted = true;
    async function loadHeaders() {
      try {
        const h = await getDbItem('csc_used_headers_v25');
        if (isMounted && h && Array.isArray(h)) setHeaders(h);
      } catch (err) {
        console.warn("Could not load cached headers:", err);
      }
    }
    loadHeaders();
    return () => { isMounted = false; };
  }, []);

  // explanation // Refetch Spare Used sheet on demand
  const refreshUsed = async () => {
    setLoading(true);
    try {
      const res = await fetchGoogleSheetData('Spare Used');
      await setDbItem('csc_used_data_v25', res.rows);
      await setDbItem('csc_used_headers_v25', res.cols);
      if (setItems) setItems(res.rows);
      setHeaders(res.cols);
    } catch (e) {
      alert("Error refreshing Spare Used: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // explanation // Normalize all raw spare rows into uniform object schema
  const normalizedData = useMemo(() => {
    const list = new Array(safeItems.length);

    for (let i = 0; i < safeItems.length; i++) {
      const r = safeItems[i];
      const raw = r.__raw || [];

      const taskNo = String(raw[0] !== undefined && raw[0] !== null ? raw[0] : (r['Task No'] || r['Task No.'] || '')).trim() || '-';
      const rawDate = raw[1] !== undefined && raw[1] !== null ? raw[1] : (r['Date'] || r['Task Date'] || '');
      const dateObj = rawDate ? parseDate(rawDate) : null;
      const formattedDate = dateObj ? formatDate(dateObj) : (rawDate ? String(rawDate).trim() : '-');

      const taskType = String(raw[2] !== undefined && raw[2] !== null ? raw[2] : (r['Task Type'] || '')).trim() || '-';
      const branch = String(raw[3] !== undefined && raw[3] !== null ? raw[3] : (r['Branch'] || r['Branch Name'] || '')).trim() || '-';
      const partDesc = String(raw[7] !== undefined && raw[7] !== null ? raw[7] : (r['Part Description'] || r['Part Decription'] || '')).trim() || '-';
      const locationCode = String(raw[8] !== undefined && raw[8] !== null ? raw[8] : (r['Quantity'] || r['Qty'] || '')).trim() || '-';
      const status = String(raw[10] !== undefined && raw[10] !== null ? raw[10] : (r['Status'] || r['Product Status'] || '')).trim() || '-';
      const category = String(raw[13] !== undefined && raw[13] !== null ? raw[13] : (r['Category'] || r['Product Category'] || '')).trim() || '-';
      const slNo = String(raw[14] !== undefined && raw[14] !== null ? raw[14] : (r['Sl No'] || r['Sl no'] || '')).trim() || '-';
      const description = String(raw[15] !== undefined && raw[15] !== null ? raw[15] : (r['Description'] || r['desc'] || '')).trim() || '-';

      let rawColS = raw[18] !== undefined && raw[18] !== null ? raw[18] : (r['Part Code'] || r['Part No'] || '');
      let partCode = '';
      if (typeof rawColS === 'object' && rawColS !== null) {
        partCode = String(rawColS.v || rawColS.f || '').trim();
      } else {
        partCode = String(rawColS).trim();
      }
      partCode = partCode && partCode !== '-' && partCode.toLowerCase() !== 'null' ? partCode : '-';

      const model = String(raw[22] !== undefined && raw[22] !== null ? raw[22] : (r['Model'] || r['Model Name'] || '')).trim() || '-';
      const product = String(raw[35] !== undefined && raw[35] !== null ? raw[35] : (r['Product'] || r['Product Name'] || '')).trim() || '-';

      list[i] = {
        rawItem: r,
        taskNo,
        dateObj,
        formattedDate,
        taskType,
        branch,
        partDesc,
        locationCode,
        status,
        category,
        slNo,
        description,
        partCode,
        model,
        product
      };
    }

    return list;
  }, [safeItems]);

  // explanation // Extract distinct filter choices from normalized data
  const { filterOptions, taskTypeCounts } = useMemo(() => {
    const branches = new Set();
    const statuses = new Set();
    const categories = new Set();
    const models = new Set();
    const products = new Set();
    const taskTypeMap = {};

    for (let i = 0; i < normalizedData.length; i++) {
      const row = normalizedData[i];
      if (row.branch !== '-') branches.add(row.branch);
      if (row.status !== '-') statuses.add(row.status);
      if (row.category !== '-') categories.add(row.category);
      if (row.model !== '-') models.add(row.model);
      if (row.product !== '-') products.add(row.product);

      if (row.taskType !== '-') {
        taskTypeMap[row.taskType] = (taskTypeMap[row.taskType] || 0) + 1;
      }
    }

    return {
      filterOptions: {
        branches: Array.from(branches).sort(),
        statuses: Array.from(statuses).sort(),
        categories: Array.from(categories).sort(),
        models: Array.from(models).sort(),
        products: Array.from(products).sort()
      },
      taskTypeCounts: Object.entries(taskTypeMap).sort((a, b) => b[1] - a[1])
    };
  }, [normalizedData]);

  // explanation // Human readable date range header string
  const dateRangeLabel = useMemo(() => {
    if (fromDateStr && toDateStr) return `${formatDate(fromDateStr)} to ${formatDate(toDateStr)}`;
    if (fromDateStr) return `From ${formatDate(fromDateStr)}`;
    if (toDateStr) return `Up to ${formatDate(toDateStr)}`;
    return 'All Dates';
  }, [fromDateStr, toDateStr]);

  // explanation // Sub-filter restricted solely by date range for charts
  const dateFilteredItems = useMemo(() => {
    const from = fromDateStr.trim() ? parseDate(fromDateStr.trim()) : null;
    const to = toDateStr.trim() ? parseDate(toDateStr.trim()) : null;
    if (to) to.setHours(23, 59, 59, 999);

    if (!from && !to) return normalizedData;

    return normalizedData.filter(r => {
      if (!r.dateObj) return false;
      if (from && r.dateObj < from) return false;
      if (to && r.dateObj > to) return false;
      return true;
    });
  }, [normalizedData, fromDateStr, toDateStr]);

  // explanation // Complete multi-variable filter applying all active criteria and text search
  const mainFilteredItems = useMemo(() => {
    const from = fromDateStr.trim() ? parseDate(fromDateStr.trim()) : null;
    const to = toDateStr.trim() ? parseDate(toDateStr.trim()) : null;
    if (to) to.setHours(23, 59, 59, 999);

    const q = search.trim().toLowerCase();
    const hasTaskType = selectedTaskTypes.length > 0;
    const hasBranch = selectedBranches.length > 0;
    const hasStatus = selectedStatuses.length > 0;
    const hasCat = selectedCategories.length > 0;
    const hasModel = selectedModels.length > 0;
    const hasProd = selectedProducts.length > 0;

    return normalizedData.filter(r => {
      if (hasTaskType && !selectedTaskTypes.includes(r.taskType)) return false;
      if (hasBranch && !selectedBranches.includes(r.branch)) return false;
      if (hasStatus && !selectedStatuses.includes(r.status)) return false;
      if (hasCat && !selectedCategories.includes(r.category)) return false;
      if (hasModel && !selectedModels.includes(r.model)) return false;
      if (hasProd && !selectedProducts.includes(r.product)) return false;

      if (r.dateObj) {
        if (from && r.dateObj < from) return false;
        if (to && r.dateObj > to) return false;
      } else if (from || to) {
        return false;
      }

      if (q) {
        return (
          r.taskNo.toLowerCase().includes(q) ||
          r.partCode.toLowerCase().includes(q) ||
          r.partDesc.toLowerCase().includes(q) ||
          r.slNo.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.locationCode.toLowerCase().includes(q) ||
          r.model.toLowerCase().includes(q) ||
          r.branch.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [
    normalizedData, selectedTaskTypes, selectedBranches, selectedStatuses,
    selectedCategories, selectedModels, selectedProducts, fromDateStr, toDateStr, search
  ]);

  // explanation // High-level operational metrics & rankings
  const operationalMetrics = useMemo(() => {
    const partMap = new Map();
    const productCounts = {};
    const modelCounts = {};
    const branchModelCounts = {};

    for (let i = 0; i < mainFilteredItems.length; i++) {
      const r = mainFilteredItems[i];

      const partKey = `${r.partCode}:::${r.partDesc}`;
      if (!partMap.has(partKey)) {
        partMap.set(partKey, { partDesc: r.partDesc, partCode: r.partCode, usageCount: 0 });
      }
      partMap.get(partKey).usageCount += 1;

      if (r.product !== '-') {
        productCounts[r.product] = (productCounts[r.product] || 0) + 1;
      }

      if (r.model !== '-') {
        modelCounts[r.model] = (modelCounts[r.model] || 0) + 1;
      }

      if (r.branch !== '-' && r.model !== '-') {
        const bmKey = `${r.branch}:::${r.model}`;
        branchModelCounts[bmKey] = (branchModelCounts[bmKey] || 0) + 1;
      }
    }

    const sortedParts = Array.from(partMap.values()).sort((a, b) => b.usageCount - a.usageCount);
    const sortedProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]);
    const sortedModels = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);

    const sortedBranchModels = Object.entries(branchModelCounts).sort((a, b) => b[1] - a[1]);
    let topBranchModelPair = null;
    if (sortedBranchModels.length > 0) {
      const [bmKey, count] = sortedBranchModels[0];
      const [branchName, modelName] = bmKey.split(':::');
      topBranchModelPair = { branch: branchName, model: modelName, count };
    }

    const top5PartsChartData = sortedParts.slice(0, 5).map(item => ({
      name: item.partDesc.length > 13 ? `${item.partDesc.substring(0, 11)}...` : item.partDesc,
      fullName: item.partDesc,
      partCode: item.partCode,
      quantity: item.usageCount
    }));

    const totalProdCount = sortedProducts.reduce((sum, [, count]) => sum + count, 0);
    const productWiseChartData = sortedProducts.slice(0, 5).map(([name, count]) => ({
      name,
      value: count,
      percent: totalProdCount > 0 ? ((count / totalProdCount) * 100).toFixed(1) : 0
    }));

    return {
      top5PartsChartData,
      productWiseChartData,
      uniquePartsCount: sortedParts.length,
      mostUsedPart: sortedParts[0] || null,
      mostUsedModel: sortedModels[0] || null,
      topBranchModelPair
    };
  }, [mainFilteredItems]);

  // explanation // Computes model breakdown based on date filtered items
  const modelWiseChartData = useMemo(() => {
    const modelCounts = {};

    for (let i = 0; i < dateFilteredItems.length; i++) {
      const r = dateFilteredItems[i];
      if (r.model !== '-') {
        modelCounts[r.model] = (modelCounts[r.model] || 0) + 1;
      }
    }

    const sortedModels = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
    let finalModels = sortedModels;

    if (modelChartSelectedModels.length > 0) {
      finalModels = sortedModels.filter(([m]) => modelChartSelectedModels.includes(m));
    } else {
      finalModels = sortedModels.slice(0, 5);
    }

    return finalModels.map(([name, count]) => ({
      name: name.length > 13 ? `${name.substring(0, 11)}...` : name,
      fullName: name,
      quantity: count
    }));
  }, [dateFilteredItems, modelChartSelectedModels]);

  // explanation // Drilldown breakdown of specific parts inside selected equipment model
  const sparesInModelData = useMemo(() => {
    const targetModel = sparesInModelSelectedModel || filterOptions.models[0] || '';
    if (!targetModel) return { targetModel: '', chartData: [], totalCount: 0 };

    const partMap = new Map();
    const tLower = targetModel.toLowerCase();

    for (let i = 0; i < dateFilteredItems.length; i++) {
      const r = dateFilteredItems[i];
      if (r.model.toLowerCase() === tLower) {
        const partKey = `${r.partCode}:::${r.partDesc}`;
        if (!partMap.has(partKey)) {
          partMap.set(partKey, { partDesc: r.partDesc, partCode: r.partCode, count: 0 });
        }
        partMap.get(partKey).count += 1;
      }
    }

    const sortedParts = Array.from(partMap.values()).sort((a, b) => b.count - a.count);
    const limitNum = sparesInModelLimit === 'ALL' ? sortedParts.length : Number(sparesInModelLimit);
    const chartData = sortedParts.slice(0, limitNum).map(item => ({
      name: item.partDesc.length > 13 ? `${item.partDesc.substring(0, 11)}...` : item.partDesc,
      fullName: item.partDesc,
      partCode: item.partCode,
      quantity: item.count
    }));

    return {
      targetModel,
      chartData,
      totalCount: sortedParts.length
    };
  }, [dateFilteredItems, sparesInModelSelectedModel, sparesInModelLimit, filterOptions.models]);

  // explanation // Clears all active filters in the Spare Used tab
  const resetAllOperationalFilters = () => {
    setSelectedTaskTypes([]);
    setSelectedBranches([]);
    setSelectedStatuses([]);
    setSelectedCategories([]);
    setSelectedModels([]);
    setSelectedProducts([]);
    setFromDateStr('');
    setToDateStr('');
    setSearch('');
    setCurrentPage(1);
  };

  const isAnyFilterActive = 
    selectedTaskTypes.length > 0 ||
    selectedBranches.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedCategories.length > 0 ||
    selectedModels.length > 0 ||
    selectedProducts.length > 0 ||
    fromDateStr.trim() !== '' ||
    toDateStr.trim() !== '' ||
    search.trim() !== '';

  const totalPages = Math.max(1, Math.ceil(mainFilteredItems.length / pageSize));
  const paginated = useMemo(() => {
    return mainFilteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [mainFilteredItems, currentPage, pageSize]);

  const renderPieLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = '', percent = 0 }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono text-[11px] font-bold pointer-events-none drop-shadow-md"
      >
        {value}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
              Spare Parts Consumption & Analytics
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live consumption metrics from sheet "Spare Used"
          </p>
        </div>

        <button
          onClick={refreshUsed}
          disabled={loading}
          className="min-h-[44px] self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white text-xs font-semibold shadow-lg shadow-emerald-500/25 transition active:scale-95 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* TASK TYPE SUB-TILES STRIP */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-500" /> Task Type Sub-Tiles
            {selectedTaskTypes.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                {selectedTaskTypes.length} active
              </span>
            )}
          </span>
          {selectedTaskTypes.length > 0 && (
            <button
              onClick={() => { setSelectedTaskTypes([]); setCurrentPage(1); }}
              className="text-xs text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 overflow-x-auto pb-1.5 sm:pb-0 no-scrollbar">
          <div
            onClick={() => { setSelectedTaskTypes([]); setCurrentPage(1); }}
            className={`min-w-[125px] sm:min-w-0 p-3.5 rounded-2xl border backdrop-blur-md cursor-pointer transition flex flex-col justify-between shrink-0 shadow-sm ${
              selectedTaskTypes.length === 0
                ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-lg shadow-emerald-500/25'
                : isDark 
                  ? 'bg-slate-900/40 border-white/10 hover:bg-slate-800/60 text-slate-300' 
                  : 'bg-white/60 border-slate-200 hover:bg-white/90 text-slate-700'
            }`}
          >
            <span className={`text-[11px] font-semibold truncate ${selectedTaskTypes.length === 0 ? 'text-white' : 'text-slate-400'}`}>
              All Types
            </span>
            <span className="text-lg font-black mt-2">
              {normalizedData.length}
            </span>
          </div>

          {taskTypeCounts.map(([type, count]) => {
            const isSelected = selectedTaskTypes.includes(type);
            return (
              <div
                key={type}
                onClick={() => {
                  setSelectedTaskTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
                  setCurrentPage(1);
                }}
                className={`min-w-[125px] sm:min-w-0 p-3.5 rounded-2xl border backdrop-blur-md cursor-pointer transition flex flex-col justify-between select-none shrink-0 shadow-sm ${
                  isSelected
                    ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-lg shadow-emerald-500/25'
                    : isDark 
                      ? 'bg-slate-900/40 border-white/10 hover:bg-slate-800/60 text-slate-300' 
                      : 'bg-white/60 border-slate-200 hover:bg-white/90 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[11px] font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-400'}`} title={type}>
                    {type}
                  </span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                </div>
                <span className={`text-lg font-black mt-2 ${isSelected ? 'text-white' : 'text-emerald-500 dark:text-emerald-400'}`}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* OPERATIONAL FILTERS */}
      <div className={`relative z-30 p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg space-y-4 overflow-visible ${
        isDark ? 'bg-slate-900/50 border-white/10 shadow-emerald-950/20' : 'bg-white/70 border-slate-200/90 shadow-slate-200/50'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" /> Operational Filters
          </span>
          {isAnyFilterActive && (
            <button
              onClick={resetAllOperationalFilters}
              className="text-xs text-rose-500 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <MultiSelectDropdown
            label="Branch"
            options={filterOptions.branches}
            selected={selectedBranches}
            onChange={(val) => { setSelectedBranches(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Branches"
          />

          <MultiSelectDropdown
            label="Status"
            options={filterOptions.statuses}
            selected={selectedStatuses}
            onChange={(val) => { setSelectedStatuses(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Statuses"
          />

          <MultiSelectDropdown
            label="Category"
            options={filterOptions.categories}
            selected={selectedCategories}
            onChange={(val) => { setSelectedCategories(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Categories"
          />

          <MultiSelectDropdown
            label="Model"
            options={filterOptions.models}
            selected={selectedModels}
            onChange={(val) => { setSelectedModels(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Models"
          />

          <MultiSelectDropdown
            label="Product"
            options={filterOptions.products}
            selected={selectedProducts}
            onChange={(val) => { setSelectedProducts(val); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Products"
          />

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-300/80 mb-1.5 truncate">
              From Date
            </label>
            <input
              type="date"
              value={toISODateInput(fromDateStr)}
              onChange={(e) => {
                if (!e.target.value) setFromDateStr('');
                else {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setFromDateStr(formatDate(new Date(y, m - 1, d)));
                }
                setCurrentPage(1);
              }}
              className={`w-full min-h-[44px] text-xs px-3.5 py-2.5 rounded-2xl border backdrop-blur-md font-mono cursor-pointer transition ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-200 focus:border-emerald-500 [color-scheme:dark]' : 'bg-white/70 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-300/80 mb-1.5 truncate">
              To Date
            </label>
            <input
              type="date"
              value={toISODateInput(toDateStr)}
              onChange={(e) => {
                if (!e.target.value) setToDateStr('');
                else {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setToDateStr(formatDate(new Date(y, m - 1, d)));
                }
                setCurrentPage(1);
              }}
              className={`w-full min-h-[44px] text-xs px-3.5 py-2.5 rounded-2xl border backdrop-blur-md font-mono cursor-pointer transition ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-200 focus:border-emerald-500 [color-scheme:dark]' : 'bg-white/70 border-slate-200 text-slate-800'
              }`}
            />
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-emerald-500/20' : 'bg-white/70 border-emerald-200'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-emerald-500">
            <span>CONSUMED ROWS</span>
            <Layers className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            {mainFilteredItems.length.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            {mainFilteredItems.length !== normalizedData.length ? `${mainFilteredItems.length} filtered` : 'All logged spare rows'}
          </div>
        </div>

        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-blue-500/20' : 'bg-white/70 border-blue-200'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-blue-500">
            <span>UNIQUE SPARES</span>
            <Wrench className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-blue-500">
            {operationalMetrics.uniquePartsCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            Distinct parts consumed
          </div>
        </div>

        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-amber-500/20' : 'bg-white/70 border-amber-200'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-amber-500">
            <span>TOP SPARE & MODEL</span>
            <Tag className="w-4 h-4" />
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate" title={operationalMetrics.mostUsedPart?.partDesc}>
              {operationalMetrics.mostUsedPart?.partDesc || 'N/A'}
              <span className="text-[10px] text-blue-400 font-mono font-semibold ml-1">
                ({operationalMetrics.mostUsedPart?.usageCount || 0}u)
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate flex items-center justify-between">
              <span>Top Model:</span>
              <strong className="text-emerald-400 truncate max-w-[120px]">
                {operationalMetrics.mostUsedModel?.[0] || 'N/A'} ({operationalMetrics.mostUsedModel?.[1] || 0}u)
              </strong>
            </div>
          </div>
        </div>

        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-purple-500/20' : 'bg-white/70 border-purple-200'
        }`}>
          <div className="flex justify-between items-center text-xs font-bold text-purple-500">
            <span>BRANCH TRANSACTIONS</span>
            <Package className="w-4 h-4" />
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {operationalMetrics.topBranchModelPair ? operationalMetrics.topBranchModelPair.branch : 'No Data'}
              {operationalMetrics.topBranchModelPair && (
                <span className="text-[10px] text-purple-400 font-mono font-semibold ml-1">
                  ({operationalMetrics.topBranchModelPair.count} txns)
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 truncate flex items-center justify-between">
              <span>Top Model:</span>
              <strong className="text-emerald-400 truncate max-w-[120px]">
                {operationalMetrics.topBranchModelPair ? operationalMetrics.topBranchModelPair.model : 'N/A'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 1 */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 Spares Used */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-blue-500" /> Top 5 Spares Used
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Date: <strong className="text-blue-400 font-mono">{dateRangeLabel}</strong>
              </p>
            </div>
          </div>

          <div style={{ width: '100%', height: 260, minWidth: 0 }}>
            {operationalMetrics.top5PartsChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No spare records in range</div>
            ) : (
              <ResponsiveContainer width="100%" height={260} debounce={100}>
                <BarChart data={operationalMetrics.top5PartsChartData} margin={{ top: 16, right: 12, left: -20, bottom: 26 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis 
                    dataKey="name" 
                    stroke={isDark ? "#94a3b8" : "#64748b"} 
                    interval={0}
                    tick={(props) => {
                      const item = operationalMetrics.top5PartsChartData[props?.payload?.index] || {};
                      return (
                        <g transform={`translate(${props.x},${props.y})`}>
                          <text x={0} y={0} dy={12} textAnchor="middle" fill={isDark ? "#cbd5e1" : "#475569"} fontSize={10} fontWeight={600}>
                            {item.name || ''}
                          </text>
                          {item.partCode && item.partCode !== '-' && (
                            <text x={0} y={0} dy={24} textAnchor="middle" fill={isDark ? "#94a3b8" : "#64748b"} fontSize={9} fontFamily="monospace">
                              [{item.partCode}]
                            </text>
                          )}
                        </g>
                      );
                    }}
                  />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [
                      `${val} units consumed`,
                      item?.payload ? `${item.payload.fullName} ${item.payload.partCode !== '-' ? `[${item.payload.partCode}]` : ''}` : ''
                    ]}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="quantity" fill="#38bdf8" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Product Wise Spare Used */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-purple-500" /> Product Wise Spare Used
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Date: <strong className="text-purple-400 font-mono">{dateRangeLabel}</strong>
              </p>
            </div>
          </div>

          <div style={{ width: '100%', height: 260, minWidth: 0 }}>
            {operationalMetrics.productWiseChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No records in range</div>
            ) : (
              <ResponsiveContainer width="100%" height={260} debounce={100}>
                <PieChart>
                  <Tooltip
                    formatter={(val, name, item) => [`${val} parts (${item?.payload?.percent || 0}%)`, name]}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Pie
                    data={operationalMetrics.productWiseChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={44}
                    outerRadius={82}
                    paddingAngle={4}
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {operationalMetrics.productWiseChartData.map((entry, index) => (
                      <Cell key={`pie-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    formatter={(value, entry) => (
                      <span className={isDark ? 'text-slate-300 text-[10px]' : 'text-slate-700 text-[10px]'}>
                        {value} (<strong className="font-mono text-indigo-400">{entry?.payload?.value || 0}</strong>)
                      </span>
                    )}
                    wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Model Wise Spare Used */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-500" /> Model Wise Spare Used
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Date: <strong className="text-emerald-400 font-mono">{dateRangeLabel}</strong>
              </p>
            </div>

            <div className="w-full sm:w-56">
              <MultiSelectDropdown
                label=""
                options={filterOptions.models}
                selected={modelChartSelectedModels}
                onChange={(vals) => setModelChartSelectedModels(vals)}
                isDark={isDark}
                placeholder="Select Models (Top 5)"
              />
            </div>
          </div>

          <div style={{ width: '100%', height: 260, minWidth: 0 }}>
            {modelWiseChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No records in range</div>
            ) : (
              <ResponsiveContainer width="100%" height={260} debounce={100}>
                <BarChart
                  data={modelWiseChartData}
                  margin={{ top: 16, right: 10, left: -22, bottom: 22 }}
                  onClick={(state) => {
                    if (state?.activePayload?.[0]?.payload) {
                      setSparesInModelSelectedModel(state.activePayload[0].payload.fullName);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis 
                    dataKey="name" 
                    stroke={isDark ? "#94a3b8" : "#64748b"} 
                    interval={0}
                    tick={({ x = 0, y = 0, payload = {} }) => (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={0} dy={12} textAnchor="middle" fill={isDark ? "#cbd5e1" : "#475569"} fontSize={10} fontWeight={600}>
                          {payload.value || ''}
                        </text>
                      </g>
                    )}
                  />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [`${val} spares (Click to inspect)`, item?.payload?.fullName || '']}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="quantity" fill="#34d399" radius={[6, 6, 0, 0]} className="cursor-pointer">
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Spares in Model (Drilldown) */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="truncate">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 truncate">
                <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">
                  Spares in: <strong className="text-cyan-400 font-bold">{sparesInModelData.targetModel || 'Select Model'}</strong>
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                Date: <strong className="text-cyan-400 font-mono">{dateRangeLabel}</strong>
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2 shrink-0">
              <div className={`flex items-center p-1 rounded-2xl border text-[11px] font-semibold ${
                isDark ? 'bg-slate-950/60 border-white/10' : 'bg-slate-100 border-slate-200'
              }`}>
                {[5, 10, 'ALL'].map((lim) => (
                  <button
                    key={lim}
                    type="button"
                    onClick={() => setSparesInModelLimit(lim)}
                    className={`min-h-[34px] px-2.5 py-1 rounded-xl transition cursor-pointer ${
                      sparesInModelLimit === lim
                        ? 'bg-cyan-500 text-white shadow-sm font-bold'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lim === 'ALL' ? 'All' : `Top ${lim}`}
                  </button>
                ))}
              </div>

              <select
                value={sparesInModelSelectedModel || sparesInModelData.targetModel || ''}
                onChange={(e) => setSparesInModelSelectedModel(e.target.value)}
                className={`min-h-[44px] text-xs px-3 py-1.5 rounded-2xl border backdrop-blur-md font-medium cursor-pointer transition ${
                  sparesInModelSelectedModel
                    ? 'border-cyan-400/80 bg-cyan-500/15 text-cyan-300 font-bold'
                    : isDark ? 'bg-slate-900/60 border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <option value="" disabled>Select Model</option>
                {filterOptions.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ width: '100%', height: 260, minWidth: 0 }}>
            {sparesInModelData.chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {sparesInModelData.targetModel ? `No spares recorded for model "${sparesInModelData.targetModel}"` : 'Select a model'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260} debounce={100}>
                <BarChart data={sparesInModelData.chartData} margin={{ top: 16, right: 10, left: -20, bottom: 26 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis 
                    dataKey="name" 
                    stroke={isDark ? "#94a3b8" : "#64748b"} 
                    interval={0}
                    tick={({ x = 0, y = 0, payload = {} }) => {
                      const item = sparesInModelData.chartData[payload.index] || {};
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={12} textAnchor="middle" fill={isDark ? "#cbd5e1" : "#475569"} fontSize={10} fontWeight={600}>
                            {item.name || ''}
                          </text>
                          {item.partCode && item.partCode !== '-' && (
                            <text x={0} y={0} dy={24} textAnchor="middle" fill={isDark ? "#94a3b8" : "#64748b"} fontSize={9} fontFamily="monospace">
                              [{item.partCode}]
                            </text>
                          )}
                        </g>
                      );
                    }}
                  />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [
                      `${val} units consumed`,
                      item?.payload ? `${item.payload.fullName} ${item.payload.partCode !== '-' ? `[${item.payload.partCode}]` : ''}` : ''
                    ]}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="quantity" fill="#22d3ee" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* RECORDS WORKSPACE: GLASS CARDS & TABLE */}
      <div className={`relative z-10 rounded-3xl border backdrop-blur-xl shadow-xl overflow-hidden ${
        isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
      }`}>
        <div className="p-3.5 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 border-inherit">
          <div className="flex items-center flex-wrap gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search part, code, sl no, desc..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className={`text-xs pl-9 pr-3.5 py-2.5 rounded-2xl border backdrop-blur-sm w-full focus:outline-hidden transition min-h-[44px] ${
                  isDark ? 'bg-slate-950/60 border-white/10 text-slate-100 focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>

            <div className={`flex items-center p-1 rounded-2xl border ${
              isDark ? 'bg-slate-950/60 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Table
              </button>
            </div>
          </div>

          <span className="text-xs text-slate-400">
            Page {currentPage} of {totalPages} ({mainFilteredItems.length} records)
          </span>
        </div>

        {viewMode === 'grid' ? (
          <div className="p-3.5 sm:p-5 max-h-[680px] overflow-y-auto">
            {paginated.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No matching records found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {paginated.map((row, idx) => (
                  <div
                    key={idx}
                    onClick={() => setViewingSpare(row)}
                    className={`rounded-2xl border backdrop-blur-md p-4 flex flex-col justify-between transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-xl cursor-pointer ${
                      isDark 
                        ? 'bg-slate-900/60 border-white/10 hover:border-emerald-500/50 hover:bg-slate-800/80' 
                        : 'bg-white/80 border-slate-200 hover:border-emerald-400 hover:bg-white'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-xs text-indigo-400 truncate" title={`Task No: ${row.taskNo}`}>
                            {row.taskNo}
                          </span>
                          <span className="font-bold text-[10px] uppercase text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30 truncate">
                            {row.taskType}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          Loc: {row.locationCode}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-xs uppercase text-slate-100 truncate" title={row.partDesc}>
                          {row.partDesc}
                        </h4>
                        <div className="text-[11px] font-semibold text-slate-400 mt-1 truncate">
                          Branch: <span className="text-slate-200">{row.branch}</span>
                        </div>
                      </div>

                      <div className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                        isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Sl No:</span>
                          <span className="font-mono font-semibold text-right truncate text-slate-300 text-[11px]">
                            {row.slNo}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Model:</span>
                          <span className="font-bold uppercase tracking-tight text-right truncate text-emerald-400">
                            {row.model}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Status:</span>
                          <span className="font-medium text-right truncate text-slate-300 text-[11px]">
                            {row.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Category:</span>
                          <span className="font-semibold text-right truncate text-teal-400 text-[11px]">
                            {row.category}
                          </span>
                        </div>
                        <div className="flex justify-between items-start gap-2 pt-1 border-t border-inherit">
                          <span className="text-slate-400 text-[11px] shrink-0">Desc:</span>
                          <span className="font-medium text-right truncate text-slate-400 text-[11px] max-w-[125px]" title={row.description}>
                            {row.description}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-inherit">
                      <div className="text-[11px] text-slate-400 truncate flex items-center justify-between">
                        <span>Part Code:</span>
                        <span className="font-mono font-bold text-slate-200" title={row.partCode}>
                          {row.partCode}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className={`uppercase text-[10px] tracking-wider border-b border-inherit sticky top-0 backdrop-blur-md ${
                isDark ? 'bg-slate-900/90 text-slate-200' : 'bg-slate-100 text-slate-700 font-bold'
              }`}>
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task Type</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Part Code</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Part Description</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Location Code</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Sl No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Description</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Branch Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Category</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Model</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-400">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((row, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setViewingSpare(row)}
                      className="hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-indigo-400 whitespace-nowrap">
                        {row.taskNo}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {row.taskType}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-200 whitespace-nowrap">
                        {row.partCode}
                      </td>
                      <td className="py-3 px-3.5 text-slate-200 max-w-[200px] truncate" title={row.partDesc}>
                        {row.partDesc}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-200 whitespace-nowrap">
                        {row.locationCode}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                        {row.slNo}
                      </td>
                      <td className="py-3 px-3.5 text-slate-400 max-w-[200px] truncate" title={row.description}>
                        {row.description}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-200">
                        {row.branch}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          {row.category}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-emerald-400 font-semibold whitespace-nowrap">
                        {row.model}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3.5 border-t border-inherit flex items-center justify-between text-xs text-slate-400">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-medium transition"
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-medium transition"
          >
            Next
          </button>
        </div>
      </div>

      {/* POPUP DETAIL MODAL */}
      {viewingSpare && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className={`w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border backdrop-blur-2xl shadow-2xl ${
            isDark ? 'bg-slate-950/90 border-white/15 text-slate-100 shadow-emerald-950/50' : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50'
          }`}>
            <div className="p-4 sm:p-5 border-b flex items-center justify-between border-inherit">
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-mono font-bold text-emerald-400 text-base">
                  {viewingSpare.taskNo}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase">
                  {viewingSpare.taskType}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-bold uppercase">
                  Location: {viewingSpare.locationCode}
                </span>
              </div>
              <button onClick={() => setViewingSpare(null)} className="min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 text-xs overscroll-contain">
              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                <span className="text-slate-400 block mb-0.5 font-semibold">Part Description</span>
                <strong className="text-sm block text-slate-100">{viewingSpare.partDesc}</strong>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                <span className="text-slate-400 block mb-0.5 font-semibold">Description</span>
                <p className="text-slate-200">{viewingSpare.description}</p>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                <span className="text-slate-400 block mb-0.5 font-semibold">Branch Name</span>
                <strong className="text-sm block text-white">{viewingSpare.branch}</strong>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">Part Code</span>
                  <strong className="text-blue-400 font-mono text-sm">{viewingSpare.partCode}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">Sl No</span>
                  <strong className="font-mono text-slate-200 text-sm">{viewingSpare.slNo}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block">Location Code</span>
                  <strong className="text-slate-200 font-mono text-sm">{viewingSpare.locationCode}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">Model</span>
                  <strong className="text-emerald-400 text-sm">{viewingSpare.model}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">Status</span>
                  <strong className="text-blue-400">{viewingSpare.status}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block">Category</span>
                  <strong className="text-teal-400">{viewingSpare.category}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">Task Type</span>
                  <strong className="text-amber-400">{viewingSpare.taskType}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-slate-400 block">Product</span>
                  <strong className="text-slate-200">{viewingSpare.product}</strong>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block">Date</span>
                  <strong className="font-mono text-slate-200">{viewingSpare.formattedDate}</strong>
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end border-inherit">
              <button
                onClick={() => setViewingSpare(null)}
                className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 text-xs font-semibold rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white cursor-pointer hover:opacity-90 shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* -------------------------------------------------------------------------- */
/*                          TAB 3: SPARE APPROVAL TAB                         */
/* -------------------------------------------------------------------------- */
function SpareApprovalTab({ isDark, items = [], setItems }) {
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedBUs, setSelectedBUs] = useState([]);
  const [fromDateStr, setFromDateStr] = useState('');
  const [toDateStr, setToDateStr] = useState('');

  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [drilldownBU, setDrilldownBU] = useState('');
  const [rmrChartBU, setRmrChartBU] = useState('All');
  const [modalState, setModalState] = useState({ isOpen: false, item: null, isAdd: false });

  const extractAnyFormatCell = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if (val.f !== undefined && val.f !== null && String(val.f).trim() !== '') {
        return String(val.f).trim();
      }
      if (val.v !== undefined && val.v !== null) {
        return String(val.v).trim();
      }
      return '';
    }
    return String(val).trim();
  };

  const getTransactionBadge = (type) => {
    const t = String(type || '').trim().toUpperCase();
    if (t.includes('RMR')) return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    if (t.includes('ICSL')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (t.includes('ST')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (t.includes('CSC WARRANTY') || t.includes('WARRANTY')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (t.includes('PBS')) return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  };

  const getStatusBadge = (status) => {
    const st = String(status || '').toLowerCase();
    if (st === 'approved') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (st === 'rejected') return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  };

  const normalizedApprovals = useMemo(() => {
    const rawList = items.map((entry, idx) => {
      const row = Array.isArray(entry.row) ? entry.row : (entry.__raw || Object.values(entry || {}));

      const rawA = extractAnyFormatCell(row[0] !== undefined ? row[0] : entry['Req ID']);
      const reqNumber = (rawA && rawA !== '-' && rawA.toLowerCase() !== 'null' && rawA.toLowerCase() !== 'undefined') ? rawA : 'N/A';

      let rawG = '';
      if (row[6] !== undefined && row[6] !== null) {
        rawG = extractAnyFormatCell(row[6]);
      } else if (entry['Part Code'] !== undefined && entry['Part Code'] !== null) {
        rawG = extractAnyFormatCell(entry['Part Code']);
      }
      const partCode = (rawG && rawG !== '-' && rawG.toLowerCase() !== 'null') ? rawG : 'N/A';

      const rawH = extractAnyFormatCell(row[7] !== undefined ? row[7] : (entry['Part Description'] || entry['Part Decription']));
      const partDescription = rawH || '-';

      const rawK = extractAnyFormatCell(row[10] !== undefined ? row[10] : entry['Task No.']);
      const taskNo = rawK || '-';

      const orderNumber = extractAnyFormatCell(row[2] !== undefined ? row[2] : entry['Order Number']) || '-';
      const requesterComment = extractAnyFormatCell(row[3] !== undefined ? row[3] : entry['Requester Comment']) || '-';
      const buName = extractAnyFormatCell(row[4] !== undefined ? row[4] : entry['BU Name']) || '-';
      const taskOwnerRaw = extractAnyFormatCell(row[5] !== undefined ? row[5] : entry['Task Owner']);
      const taskOwner = taskOwnerRaw || (PRESET_BU_TO_TL[buName] || '-');

      const reqDateRaw = row[1] !== undefined ? row[1] : entry['Req Date'];
      const dateObj = reqDateRaw ? parseDate(reqDateRaw) : null;
      const formattedReqDate = dateObj ? formatDate(dateObj) : (reqDateRaw ? extractAnyFormatCell(reqDateRaw) : '-');

      const rawQty = extractAnyFormatCell(row[8] !== undefined ? row[8] : entry['Quanitity']);
      const qtyNum = parseFloat(rawQty) > 0 ? parseFloat(rawQty) : 1;

      const rawPrice = row[9] !== undefined ? row[9] : entry['Price'];
      const price = parseCurrency(rawPrice);

      const orderedBy = extractAnyFormatCell(row[11] !== undefined ? row[11] : entry['Ordered By']) || '-';
      const partTransaction = extractAnyFormatCell(row[12] !== undefined ? row[12] : entry['Part Transaction']) || '-';
      const transactionType = extractAnyFormatCell(row[13] !== undefined ? row[13] : entry['Transaction Type']) || '-';
      const taxCategory = extractAnyFormatCell(row[14] !== undefined ? row[14] : entry['Tax Category']) || '-';
      const approvalStatus = extractAnyFormatCell(row[15] !== undefined ? row[15] : entry['Approval Status']) || 'Pending';
      const status = extractAnyFormatCell(row[16] !== undefined ? row[16] : entry['Status']) || '-';
      const statusDate = formatDate(row[17] !== undefined ? row[17] : entry['Status Date']);
      const remarks = extractAnyFormatCell(row[18] !== undefined ? row[18] : entry['Remarks']);

      return {
        index_: entry.index_ || idx + 2,
        rawRow: row,
        dateObj,
        reqNumber,
        reqDate: formattedReqDate,
        orderNumber,
        requesterComment,
        buName,
        taskOwner,
        partCode,
        partDescription,
        quantity: qtyNum,
        price,
        taskNo,
        orderedBy,
        partTransaction,
        transactionType,
        taxCategory,
        approvalStatus,
        status,
        statusDate,
        remarks
      };
    });

    return [...rawList].reverse();
  }, [items]);

  const nextReqNumber = useMemo(() => {
    let maxNumber = 0;
    let prefix = '';
    let hasMatch = false;

    normalizedApprovals.forEach((item) => {
      const val = String(item.reqNumber || '').trim();
      if (!val || val === 'N/A' || val === '-') return;

      const match = val.match(/^(.*?)(\d+)$/);
      if (match) {
        const currentPrefix = match[1];
        const num = parseInt(match[2], 10);
        if (num > maxNumber) {
          maxNumber = num;
          prefix = currentPrefix;
          hasMatch = true;
        }
      } else {
        const digits = val.match(/\d+/g);
        if (digits) {
          const num = parseInt(digits[digits.length - 1], 10);
          if (num > maxNumber) {
            maxNumber = num;
            hasMatch = true;
          }
        }
      }
    });

    if (!hasMatch || maxNumber === 0) {
      return String(normalizedApprovals.length + 1);
    }

    const nextVal = maxNumber + 1;
    return prefix ? `${prefix}${nextVal}` : String(nextVal);
  }, [normalizedApprovals]);

  const { allBUs, allStatuses } = useMemo(() => {
    const buSet = new Set();
    const statusSet = new Set();
    normalizedApprovals.forEach(item => {
      if (item.buName && item.buName !== '-') buSet.add(item.buName);
      if (item.approvalStatus && item.approvalStatus !== '-') statusSet.add(item.approvalStatus);
    });
    return {
      allBUs: Array.from(buSet).sort(),
      allStatuses: Array.from(statusSet).sort()
    };
  }, [normalizedApprovals]);

  const filteredApprovals = useMemo(() => {
    const from = fromDateStr.trim() ? parseDate(fromDateStr.trim()) : null;
    const to = toDateStr.trim() ? parseDate(toDateStr.trim()) : null;
    if (to) to.setHours(23, 59, 59, 999);

    const q = search.trim().toLowerCase();

    return normalizedApprovals.filter(item => {
      if (selectedStatus.length > 0 && !selectedStatus.includes(item.approvalStatus)) return false;
      if (selectedBUs.length > 0 && !selectedBUs.includes(item.buName)) return false;

      if (item.dateObj) {
        if (from && item.dateObj < from) return false;
        if (to && item.dateObj > to) return false;
      } else if (from || to) {
        return false;
      }

      if (q) {
        return (
          item.reqNumber.toLowerCase().includes(q) ||
          item.taskNo.toLowerCase().includes(q) ||
          item.partCode.toLowerCase().includes(q) ||
          item.partDescription.toLowerCase().includes(q) ||
          item.buName.toLowerCase().includes(q) ||
          item.orderNumber.toLowerCase().includes(q) ||
          item.taskOwner.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [normalizedApprovals, selectedStatus, selectedBUs, fromDateStr, toDateStr, search]);

  const metrics = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let totalAccPrice = 0;
    const partsCountMap = {};

    filteredApprovals.forEach(a => {
      const st = a.approvalStatus.toLowerCase();
      if (st === 'approved') approved++;
      else if (st === 'rejected') rejected++;
      else pending++;

      totalAccPrice += a.price;

      if (a.partCode && a.partCode !== 'N/A' && a.partCode !== '-') {
        if (!partsCountMap[a.partCode]) {
          partsCountMap[a.partCode] = { code: a.partCode, desc: a.partDescription, qty: 0, cost: 0 };
        }
        partsCountMap[a.partCode].qty += a.quantity;
        partsCountMap[a.partCode].cost += a.price;
      }
    });

    const sortedParts = Object.values(partsCountMap).sort((a, b) => b.qty - a.qty);
    const topPart = sortedParts[0] || null;

    return {
      total: filteredApprovals.length,
      approved,
      pending,
      rejected,
      totalAccPrice,
      topPart
    };
  }, [filteredApprovals]);

  const topPartsChartData = useMemo(() => {
    const partsMap = {};
    filteredApprovals.forEach(item => {
      if (item.partCode && item.partCode !== 'N/A' && item.partCode !== '-') {
        partsMap[item.partCode] = (partsMap[item.partCode] || 0) + item.quantity;
      }
    });

    return Object.entries(partsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, qty]) => ({
        name: code.length > 14 ? `${code.substring(0, 12)}...` : code,
        fullCode: code,
        quantity: qty
      }));
  }, [filteredApprovals]);

  const topBUsChartData = useMemo(() => {
    const buMap = {};
    filteredApprovals.forEach(item => {
      if (item.buName && item.buName !== '-') {
        buMap[item.buName] = (buMap[item.buName] || 0) + item.quantity;
      }
    });

    return Object.entries(buMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
  }, [filteredApprovals]);

  const partsInSelectedBUData = useMemo(() => {
    const targetBU = drilldownBU || (topBUsChartData[0]?.name || '');
    if (!targetBU) return { targetBU: '', data: [] };

    const pMap = {};
    filteredApprovals.forEach(item => {
      if (item.buName.toLowerCase() === targetBU.toLowerCase() && item.partCode !== 'N/A' && item.partCode !== '-') {
        pMap[item.partCode] = (pMap[item.partCode] || 0) + item.quantity;
      }
    });

    const chartData = Object.entries(pMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({
        name: code.length > 14 ? `${code.substring(0, 12)}...` : code,
        fullCode: code,
        quantity: count
      }));

    return { targetBU, data: chartData };
  }, [filteredApprovals, drilldownBU, topBUsChartData]);

  const buWiseICSLData = useMemo(() => {
    const buMap = {};
    filteredApprovals.forEach(item => {
      if (String(item.partTransaction).trim().toUpperCase() === 'ICSL' && item.buName !== '-') {
        buMap[item.buName] = (buMap[item.buName] || 0) + item.quantity;
      }
    });

    return Object.entries(buMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
  }, [filteredApprovals]);

  const rmrStatusPieData = useMemo(() => {
    let processed = 0;
    let closed = 0;

    filteredApprovals.forEach(item => {
      const isRMR = String(item.partTransaction).trim().toUpperCase() === 'RMR';
      if (!isRMR) return;

      if (rmrChartBU !== 'All' && item.buName.toLowerCase() !== rmrChartBU.toLowerCase()) return;

      const st = String(item.status).trim().toLowerCase();
      if (st.includes('close')) closed++;
      else processed++;
    });

    const total = processed + closed;
    if (total === 0) return [];

    return [
      { name: 'Processed', value: processed, percent: ((processed / total) * 100).toFixed(1) },
      { name: 'Closed', value: closed, percent: ((closed / total) * 100).toFixed(1) }
    ];
  }, [filteredApprovals, rmrChartBU]);

  const totalPages = Math.max(1, Math.ceil(filteredApprovals.length / pageSize));
  const paginated = useMemo(() => {
    return filteredApprovals.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredApprovals, currentPage, pageSize]);

  const handleSaveRequisition = (updatedRow, index_) => {
    if (index_) {
      setItems(prev => prev.map(item => item.index_ === index_ ? { ...item, row: updatedRow } : item));
    } else {
      const newEntry = { index_: items.length + 2, row: updatedRow };
      setItems(prev => [newEntry, ...prev]);
    }
    setModalState({ isOpen: false, item: null, isAdd: false });
  };

  const resetFilters = () => {
    setSelectedStatus([]);
    setSelectedBUs([]);
    setFromDateStr('');
    setToDateStr('');
    setSearch('');
    setCurrentPage(1);
  };

  const RMR_COLORS = ['#38bdf8', '#34d399'];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* HEADER & NEW REQUISITION BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-black tracking-tight flex items-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400">
              Non-Commercial Spare Approvals
            </span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            Requisition approval workflows & line transactions
          </p>
        </div>

        <button
          onClick={() => setModalState({ isOpen: true, item: null, isAdd: true })}
          className="min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:opacity-90 text-white text-xs font-bold shadow-lg shadow-purple-500/30 transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Requisition</span>
        </button>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
        <div className={`p-3.5 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-purple-500/20 shadow-purple-950/20' : 'bg-white/70 border-purple-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-purple-400">
            <span>TOTAL ORDERS</span>
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {metrics.total.toLocaleString()}
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Logged requisitions</p>
        </div>

        <div className={`p-3.5 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-emerald-500/20 shadow-emerald-950/20' : 'bg-white/70 border-emerald-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-emerald-400">
            <span>APPROVED</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-black text-emerald-400">
            {metrics.approved.toLocaleString()}
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Requisitions approved</p>
        </div>

        <div className={`p-3.5 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-amber-500/20 shadow-amber-950/20' : 'bg-white/70 border-amber-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-amber-400">
            <span>PENDING</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-black text-amber-400">
            {metrics.pending.toLocaleString()}
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Awaiting approval</p>
        </div>

        <div className={`p-3.5 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-blue-500/20 shadow-blue-950/20' : 'bg-white/70 border-blue-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-blue-400">
            <span>ACCUMULATED VALUE</span>
            <IndianRupee className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-black text-blue-400">
            ₹{metrics.totalAccPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Sum of line prices</p>
        </div>

        <div className={`p-3.5 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg col-span-2 lg:col-span-1 ${
          isDark ? 'bg-slate-900/40 border-fuchsia-500/20 shadow-fuchsia-950/20' : 'bg-white/70 border-fuchsia-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-fuchsia-400">
            <span>TOP PART UTILISED</span>
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5 sm:mt-2">
            <h4 className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white truncate" title={metrics.topPart?.code}>
              {metrics.topPart ? metrics.topPart.code : 'N/A'}
            </h4>
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-1 flex justify-between">
              <span>Qty: <strong className="text-purple-400 font-mono">{metrics.topPart?.qty || 0}u</strong></span>
              <span>Cost: <strong className="text-emerald-400 font-mono">₹{(metrics.topPart?.cost || 0).toLocaleString()}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CRITERIA (HIGH STACKING CONTEXT) */}
      <div className={`relative z-30 p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg space-y-4 overflow-visible ${
        isDark ? 'bg-slate-900/50 border-white/10 shadow-purple-950/20' : 'bg-white/70 border-slate-200/90 shadow-slate-200/50'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-500" /> Filter Criteria
          </span>
          <button
            onClick={resetFilters}
            className="text-xs text-rose-500 hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <MultiSelectDropdown
            label="Business Unit (BU)"
            options={allBUs}
            selected={selectedBUs}
            onChange={vals => { setSelectedBUs(vals); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All BUs"
          />

          <MultiSelectDropdown
            label="Approval Status"
            options={allStatuses}
            selected={selectedStatus}
            onChange={vals => { setSelectedStatus(vals); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Statuses"
          />

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-300/80 mb-1.5">
              From Date {fromDateStr && <span className="text-purple-400 font-mono">({formatDate(fromDateStr)})</span>}
            </label>
            <input
              type="date"
              value={toISODateInput(fromDateStr)}
              onChange={e => {
                if (!e.target.value) setFromDateStr('');
                else {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setFromDateStr(formatDate(new Date(y, m - 1, d)));
                }
                setCurrentPage(1);
              }}
              className={`w-full min-h-[44px] text-xs px-3.5 py-2.5 rounded-2xl border backdrop-blur-md font-mono transition cursor-pointer ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-200 [color-scheme:dark]' : 'bg-white/70 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-300/80 mb-1.5">
              To Date {toDateStr && <span className="text-purple-400 font-mono">({formatDate(toDateStr)})</span>}
            </label>
            <input
              type="date"
              value={toISODateInput(toDateStr)}
              onChange={e => {
                if (!e.target.value) setToDateStr('');
                else {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setToDateStr(formatDate(new Date(y, m - 1, d)));
                }
                setCurrentPage(1);
              }}
              className={`w-full min-h-[44px] text-xs px-3.5 py-2.5 rounded-2xl border backdrop-blur-md font-mono transition cursor-pointer ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-200 [color-scheme:dark]' : 'bg-white/70 border-slate-200 text-slate-800'
              }`}
            />
          </div>
        </div>
      </div>

      {/* CHARTS ROW 1 */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Top 5 Parts Chart */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-purple-400" /> Top 5 Parts
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Top spare part codes across requisitions</p>
          </div>

          <div style={{ width: '100%', height: 230 }}>
            {topPartsChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No records</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={topPartsChartData} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [`${val} units`, item?.payload?.fullCode || '']}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="quantity" fill="#a855f7" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top 5 BUs Chart */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-400" /> Top 5 BUs
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Click any bar to drill down</p>
            </div>
            {drilldownBU && (
              <button
                onClick={() => setDrilldownBU('')}
                className="text-xs text-blue-400 hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <div style={{ width: '100%', height: 230 }}>
            {topBUsChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No BU records found</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={topBUsChartData}
                  margin={{ top: 16, right: 10, left: -20, bottom: 20 }}
                  onClick={state => {
                    if (state?.activePayload?.[0]?.payload?.name) {
                      setDrilldownBU(state.activePayload[0].payload.name);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val) => [`${val} units (Click to drill down)`, 'Consumption']}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="total" fill="#38bdf8" radius={[6, 6, 0, 0]} className="cursor-pointer">
                    <LabelList dataKey="total" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Parts in Selected BU */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                Parts in: <strong className="text-cyan-400">{partsInSelectedBUData.targetBU || 'Select BU'}</strong>
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Top parts consumed</p>
            </div>
            <select
              value={partsInSelectedBUData.targetBU}
              onChange={e => setDrilldownBU(e.target.value)}
              className={`min-h-[44px] text-xs px-2.5 py-1.5 rounded-2xl border backdrop-blur-md font-medium cursor-pointer ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <option value="" disabled>Change BU</option>
              {allBUs.map(bu => <option key={bu} value={bu}>{bu}</option>)}
            </select>
          </div>

          <div style={{ width: '100%', height: 210 }}>
            {partsInSelectedBUData.data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No parts in BU</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={partsInSelectedBUData.data} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [`${val} units`, item?.payload?.fullCode || '']}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="quantity" fill="#06b6d4" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* BU-Wise ICSL */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              BU Wise ICSL Used
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Part Transaction = "ICSL"</p>
          </div>

          <div style={{ width: '100%', height: 210 }}>
            {buWiseICSLData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No ICSL records</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={buWiseICSLData} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val) => [`${val} units ICSL`, 'ICSL Volume']}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="total" fill="#fbbf24" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="total" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* RMR Processed vs Closed */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 flex flex-col justify-between ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                RMR Breakdown
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Part Transaction = "RMR"</p>
            </div>
            <select
              value={rmrChartBU}
              onChange={e => setRmrChartBU(e.target.value)}
              className={`min-h-[44px] text-xs px-2.5 py-1.5 rounded-2xl border backdrop-blur-md font-medium cursor-pointer ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All BUs</option>
              {allBUs.map(bu => <option key={bu} value={bu}>{bu}</option>)}
            </select>
          </div>

          <div style={{ width: '100%', height: 210 }}>
            {rmrStatusPieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No RMR data</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Tooltip
                    formatter={(val, name, item) => [`${val} orders (${item.payload.percent}%)`, name]}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Pie
                    data={rmrStatusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={40}
                    outerRadius={68}
                    paddingAngle={4}
                  >
                    {rmrStatusPieData.map((entry, index) => (
                      <Cell key={`rmr-${index}`} fill={RMR_COLORS[index % RMR_COLORS.length]} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    formatter={(value, entry) => (
                      <span className={isDark ? "text-slate-300 text-xs" : "text-slate-700 text-xs"}>
                        {value}: <strong>{entry.payload.value}</strong>
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* REQUISITION WORKSPACE */}
      <div className={`relative z-10 rounded-3xl border backdrop-blur-xl shadow-xl overflow-hidden ${
        isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
      }`}>
        <div className="p-3.5 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 border-inherit">
          <div className="flex items-center flex-wrap gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Req No, BU, Part Code..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className={`text-xs pl-9 pr-3.5 py-2.5 rounded-2xl border backdrop-blur-sm w-full focus:outline-hidden transition min-h-[44px] ${
                  isDark ? 'bg-slate-950/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-500'
                }`}
              />
            </div>

            <div className={`flex items-center p-1 rounded-2xl border ${
              isDark ? 'bg-slate-950/60 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Table
              </button>
            </div>
          </div>

          <span className="text-[11px] sm:text-xs text-slate-400">
            Page {currentPage} of {totalPages} ({filteredApprovals.length} records • Latest First)
          </span>
        </div>

        {viewMode === 'grid' ? (
          <div className="p-3.5 sm:p-5 max-h-[700px] overflow-y-auto">
            {paginated.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No matching requisitions found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {paginated.map((item) => (
                  <div
                    key={item.index_}
                    onClick={() => setModalState({ isOpen: true, item, isAdd: false })}
                    className={`rounded-2xl border backdrop-blur-md p-4 flex flex-col justify-between transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-xl cursor-pointer ${
                      isDark 
                        ? 'bg-slate-900/60 border-white/10 hover:border-purple-500/50 hover:bg-slate-800/80' 
                        : 'bg-white/80 border-slate-200 hover:border-purple-400 hover:bg-white'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          #{item.reqNumber}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(item.approvalStatus)}`}>
                          {item.approvalStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-semibold text-slate-300 truncate">
                          BU: <strong className="text-white">{item.buName}</strong>
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${getTransactionBadge(item.partTransaction)}`}>
                          {item.partTransaction}
                        </span>
                      </div>

                      <div className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                        isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Part Code:</span>
                          <span className="font-mono font-bold truncate max-w-[140px] text-slate-100" title={item.partCode}>
                            {item.partCode}
                          </span>
                        </div>

                        <div className="flex justify-between items-start text-[11px] gap-2 pt-0.5 border-t border-dashed border-white/10">
                          <span className="text-slate-400 shrink-0">Part Desc:</span>
                          <span className="text-right truncate max-w-[140px] font-medium text-slate-300" title={item.partDescription}>
                            {item.partDescription}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Task No:</span>
                          <span className="font-mono font-semibold text-slate-200" title={item.taskNo}>
                            {item.taskNo}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Tax Category:</span>
                          <span className="truncate max-w-[130px] font-medium text-slate-300" title={item.taxCategory}>
                            {item.taxCategory}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-inherit">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Qty:</span>
                            <span className="font-bold font-mono text-slate-200">{item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Price:</span>
                            <span className="font-bold text-emerald-400 font-mono">
                              ₹{item.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-inherit flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">{item.reqDate}</span>
                      <span className="font-bold text-purple-300 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30">
                        TL: {item.taskOwner}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className={`uppercase text-[10px] tracking-wider border-b border-inherit sticky top-0 backdrop-blur-md ${
                isDark ? 'bg-slate-900/90 text-slate-200' : 'bg-slate-100 text-slate-700 font-bold'
              }`}>
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap">Req No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Req Date</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">BU Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Part Code</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Tax Category</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Transaction</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Qty</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Price</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Approval</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">TL Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  paginated.map((row) => (
                    <tr
                      key={row.index_}
                      onClick={() => setModalState({ isOpen: true, item: row, isAdd: false })}
                      className="hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-purple-400 whitespace-nowrap">#{row.reqNumber}</td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-slate-300">{row.reqDate}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-200">{row.buName}</td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-amber-200">{row.taskNo}</td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap font-semibold text-slate-200">{row.partCode}</td>
                      <td className="py-3 px-3.5 max-w-[150px] truncate" title={row.taxCategory}>{row.taxCategory}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTransactionBadge(row.partTransaction)}`}>
                          {row.partTransaction}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-slate-200">{row.quantity}</td>
                      <td className="py-3 px-3.5 font-semibold text-emerald-400 whitespace-nowrap">₹{row.price.toLocaleString()}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(row.approvalStatus)}`}>
                          {row.approvalStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-bold text-purple-400">{row.taskOwner}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3.5 border-t border-inherit flex items-center justify-between text-xs text-slate-400">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-medium transition"
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-medium transition"
          >
            Next
          </button>
        </div>
      </div>

      {/* REQUISITION MODAL FORM - MOBILE OPTIMIZED (BOTTOM SHEET ON SMALL SCREENS) */}
      {modalState.isOpen && (
        <Requisition19ColModal
          item={modalState.item}
          isAdd={modalState.isAdd}
          nextReqNumber={modalState.isAdd ? nextReqNumber : (modalState.item?.reqNumber || '')}
          isDark={isDark}
          onClose={() => setModalState({ isOpen: false, item: null, isAdd: false })}
          onSave={handleSaveRequisition}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*             MODAL: 19-COLUMN ENTRY & EDIT FORM (GLASS / MOBILE)            */
/* -------------------------------------------------------------------------- */
function Requisition19ColModal({ item, isAdd, nextReqNumber, isDark, onClose, onSave }) {
  const initial = useMemo(() => {
    if (item && Array.isArray(item.rawRow)) return item.rawRow;
    if (item && item.rawRow && typeof item.rawRow === 'object') return Object.values(item.rawRow);
    return new Array(19).fill('');
  }, [item]);

  const defaultBU = initial[4] || PRESET_BU_LIST[0] || 'Ahmedabad';
  const defaultTaskOwner = initial[5] || PRESET_BU_TO_TL[defaultBU] || 'AKB';
  const defaultTransType = initial[13] || PRESET_TRANSACTION_TYPES[0] || 'BOM_BU_Transfer_Permanent_Ord';
  const defaultTax = initial[14] || TRANSACTION_TYPE_TO_TAX[defaultTransType] || 'Bom:Insterstate 18%';

  const [formData, setFormData] = useState({
    reqNumber: isAdd ? String(nextReqNumber) : (initial[0] !== undefined && initial[0] !== '' ? String(initial[0]) : String(nextReqNumber)),
    date: initial[1] ? formatDate(initial[1]) : formatDate(new Date()),
    orderNumber: initial[2] !== undefined ? String(initial[2]) : '',
    requesterComment: initial[3] !== undefined ? String(initial[3]) : '',
    buName: defaultBU,
    taskOwner: defaultTaskOwner,
    partCode: initial[6] !== undefined ? String(initial[6]) : '',
    partDescription: initial[7] !== undefined ? String(initial[7]) : '',
    quantity: initial[8] !== undefined && initial[8] !== '' ? String(initial[8]) : '1',
    price: initial[9] !== undefined && initial[9] !== '' ? String(initial[9]) : '0',
    taskNo: initial[10] !== undefined ? String(initial[10]) : '',
    orderedBy: initial[11] || PRESET_ORDERED_BY[0] || 'CSC',
    partTransaction: initial[12] || PRESET_PART_TRANSACTIONS[0] || 'RMR',
    transactionType: defaultTransType,
    taxCategory: defaultTax,
    approvalStatus: initial[15] || (isAdd ? 'Pending' : 'Approved'),
    status: initial[16] || 'Processed',
    statusDate: initial[17] ? formatDate(initial[17]) : formatDate(new Date()),
    remarks: initial[18] !== undefined ? String(initial[18]) : ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'buName') updated.taskOwner = PRESET_BU_TO_TL[value] || 'AKB';
      if (name === 'transactionType') updated.taxCategory = TRANSACTION_TYPE_TO_TAX[value] || 'Bom:Insterstate 18%';
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const rowArray = [
      formData.reqNumber,
      formatDate(formData.date),
      formData.orderNumber,
      formData.requesterComment,
      formData.buName,
      formData.taskOwner,
      formData.partCode,
      formData.partDescription,
      formData.quantity,
      formData.price,
      formData.taskNo,
      formData.orderedBy,
      formData.partTransaction,
      formData.transactionType,
      formData.taxCategory,
      formData.approvalStatus,
      formData.status,
      formatDate(formData.statusDate),
      formData.remarks
    ];
    onSave(rowArray, item ? item.index_ : null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className={`w-full max-w-2xl max-h-[90vh] sm:max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border backdrop-blur-2xl shadow-2xl ${
        isDark ? 'bg-slate-950/90 border-white/15 text-slate-100 shadow-purple-950/50' : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50'
      }`}>
        <div className="p-4 sm:p-5 border-b flex items-center justify-between border-inherit">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs sm:text-sm px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              #{formData.reqNumber}
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {isAdd ? 'Create Requisition' : `Edit Requisition #${formData.reqNumber}`}
            </h3>
          </div>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-4 text-xs flex-1 overscroll-contain">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Req No</label>
              <input
                type="text"
                name="reqNumber"
                value={formData.reqNumber}
                onChange={handleChange}
                placeholder="Req Number"
                required
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono font-bold ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Req Date</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Order Number</label>
              <input
                type="text"
                name="orderNumber"
                value={formData.orderNumber}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Task No</label>
              <input
                type="text"
                name="taskNo"
                value={formData.taskNo}
                onChange={handleChange}
                placeholder="Exact Task No"
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/5">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">BU Name</label>
              <select
                name="buName"
                value={formData.buName}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-medium ${
                  isDark ? 'bg-slate-900/80 border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {PRESET_BU_LIST.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Task Owner (TL)</label>
              <input
                type="text"
                name="taskOwner"
                value={formData.taskOwner}
                readOnly
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border font-bold cursor-not-allowed ${
                  isDark ? 'bg-slate-900/90 border-white/5 text-purple-400' : 'bg-slate-100 border-slate-200 text-purple-700'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Part Code</label>
              <input
                type="text"
                name="partCode"
                value={formData.partCode}
                onChange={handleChange}
                placeholder="Exact Part Code"
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-400 mb-1">Part Description</label>
              <input
                type="text"
                name="partDescription"
                value={formData.partDescription}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-bold ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Price</label>
              <input
                type="number"
                step="any"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-bold text-emerald-400 ${
                  isDark ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Ordered By</label>
              <select
                name="orderedBy"
                value={formData.orderedBy}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {PRESET_ORDERED_BY.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Transaction</label>
              <select
                name="partTransaction"
                value={formData.partTransaction}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {PRESET_PART_TRANSACTIONS.map(pt => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/5">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Transaction Type</label>
              <select
                name="transactionType"
                value={formData.transactionType}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-medium ${
                  isDark ? 'bg-slate-900/80 border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {PRESET_TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Tax Category</label>
              <input
                type="text"
                name="taxCategory"
                value={formData.taxCategory}
                readOnly
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border font-bold cursor-not-allowed ${
                  isDark ? 'bg-slate-900/90 border-white/5 text-emerald-400' : 'bg-slate-100 border-slate-200 text-emerald-700'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Approval Status</label>
              <select
                name="approvalStatus"
                value={formData.approvalStatus}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-bold ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-emerald-400' : 'bg-slate-50 border-slate-200 text-emerald-700'
                }`}
              >
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="On Hold">On Hold</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="Processed">Processed</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Status Date</label>
              <input
                type="text"
                name="statusDate"
                value={formData.statusDate}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-400 mb-1">Requester Comment</label>
            <textarea
              name="requesterComment"
              rows={2}
              value={formData.requesterComment}
              onChange={handleChange}
              className={`w-full p-3 rounded-2xl border backdrop-blur-sm ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-400 mb-1">Remarks</label>
            <textarea
              name="remarks"
              rows={2}
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Internal remarks..."
              className={`w-full p-3 rounded-2xl border backdrop-blur-sm ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          <div className="pt-3 border-t flex flex-col-reverse sm:flex-row justify-end gap-2 border-inherit">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-inherit text-xs font-semibold cursor-pointer hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:opacity-90 text-white font-bold text-xs shadow-lg shadow-purple-500/30 transition cursor-pointer"
            >
              Save Requisition
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
/* -------------------------------------------------------------------------- */
/*                          TAB 3: SPARE APPROVAL TAB                         */
/* -------------------------------------------------------------------------- */
function SpareApprovalTab({ isDark, items = [], setItems }) {
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedBUs, setSelectedBUs] = useState([]);
  const [fromDateStr, setFromDateStr] = useState('');
  const [toDateStr, setToDateStr] = useState('');

  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [drilldownBU, setDrilldownBU] = useState('');
  const [rmrChartBU, setRmrChartBU] = useState('All');
  const [modalState, setModalState] = useState({ isOpen: false, item: null, isAdd: false });

  const extractAnyFormatCell = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if (val.f !== undefined && val.f !== null && String(val.f).trim() !== '') {
        return String(val.f).trim();
      }
      if (val.v !== undefined && val.v !== null) {
        return String(val.v).trim();
      }
      return '';
    }
    return String(val).trim();
  };

  const getTransactionBadge = (type) => {
    const t = String(type || '').trim().toUpperCase();
    if (t.includes('RMR')) return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    if (t.includes('ICSL')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (t.includes('ST')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (t.includes('CSC WARRANTY') || t.includes('WARRANTY')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (t.includes('PBS')) return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  };

  const getStatusBadge = (status) => {
    const st = String(status || '').toLowerCase();
    if (st === 'approved') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (st === 'rejected') return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  };

  const normalizedApprovals = useMemo(() => {
    const rawList = items.map((entry, idx) => {
      const row = Array.isArray(entry.row) ? entry.row : (entry.__raw || Object.values(entry || {}));

      const rawA = extractAnyFormatCell(row[0] !== undefined ? row[0] : entry['Req ID']);
      const reqNumber = (rawA && rawA !== '-' && rawA.toLowerCase() !== 'null' && rawA.toLowerCase() !== 'undefined') ? rawA : 'N/A';

      let rawG = '';
      if (row[6] !== undefined && row[6] !== null) {
        rawG = extractAnyFormatCell(row[6]);
      } else if (entry['Part Code'] !== undefined && entry['Part Code'] !== null) {
        rawG = extractAnyFormatCell(entry['Part Code']);
      }
      const partCode = (rawG && rawG !== '-' && rawG.toLowerCase() !== 'null') ? rawG : 'N/A';

      const rawH = extractAnyFormatCell(row[7] !== undefined ? row[7] : (entry['Part Description'] || entry['Part Decription']));
      const partDescription = rawH || '-';

      const rawK = extractAnyFormatCell(row[10] !== undefined ? row[10] : entry['Task No.']);
      const taskNo = rawK || '-';

      const orderNumber = extractAnyFormatCell(row[2] !== undefined ? row[2] : entry['Order Number']) || '-';
      const requesterComment = extractAnyFormatCell(row[3] !== undefined ? row[3] : entry['Requester Comment']) || '-';
      const buName = extractAnyFormatCell(row[4] !== undefined ? row[4] : entry['BU Name']) || '-';
      const taskOwnerRaw = extractAnyFormatCell(row[5] !== undefined ? row[5] : entry['Task Owner']);
      const taskOwner = taskOwnerRaw || (PRESET_BU_TO_TL[buName] || '-');

      const reqDateRaw = row[1] !== undefined ? row[1] : entry['Req Date'];
      const dateObj = reqDateRaw ? parseDate(reqDateRaw) : null;
      const formattedReqDate = dateObj ? formatDate(dateObj) : (reqDateRaw ? extractAnyFormatCell(reqDateRaw) : '-');

      const rawQty = extractAnyFormatCell(row[8] !== undefined ? row[8] : entry['Quanitity']);
      const qtyNum = parseFloat(rawQty) > 0 ? parseFloat(rawQty) : 1;

      const rawPrice = row[9] !== undefined ? row[9] : entry['Price'];
      const price = parseCurrency(rawPrice);

      const orderedBy = extractAnyFormatCell(row[11] !== undefined ? row[11] : entry['Ordered By']) || '-';
      const partTransaction = extractAnyFormatCell(row[12] !== undefined ? row[12] : entry['Part Transaction']) || '-';
      const transactionType = extractAnyFormatCell(row[13] !== undefined ? row[13] : entry['Transaction Type']) || '-';
      const taxCategory = extractAnyFormatCell(row[14] !== undefined ? row[14] : entry['Tax Category']) || '-';
      const approvalStatus = extractAnyFormatCell(row[15] !== undefined ? row[15] : entry['Approval Status']) || 'Pending';
      const status = extractAnyFormatCell(row[16] !== undefined ? row[16] : entry['Status']) || '-';
      const statusDate = formatDate(row[17] !== undefined ? row[17] : entry['Status Date']);
      const remarks = extractAnyFormatCell(row[18] !== undefined ? row[18] : entry['Remarks']);

      return {
        index_: entry.index_ || idx + 2,
        rawRow: row,
        dateObj,
        reqNumber,
        reqDate: formattedReqDate,
        orderNumber,
        requesterComment,
        buName,
        taskOwner,
        partCode,
        partDescription,
        quantity: qtyNum,
        price,
        taskNo,
        orderedBy,
        partTransaction,
        transactionType,
        taxCategory,
        approvalStatus,
        status,
        statusDate,
        remarks
      };
    });

    return [...rawList].reverse();
  }, [items]);

  const nextReqNumber = useMemo(() => {
    let maxNumber = 0;
    let prefix = '';
    let hasMatch = false;

    normalizedApprovals.forEach((item) => {
      const val = String(item.reqNumber || '').trim();
      if (!val || val === 'N/A' || val === '-') return;

      const match = val.match(/^(.*?)(\d+)$/);
      if (match) {
        const currentPrefix = match[1];
        const num = parseInt(match[2], 10);
        if (num > maxNumber) {
          maxNumber = num;
          prefix = currentPrefix;
          hasMatch = true;
        }
      } else {
        const digits = val.match(/\d+/g);
        if (digits) {
          const num = parseInt(digits[digits.length - 1], 10);
          if (num > maxNumber) {
            maxNumber = num;
            hasMatch = true;
          }
        }
      }
    });

    if (!hasMatch || maxNumber === 0) {
      return String(normalizedApprovals.length + 1);
    }

    const nextVal = maxNumber + 1;
    return prefix ? `${prefix}${nextVal}` : String(nextVal);
  }, [normalizedApprovals]);

  const { allBUs, allStatuses } = useMemo(() => {
    const buSet = new Set();
    const statusSet = new Set();
    normalizedApprovals.forEach(item => {
      if (item.buName && item.buName !== '-') buSet.add(item.buName);
      if (item.approvalStatus && item.approvalStatus !== '-') statusSet.add(item.approvalStatus);
    });
    return {
      allBUs: Array.from(buSet).sort(),
      allStatuses: Array.from(statusSet).sort()
    };
  }, [normalizedApprovals]);

  const filteredApprovals = useMemo(() => {
    const from = fromDateStr.trim() ? parseDate(fromDateStr.trim()) : null;
    const to = toDateStr.trim() ? parseDate(toDateStr.trim()) : null;
    if (to) to.setHours(23, 59, 59, 999);

    const q = search.trim().toLowerCase();

    return normalizedApprovals.filter(item => {
      if (selectedStatus.length > 0 && !selectedStatus.includes(item.approvalStatus)) return false;
      if (selectedBUs.length > 0 && !selectedBUs.includes(item.buName)) return false;

      if (item.dateObj) {
        if (from && item.dateObj < from) return false;
        if (to && item.dateObj > to) return false;
      } else if (from || to) {
        return false;
      }

      if (q) {
        return (
          item.reqNumber.toLowerCase().includes(q) ||
          item.taskNo.toLowerCase().includes(q) ||
          item.partCode.toLowerCase().includes(q) ||
          item.partDescription.toLowerCase().includes(q) ||
          item.buName.toLowerCase().includes(q) ||
          item.orderNumber.toLowerCase().includes(q) ||
          item.taskOwner.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [normalizedApprovals, selectedStatus, selectedBUs, fromDateStr, toDateStr, search]);

  const metrics = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let totalAccPrice = 0;
    const partsCountMap = {};

    filteredApprovals.forEach(a => {
      const st = a.approvalStatus.toLowerCase();
      if (st === 'approved') approved++;
      else if (st === 'rejected') rejected++;
      else pending++;

      totalAccPrice += a.price;

      if (a.partCode && a.partCode !== 'N/A' && a.partCode !== '-') {
        if (!partsCountMap[a.partCode]) {
          partsCountMap[a.partCode] = { code: a.partCode, desc: a.partDescription, qty: 0, cost: 0 };
        }
        partsCountMap[a.partCode].qty += a.quantity;
        partsCountMap[a.partCode].cost += a.price;
      }
    });

    const sortedParts = Object.values(partsCountMap).sort((a, b) => b.qty - a.qty);
    const topPart = sortedParts[0] || null;

    return {
      total: filteredApprovals.length,
      approved,
      pending,
      rejected,
      totalAccPrice,
      topPart
    };
  }, [filteredApprovals]);

  const topPartsChartData = useMemo(() => {
    const partsMap = {};
    filteredApprovals.forEach(item => {
      if (item.partCode && item.partCode !== 'N/A' && item.partCode !== '-') {
        partsMap[item.partCode] = (partsMap[item.partCode] || 0) + item.quantity;
      }
    });

    return Object.entries(partsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, qty]) => ({
        name: code.length > 14 ? `${code.substring(0, 12)}...` : code,
        fullCode: code,
        quantity: qty
      }));
  }, [filteredApprovals]);

  const topBUsChartData = useMemo(() => {
    const buMap = {};
    filteredApprovals.forEach(item => {
      if (item.buName && item.buName !== '-') {
        buMap[item.buName] = (buMap[item.buName] || 0) + item.quantity;
      }
    });

    return Object.entries(buMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
  }, [filteredApprovals]);

  const partsInSelectedBUData = useMemo(() => {
    const targetBU = drilldownBU || (topBUsChartData[0]?.name || '');
    if (!targetBU) return { targetBU: '', data: [] };

    const pMap = {};
    filteredApprovals.forEach(item => {
      if (item.buName.toLowerCase() === targetBU.toLowerCase() && item.partCode !== 'N/A' && item.partCode !== '-') {
        pMap[item.partCode] = (pMap[item.partCode] || 0) + item.quantity;
      }
    });

    const chartData = Object.entries(pMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({
        name: code.length > 14 ? `${code.substring(0, 12)}...` : code,
        fullCode: code,
        quantity: count
      }));

    return { targetBU, data: chartData };
  }, [filteredApprovals, drilldownBU, topBUsChartData]);

  const buWiseICSLData = useMemo(() => {
    const buMap = {};
    filteredApprovals.forEach(item => {
      if (String(item.partTransaction).trim().toUpperCase() === 'ICSL' && item.buName !== '-') {
        buMap[item.buName] = (buMap[item.buName] || 0) + item.quantity;
      }
    });

    return Object.entries(buMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
  }, [filteredApprovals]);

  const rmrStatusPieData = useMemo(() => {
    let processed = 0;
    let closed = 0;

    filteredApprovals.forEach(item => {
      const isRMR = String(item.partTransaction).trim().toUpperCase() === 'RMR';
      if (!isRMR) return;

      if (rmrChartBU !== 'All' && item.buName.toLowerCase() !== rmrChartBU.toLowerCase()) return;

      const st = String(item.status).trim().toLowerCase();
      if (st.includes('close')) closed++;
      else processed++;
    });

    const total = processed + closed;
    if (total === 0) return [];

    return [
      { name: 'Processed', value: processed, percent: ((processed / total) * 100).toFixed(1) },
      { name: 'Closed', value: closed, percent: ((closed / total) * 100).toFixed(1) }
    ];
  }, [filteredApprovals, rmrChartBU]);

  const totalPages = Math.max(1, Math.ceil(filteredApprovals.length / pageSize));
  const paginated = useMemo(() => {
    return filteredApprovals.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredApprovals, currentPage, pageSize]);

  const handleSaveRequisition = (updatedRow, index_) => {
    if (index_) {
      setItems(prev => prev.map(item => item.index_ === index_ ? { ...item, row: updatedRow } : item));
    } else {
      const newEntry = { index_: items.length + 2, row: updatedRow };
      setItems(prev => [newEntry, ...prev]);
    }
    setModalState({ isOpen: false, item: null, isAdd: false });
  };

  const resetFilters = () => {
    setSelectedStatus([]);
    setSelectedBUs([]);
    setFromDateStr('');
    setToDateStr('');
    setSearch('');
    setCurrentPage(1);
  };

  const RMR_COLORS = ['#38bdf8', '#34d399'];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* HEADER & NEW REQUISITION BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-black tracking-tight flex items-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400">
              Non-Commercial Spare Approvals
            </span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            Requisition approval workflows & line transactions
          </p>
        </div>

        <button
          onClick={() => setModalState({ isOpen: true, item: null, isAdd: true })}
          className="min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:opacity-90 text-white text-xs font-bold shadow-lg shadow-purple-500/30 transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Requisition</span>
        </button>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
        <div className={`p-3.5 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-purple-500/20 shadow-purple-950/20' : 'bg-white/70 border-purple-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-purple-400">
            <span>TOTAL ORDERS</span>
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {metrics.total.toLocaleString()}
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Logged requisitions</p>
        </div>

        <div className={`p-3.5 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-emerald-500/20 shadow-emerald-950/20' : 'bg-white/70 border-emerald-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-emerald-400">
            <span>APPROVED</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-black text-emerald-400">
            {metrics.approved.toLocaleString()}
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Requisitions approved</p>
        </div>

        <div className={`p-3.5 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-amber-500/20 shadow-amber-950/20' : 'bg-white/70 border-amber-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-amber-400">
            <span>PENDING</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-black text-amber-400">
            {metrics.pending.toLocaleString()}
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Awaiting approval</p>
        </div>

        <div className={`p-3.5 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/40 border-blue-500/20 shadow-blue-950/20' : 'bg-white/70 border-blue-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-blue-400">
            <span>ACCUMULATED VALUE</span>
            <IndianRupee className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-black text-blue-400">
            ₹{metrics.totalAccPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Sum of line prices</p>
        </div>

        <div className={`p-3.5 sm:p-5 rounded-3xl border backdrop-blur-xl relative overflow-hidden shadow-lg col-span-2 lg:col-span-1 ${
          isDark ? 'bg-slate-900/40 border-fuchsia-500/20 shadow-fuchsia-950/20' : 'bg-white/70 border-fuchsia-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-fuchsia-400">
            <span>TOP PART UTILISED</span>
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1.5 sm:mt-2">
            <h4 className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white truncate" title={metrics.topPart?.code}>
              {metrics.topPart ? metrics.topPart.code : 'N/A'}
            </h4>
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-1 flex justify-between">
              <span>Qty: <strong className="text-purple-400 font-mono">{metrics.topPart?.qty || 0}u</strong></span>
              <span>Cost: <strong className="text-emerald-400 font-mono">₹{(metrics.topPart?.cost || 0).toLocaleString()}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CRITERIA (HIGH STACKING CONTEXT) */}
      <div className={`relative z-30 p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg space-y-4 overflow-visible ${
        isDark ? 'bg-slate-900/50 border-white/10 shadow-purple-950/20' : 'bg-white/70 border-slate-200/90 shadow-slate-200/50'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-500" /> Filter Criteria
          </span>
          <button
            onClick={resetFilters}
            className="text-xs text-rose-500 hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <MultiSelectDropdown
            label="Business Unit (BU)"
            options={allBUs}
            selected={selectedBUs}
            onChange={vals => { setSelectedBUs(vals); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All BUs"
          />

          <MultiSelectDropdown
            label="Approval Status"
            options={allStatuses}
            selected={selectedStatus}
            onChange={vals => { setSelectedStatus(vals); setCurrentPage(1); }}
            isDark={isDark}
            placeholder="All Statuses"
          />

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-300/80 mb-1.5">
              From Date {fromDateStr && <span className="text-purple-400 font-mono">({formatDate(fromDateStr)})</span>}
            </label>
            <input
              type="date"
              value={toISODateInput(fromDateStr)}
              onChange={e => {
                if (!e.target.value) setFromDateStr('');
                else {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setFromDateStr(formatDate(new Date(y, m - 1, d)));
                }
                setCurrentPage(1);
              }}
              className={`w-full min-h-[44px] text-xs px-3.5 py-2.5 rounded-2xl border backdrop-blur-md font-mono transition cursor-pointer ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-200 [color-scheme:dark]' : 'bg-white/70 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-300/80 mb-1.5">
              To Date {toDateStr && <span className="text-purple-400 font-mono">({formatDate(toDateStr)})</span>}
            </label>
            <input
              type="date"
              value={toISODateInput(toDateStr)}
              onChange={e => {
                if (!e.target.value) setToDateStr('');
                else {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setToDateStr(formatDate(new Date(y, m - 1, d)));
                }
                setCurrentPage(1);
              }}
              className={`w-full min-h-[44px] text-xs px-3.5 py-2.5 rounded-2xl border backdrop-blur-md font-mono transition cursor-pointer ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-200 [color-scheme:dark]' : 'bg-white/70 border-slate-200 text-slate-800'
              }`}
            />
          </div>
        </div>
      </div>

      {/* CHARTS ROW 1 */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Top 5 Parts Chart */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-purple-400" /> Top 5 Parts
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Top spare part codes across requisitions</p>
          </div>

          <div style={{ width: '100%', height: 230 }}>
            {topPartsChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No records</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={topPartsChartData} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [`${val} units`, item?.payload?.fullCode || '']}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="quantity" fill="#a855f7" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top 5 BUs Chart */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-400" /> Top 5 BUs
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Click any bar to drill down</p>
            </div>
            {drilldownBU && (
              <button
                onClick={() => setDrilldownBU('')}
                className="text-xs text-blue-400 hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <div style={{ width: '100%', height: 230 }}>
            {topBUsChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No BU records found</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={topBUsChartData}
                  margin={{ top: 16, right: 10, left: -20, bottom: 20 }}
                  onClick={state => {
                    if (state?.activePayload?.[0]?.payload?.name) {
                      setDrilldownBU(state.activePayload[0].payload.name);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val) => [`${val} units (Click to drill down)`, 'Consumption']}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="total" fill="#38bdf8" radius={[6, 6, 0, 0]} className="cursor-pointer">
                    <LabelList dataKey="total" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Parts in Selected BU */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                Parts in: <strong className="text-cyan-400">{partsInSelectedBUData.targetBU || 'Select BU'}</strong>
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Top parts consumed</p>
            </div>
            <select
              value={partsInSelectedBUData.targetBU}
              onChange={e => setDrilldownBU(e.target.value)}
              className={`min-h-[44px] text-xs px-2.5 py-1.5 rounded-2xl border backdrop-blur-md font-medium cursor-pointer ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <option value="" disabled>Change BU</option>
              {allBUs.map(bu => <option key={bu} value={bu}>{bu}</option>)}
            </select>
          </div>

          <div style={{ width: '100%', height: 210 }}>
            {partsInSelectedBUData.data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No parts in BU</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={partsInSelectedBUData.data} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val, name, item) => [`${val} units`, item?.payload?.fullCode || '']}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="quantity" fill="#06b6d4" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="quantity" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* BU-Wise ICSL */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              BU Wise ICSL Used
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Part Transaction = "ICSL"</p>
          </div>

          <div style={{ width: '100%', height: 210 }}>
            {buWiseICSLData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No ICSL records</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={buWiseICSLData} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} interval={0} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} fontSize={10} />
                  <Tooltip
                    formatter={(val) => [`${val} units ICSL`, 'ICSL Volume']}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Bar dataKey="total" fill="#fbbf24" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="total" position="top" fill={isDark ? "#f8fafc" : "#0f172a"} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* RMR Processed vs Closed */}
        <div className={`p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-lg min-w-0 flex flex-col justify-between ${
          isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                RMR Breakdown
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Part Transaction = "RMR"</p>
            </div>
            <select
              value={rmrChartBU}
              onChange={e => setRmrChartBU(e.target.value)}
              className={`min-h-[44px] text-xs px-2.5 py-1.5 rounded-2xl border backdrop-blur-md font-medium cursor-pointer ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All BUs</option>
              {allBUs.map(bu => <option key={bu} value={bu}>{bu}</option>)}
            </select>
          </div>

          <div style={{ width: '100%', height: 210 }}>
            {rmrStatusPieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No RMR data</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Tooltip
                    formatter={(val, name, item) => [`${val} orders (${item.payload.percent}%)`, name]}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '1rem',
                      fontSize: '11px'
                    }}
                  />
                  <Pie
                    data={rmrStatusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={40}
                    outerRadius={68}
                    paddingAngle={4}
                  >
                    {rmrStatusPieData.map((entry, index) => (
                      <Cell key={`rmr-${index}`} fill={RMR_COLORS[index % RMR_COLORS.length]} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    formatter={(value, entry) => (
                      <span className={isDark ? "text-slate-300 text-xs" : "text-slate-700 text-xs"}>
                        {value}: <strong>{entry.payload.value}</strong>
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* REQUISITION WORKSPACE */}
      <div className={`relative z-10 rounded-3xl border backdrop-blur-xl shadow-xl overflow-hidden ${
        isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/70 border-slate-200'
      }`}>
        <div className="p-3.5 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 border-inherit">
          <div className="flex items-center flex-wrap gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Req No, BU, Part Code..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className={`text-xs pl-9 pr-3.5 py-2.5 rounded-2xl border backdrop-blur-sm w-full focus:outline-hidden transition min-h-[44px] ${
                  isDark ? 'bg-slate-950/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-500'
                }`}
              />
            </div>

            <div className={`flex items-center p-1 rounded-2xl border ${
              isDark ? 'bg-slate-950/60 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Table
              </button>
            </div>
          </div>

          <span className="text-[11px] sm:text-xs text-slate-400">
            Page {currentPage} of {totalPages} ({filteredApprovals.length} records • Latest First)
          </span>
        </div>

        {viewMode === 'grid' ? (
          <div className="p-3.5 sm:p-5 max-h-[700px] overflow-y-auto">
            {paginated.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No matching requisitions found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {paginated.map((item) => (
                  <div
                    key={item.index_}
                    onClick={() => setModalState({ isOpen: true, item, isAdd: false })}
                    className={`rounded-2xl border backdrop-blur-md p-4 flex flex-col justify-between transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-xl cursor-pointer ${
                      isDark 
                        ? 'bg-slate-900/60 border-white/10 hover:border-purple-500/50 hover:bg-slate-800/80' 
                        : 'bg-white/80 border-slate-200 hover:border-purple-400 hover:bg-white'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          #{item.reqNumber}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(item.approvalStatus)}`}>
                          {item.approvalStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-semibold text-slate-300 truncate">
                          BU: <strong className="text-white">{item.buName}</strong>
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${getTransactionBadge(item.partTransaction)}`}>
                          {item.partTransaction}
                        </span>
                      </div>

                      <div className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                        isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Part Code:</span>
                          <span className="font-mono font-bold truncate max-w-[140px] text-slate-100" title={item.partCode}>
                            {item.partCode}
                          </span>
                        </div>

                        <div className="flex justify-between items-start text-[11px] gap-2 pt-0.5 border-t border-dashed border-white/10">
                          <span className="text-slate-400 shrink-0">Part Desc:</span>
                          <span className="text-right truncate max-w-[140px] font-medium text-slate-300" title={item.partDescription}>
                            {item.partDescription}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Task No:</span>
                          <span className="font-mono font-semibold text-slate-200" title={item.taskNo}>
                            {item.taskNo}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Tax Category:</span>
                          <span className="truncate max-w-[130px] font-medium text-slate-300" title={item.taxCategory}>
                            {item.taxCategory}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-inherit">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Qty:</span>
                            <span className="font-bold font-mono text-slate-200">{item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Price:</span>
                            <span className="font-bold text-emerald-400 font-mono">
                              ₹{item.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-inherit flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">{item.reqDate}</span>
                      <span className="font-bold text-purple-300 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30">
                        TL: {item.taskOwner}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className={`uppercase text-[10px] tracking-wider border-b border-inherit sticky top-0 backdrop-blur-md ${
                isDark ? 'bg-slate-900/90 text-slate-200' : 'bg-slate-100 text-slate-700 font-bold'
              }`}>
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap">Req No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Req Date</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">BU Name</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Task No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Part Code</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Tax Category</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Transaction</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Qty</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Price</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Approval</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">TL Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  paginated.map((row) => (
                    <tr
                      key={row.index_}
                      onClick={() => setModalState({ isOpen: true, item: row, isAdd: false })}
                      className="hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-purple-400 whitespace-nowrap">#{row.reqNumber}</td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-slate-300">{row.reqDate}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-200">{row.buName}</td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-amber-200">{row.taskNo}</td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap font-semibold text-slate-200">{row.partCode}</td>
                      <td className="py-3 px-3.5 max-w-[150px] truncate" title={row.taxCategory}>{row.taxCategory}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTransactionBadge(row.partTransaction)}`}>
                          {row.partTransaction}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap text-slate-200">{row.quantity}</td>
                      <td className="py-3 px-3.5 font-semibold text-emerald-400 whitespace-nowrap">₹{row.price.toLocaleString()}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(row.approvalStatus)}`}>
                          {row.approvalStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-bold text-purple-400">{row.taskOwner}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3.5 border-t border-inherit flex items-center justify-between text-xs text-slate-400">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-medium transition"
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-inherit disabled:opacity-30 hover:bg-white/10 cursor-pointer font-medium transition"
          >
            Next
          </button>
        </div>
      </div>

      {/* REQUISITION MODAL FORM - MOBILE OPTIMIZED (BOTTOM SHEET ON SMALL SCREENS) */}
      {modalState.isOpen && (
        <Requisition19ColModal
          item={modalState.item}
          isAdd={modalState.isAdd}
          nextReqNumber={modalState.isAdd ? nextReqNumber : (modalState.item?.reqNumber || '')}
          isDark={isDark}
          onClose={() => setModalState({ isOpen: false, item: null, isAdd: false })}
          onSave={handleSaveRequisition}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*             MODAL: 19-COLUMN ENTRY & EDIT FORM (GLASS / MOBILE)            */
/* -------------------------------------------------------------------------- */
function Requisition19ColModal({ item, isAdd, nextReqNumber, isDark, onClose, onSave }) {
  const initial = useMemo(() => {
    if (item && Array.isArray(item.rawRow)) return item.rawRow;
    if (item && item.rawRow && typeof item.rawRow === 'object') return Object.values(item.rawRow);
    return new Array(19).fill('');
  }, [item]);

  const defaultBU = initial[4] || PRESET_BU_LIST[0] || 'Ahmedabad';
  const defaultTaskOwner = initial[5] || PRESET_BU_TO_TL[defaultBU] || 'AKB';
  const defaultTransType = initial[13] || PRESET_TRANSACTION_TYPES[0] || 'BOM_BU_Transfer_Permanent_Ord';
  const defaultTax = initial[14] || TRANSACTION_TYPE_TO_TAX[defaultTransType] || 'Bom:Insterstate 18%';

  const [formData, setFormData] = useState({
    reqNumber: isAdd ? String(nextReqNumber) : (initial[0] !== undefined && initial[0] !== '' ? String(initial[0]) : String(nextReqNumber)),
    date: initial[1] ? formatDate(initial[1]) : formatDate(new Date()),
    orderNumber: initial[2] !== undefined ? String(initial[2]) : '',
    requesterComment: initial[3] !== undefined ? String(initial[3]) : '',
    buName: defaultBU,
    taskOwner: defaultTaskOwner,
    partCode: initial[6] !== undefined ? String(initial[6]) : '',
    partDescription: initial[7] !== undefined ? String(initial[7]) : '',
    quantity: initial[8] !== undefined && initial[8] !== '' ? String(initial[8]) : '1',
    price: initial[9] !== undefined && initial[9] !== '' ? String(initial[9]) : '0',
    taskNo: initial[10] !== undefined ? String(initial[10]) : '',
    orderedBy: initial[11] || PRESET_ORDERED_BY[0] || 'CSC',
    partTransaction: initial[12] || PRESET_PART_TRANSACTIONS[0] || 'RMR',
    transactionType: defaultTransType,
    taxCategory: defaultTax,
    approvalStatus: initial[15] || (isAdd ? 'Pending' : 'Approved'),
    status: initial[16] || 'Processed',
    statusDate: initial[17] ? formatDate(initial[17]) : formatDate(new Date()),
    remarks: initial[18] !== undefined ? String(initial[18]) : ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'buName') updated.taskOwner = PRESET_BU_TO_TL[value] || 'AKB';
      if (name === 'transactionType') updated.taxCategory = TRANSACTION_TYPE_TO_TAX[value] || 'Bom:Insterstate 18%';
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const rowArray = [
      formData.reqNumber,
      formatDate(formData.date),
      formData.orderNumber,
      formData.requesterComment,
      formData.buName,
      formData.taskOwner,
      formData.partCode,
      formData.partDescription,
      formData.quantity,
      formData.price,
      formData.taskNo,
      formData.orderedBy,
      formData.partTransaction,
      formData.transactionType,
      formData.taxCategory,
      formData.approvalStatus,
      formData.status,
      formatDate(formData.statusDate),
      formData.remarks
    ];
    onSave(rowArray, item ? item.index_ : null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className={`w-full max-w-2xl max-h-[90vh] sm:max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border backdrop-blur-2xl shadow-2xl ${
        isDark ? 'bg-slate-950/90 border-white/15 text-slate-100 shadow-purple-950/50' : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50'
      }`}>
        <div className="p-4 sm:p-5 border-b flex items-center justify-between border-inherit">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs sm:text-sm px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              #{formData.reqNumber}
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {isAdd ? 'Create Requisition' : `Edit Requisition #${formData.reqNumber}`}
            </h3>
          </div>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-4 text-xs flex-1 overscroll-contain">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Req No</label>
              <input
                type="text"
                name="reqNumber"
                value={formData.reqNumber}
                onChange={handleChange}
                placeholder="Req Number"
                required
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono font-bold ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Req Date</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Order Number</label>
              <input
                type="text"
                name="orderNumber"
                value={formData.orderNumber}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Task No</label>
              <input
                type="text"
                name="taskNo"
                value={formData.taskNo}
                onChange={handleChange}
                placeholder="Exact Task No"
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/5">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">BU Name</label>
              <select
                name="buName"
                value={formData.buName}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-medium ${
                  isDark ? 'bg-slate-900/80 border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {PRESET_BU_LIST.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Task Owner (TL)</label>
              <input
                type="text"
                name="taskOwner"
                value={formData.taskOwner}
                readOnly
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border font-bold cursor-not-allowed ${
                  isDark ? 'bg-slate-900/90 border-white/5 text-purple-400' : 'bg-slate-100 border-slate-200 text-purple-700'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Part Code</label>
              <input
                type="text"
                name="partCode"
                value={formData.partCode}
                onChange={handleChange}
                placeholder="Exact Part Code"
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-400 mb-1">Part Description</label>
              <input
                type="text"
                name="partDescription"
                value={formData.partDescription}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-bold ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Price</label>
              <input
                type="number"
                step="any"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-bold text-emerald-400 ${
                  isDark ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Ordered By</label>
              <select
                name="orderedBy"
                value={formData.orderedBy}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {PRESET_ORDERED_BY.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Transaction</label>
              <select
                name="partTransaction"
                value={formData.partTransaction}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {PRESET_PART_TRANSACTIONS.map(pt => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/5">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Transaction Type</label>
              <select
                name="transactionType"
                value={formData.transactionType}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-medium ${
                  isDark ? 'bg-slate-900/80 border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {PRESET_TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Tax Category</label>
              <input
                type="text"
                name="taxCategory"
                value={formData.taxCategory}
                readOnly
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border font-bold cursor-not-allowed ${
                  isDark ? 'bg-slate-900/90 border-white/5 text-emerald-400' : 'bg-slate-100 border-slate-200 text-emerald-700'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Approval Status</label>
              <select
                name="approvalStatus"
                value={formData.approvalStatus}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-bold ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-emerald-400' : 'bg-slate-50 border-slate-200 text-emerald-700'
                }`}
              >
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="On Hold">On Hold</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="Processed">Processed</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Status Date</label>
              <input
                type="text"
                name="statusDate"
                value={formData.statusDate}
                onChange={handleChange}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm font-mono ${
                  isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-400 mb-1">Requester Comment</label>
            <textarea
              name="requesterComment"
              rows={2}
              value={formData.requesterComment}
              onChange={handleChange}
              className={`w-full p-3 rounded-2xl border backdrop-blur-sm ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-400 mb-1">Remarks</label>
            <textarea
              name="remarks"
              rows={2}
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Internal remarks..."
              className={`w-full p-3 rounded-2xl border backdrop-blur-sm ${
                isDark ? 'bg-slate-900/60 border-white/10 text-slate-100 focus:border-purple-500' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          <div className="pt-3 border-t flex flex-col-reverse sm:flex-row justify-end gap-2 border-inherit">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-inherit text-xs font-semibold cursor-pointer hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:opacity-90 text-white font-bold text-xs shadow-lg shadow-purple-500/30 transition cursor-pointer"
            >
              Save Requisition
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}