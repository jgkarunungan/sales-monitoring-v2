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

## 7. RECOVERY, SAVINGS & DEBTS REPAIR
### Recovery Status Logic & Active-vs-Paused Rule
*   **Module:** `recovery-service.js`
*   **Rule:** Missing lifecycle metadata defaults `paused` to `false`. First unfinished target is ACTIVE, later targets WAITING, explicit `paused: true` targets PAUSED, remaining 0 targets FULLY RECOVERED.
*   **Status:** PASS
*   **Protected:** YES

### Current Period Recovery Display & Default Period
*   **Module:** `recovery-service.js` / `dashboard-renderer.js` / `data-service.js`
*   **Rule:** Displays calculated recovery pool and allocations for current selected period (default: THIS MONTH). Shows zero-profit message when profit before recovery <= 0.
*   **Status:** PASS
*   **Protected:** YES

### Savings & Debts Navigation and Renderers
*   **Module:** `ui-controller.js` / `dashboard-renderer.js`
*   **Rule:** Unique page mappings for `savings` and `debts`. Savings page renders full branch savings breakdown; Debts page renders debt ledger or "No debts currently enrolled." message.
*   **Status:** PASS
*   **Protected:** YES

## 8. RECOVERY QUEUE MANAGEMENT
### Recovery Target Edit
*   **Module:** `settings-service.js` / `ui-controller.js`
*   **Rule:** Allows ADMIN to edit target details without altering target ID or historical recovery ledger entries.
*   **Status:** PASS
*   **Protected:** YES

### Recovery Target Safe Delete
*   **Module:** `settings-service.js` / `ui-controller.js`
*   **Rule:** Permanent deletion allowed ONLY if target has zero recovery history (openingRecovered == 0 and systemRecovered == 0).
*   **Status:** PASS
*   **Protected:** YES

### Recovery Target Archive
*   **Module:** `settings-service.js` / `ui-controller.js`
*   **Rule:** Targets with recovery history cannot be permanently deleted; they are archived, removed from active waterfall, and preserved in accounting history.
*   **Status:** PASS
*   **Protected:** YES

### Recovery Target Restore
*   **Module:** `settings-service.js` / `ui-controller.js`
*   **Rule:** ADMIN can restore archived targets, placing them safely at the end of their branch recovery queue without loss of history.
*   **Status:** PASS
*   **Protected:** YES

### Recovery Priority Editing
*   **Module:** `settings-service.js` / `recovery-service.js`
*   **Rule:** Priority is branch-scoped and re-sequenced sequentially (1, 2, 3...) with unique priority integers per branch.
*   **Status:** PASS
*   **Protected:** YES

### Recovery Historical Preservation
*   **Module:** `settings-service.js` / `recovery-service.js`
*   **Rule:** Editing recovery rate or target amount affects only future allocations; previously recorded historical recovery allocations remain untouched.
*   **Status:** PASS
*   **Protected:** YES

## 9. SOURCE SELF-RECOVERY ENGINE
### `calculateSourceSelfRecovery(sourceName, logs, assets)`
*   **Module:** `recovery-service.js`
*   **Rule:** Source self-recovery targets (like Coffee Vendo) recover opening costs strictly from their OWN positive operating profit (Gross Revenue minus Direct Expenses). General branch profit is never used to fund source self-recovery.
*   **Status:** PASS
*   **Protected:** YES

## 10. RECOVERY DATA ISOLATION & EMPTY STATE
### Empty Recovery Queue Authority
*   **Module:** `data-service.js` / `recovery-service.js` / `dashboard-renderer.js`
*   **Rule:** An empty recovery target list (`[]`) is an authoritative production state meaning "No targets enrolled". Production state MUST NEVER fall back to sample/mock default assets.
*   **Status:** PASS
*   **Protected:** YES

### Recovery Mode Exclusivity
*   **Module:** `recovery-service.js` / `dashboard-renderer.js`
*   **Rule:** Each recovery target belongs to EXACTLY ONE recovery funding mode (`SOURCE_SELF_RECOVERY` OR `BRANCH_RECOVERY`). General Branch Queue requires explicit `recoveryFundingMode === "BRANCH_RECOVERY"`.
*   **Status:** PASS
*   **Protected:** YES

## 11. DYNAMIC RECOVERY ENROLLMENT & SOURCE ISOLATION
### Recovery Target Enrollment
*   **Module:** `settings-service.js` / `ui-controller.js`
*   **Rule:** ADMIN can dynamically enroll new starting-cost items for any branch or source. Defaults to last priority in that recovery group queue.
*   **Status:** PASS
*   **Protected:** YES

### Recovery Funding Mode
*   **Module:** `settings-service.js` / `recovery-service.js`
*   **Rule:** Supports `SOURCE_SELF_RECOVERY` (funded by source earnings) and `BRANCH_RECOVERY` (funded by branch profit).
*   **Status:** PASS
*   **Protected:** YES

### Recovery Group Exclusivity
*   **Module:** `recovery-service.js` / `dashboard-renderer.js`
*   **Rule:** Every recovery target belongs to EXACTLY ONE recovery pool group (`targetAllocationSourcesCount === 1`). No target receives funding from multiple pools.
*   **Status:** PASS
*   **Protected:** YES

### Source-Specific Recovery & Dynamic Recovery Sources
*   **Module:** `recovery-service.js` / `accounting-service.js`
*   **Rule:** Dynamic source-specific recovery (e.g. Coffee Vendo 1 vs Coffee Vendo 2) keeps earnings and targets strictly isolated.
*   **Status:** PASS
*   **Protected:** YES

### No Automatic Asset Enrollment
*   **Module:** `data-service.js` / `transaction-service.js`
*   **Rule:** Recording an operating expense or income source does NOT automatically create a recovery target. Targets enter queue only via explicit user enrollment.
*   **Status:** PASS
*   **Protected:** YES

## 12. TRANSACTION LOG FILTERS & SEARCH
### Transaction Log Filter State
*   **Module:** `ui-controller.js`
*   **Rule:** Maintained in central `txLogFilters` state object preserving period, type, branch, source, partner, and search query during user navigation and real-time Firestore updates.
*   **Status:** PASS
*   **Protected:** YES

### Transaction Log Search
*   **Module:** `accounting-service.js` / `ui-controller.js`
*   **Rule:** Performs null-safe, case-insensitive multi-field search across label, partner, branch, source, category, ID, amount, and date.
*   **Status:** PASS
*   **Protected:** YES

### Transaction Log Period Filter
*   **Module:** `accounting-service.js`
*   **Rule:** Supports Today, Last 7 Days, This Month, This Year, Custom Range, and All Time based on transaction business date.
*   **Status:** PASS
*   **Protected:** YES

### Transaction Log Combined Filters
*   **Module:** `accounting-service.js` / `dashboard-renderer.js`
*   **Rule:** Evaluates Period, Type, Branch, Source, Partner, and Search sequentially, showing accurate `Showing X of Y transactions` count and empty result handling.
*   **Status:** PASS
*   **Protected:** YES

### Transaction Log Filter Persistence & Event Binding
*   **Module:** `ui-controller.js`
*   **Rule:** Event listeners safely rebind after DOM renders without losing active filter state or cursor focus on input controls during background Firestore snapshot updates.
*   **Status:** PASS
*   **Protected:** YES

## 13. DAYS SINCE LAST COLLECTION
### Days Since Last Collection Display
*   **Module:** `dashboard-renderer.js` / `accounting-service.js`
*   **Rule:** Displays `Last Collection Date`, `Days Since Last Collection` (`Today`, `1 day`, `X days`, `—`), and `Last Collection Amount` inline above transaction content while keeping search and filters at top.
*   **Status:** PASS
*   **Protected:** YES

