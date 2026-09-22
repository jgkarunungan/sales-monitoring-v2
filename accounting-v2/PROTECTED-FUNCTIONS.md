# JGB ACCOUNTING V2 - PROTECTED FUNCTIONS MANIFEST

Once a function or logic path is marked **PROTECTED**, it must not be refactored or changed unless a task explicitly requires it.

## 1. NORMALIZATION & CLASSIFICATION
### `normalizePartnerType(type)`
*   **Module:** `normalization-service.js`
*   **Rule:** PISONET -> Pisonet, PISOWIFI/WIFI -> PisoWiFi (Case-insensitive).
*   **Status:** PASS
*   **Protected:** YES

### `normalizeExpenseCategory(label)`
*   **Module:** `normalization-service.js`
*   **Rule:** Map aliases like "Electricity (ALECO)" -> ALECO, "Internet (DCTV)" -> DCTV.
*   **Status:** PASS
*   **Protected:** YES

### `normalizeLog(rawDoc, partners)`
*   **Module:** `normalization-service.js`
*   **Rule:** Standardize 18+ fields; prioritize Firestore Timestamps over `dateStr`; enforce `share` = Owner Share.
*   **Status:** PASS
*   **Protected:** YES

## 2. ACCOUNTING LOGIC
### `filterLogsByPeriod(logs, period)`
*   **Module:** `accounting-service.js`
*   **Rule:** Default to CURRENT CALENDAR MONTH based on browser date. 
*   **Status:** PASS
*   **Protected:** YES

### Cabagñan Expense Routing
*   **Module:** `accounting-service.js`
*   **Rule:** Actual ALECO/DCTV from logs reduce branch profit. No projected expenses in profit.
*   **Status:** PASS
*   **Protected:** YES

### Iraya Settlement Logic
*   **Module:** `accounting-service.js`
*   **Rule:** Pisonet (50/50 owner/partner), PisoWiFi (100% owner), ALECO/DCTV (50/50 branch split).
*   **Status:** PASS
*   **Protected:** YES

### Partner PisoWiFi Filtering
*   **Module:** `accounting-service.js`
*   **Rule:** Exclude owner-operated branches (Cabagñan/Iraya) from remote partner groupings.
*   **Status:** PASS
*   **Protected:** YES

## 3. RECOVERY & SAVINGS
### `calculateBranchWaterfall(...)`
*   **Module:** `recovery-service.js`
*   **Rule:** Branch-scoped, ordered water-spill overflow. One rate per cycle.
*   **Status:** PASS
*   **Protected:** YES

### Savings Post-Recovery
*   **Module:** `accounting-service.js`
*   **Rule:** 5% of positive Profit After Recovery only.
*   **Status:** PASS
*   **Protected:** YES

## 4. UI RENDERING
### Safe Formatting (`money`, `safeText`)
*   **Module:** `dashboard-renderer.js`
*   **Rule:** Prevent "undefined", "null", or "NaN" in financial cells.
*   **Status:** PASS
*   **Protected:** YES

## 5. MANAGEMENT & SECURITY
### Transaction Log Renderer
*   **Module:** `dashboard-renderer.js`
*   **Rule:** Displays sortable, filtered history of all normalized logs.
*   **Status:** PASS
*   **Protected:** YES

### Login & Role Enforcement
*   **Module:** `data-service.js` / `ui-controller.js`
*   **Rule:** Restricts Edit/Manage actions to 'admin' role. 
*   **Status:** PASS
*   **Protected:** YES

### Audit Logging
*   **Module:** `settings-service.js`
*   **Rule:** Appends to `jgs_audit_logs` for all mutations. Never logs passwords.
*   **Status:** PASS
*   **Protected:** YES

## 6. TRANSACTION ENTRY (STAGE 4A)
### Income/Expense Forms
*   **Module:** `dashboard-renderer.js` / `ui-controller.js`
*   **Rule:** Functional entry with dynamic source loading and real-time preview.
*   **Status:** PASS
*   **Protected:** YES

### Payload Builders
*   **Module:** `transaction-service.js`
*   **Rule:** Implements Schema V2 (sourceId, ownerShare=sharePercent, createdBy).
*   **Status:** PASS
*   **Protected:** YES

### Prefill & Validation
*   **Module:** `ui-controller.js`
*   **Rule:** Standard validation for amounts/dates. "Quick Pay" pre-fills but does not alter projections.
*   **Status:** PASS
*   **Protected:** YES
