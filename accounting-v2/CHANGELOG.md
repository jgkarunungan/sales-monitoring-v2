# JGB ACCOUNTING V2 - CHANGELOG

## [1.0.13] - Coffee Vendo Self-Recovery Finalization
### Added
- Refined Coffee Vendo `SOURCE_SELF_RECOVERY` accounting coverage engine in `recovery-service.js`.
- Capped recovery contribution calculation (`actualRecoveryContribution = min(provisionalRecoveryPool, remainingRecoverableCost)`).
- Full recovery completion transition: when 100% startup cost is covered, recovery contribution becomes ₱0.00 and 100% of Coffee Operating Profit flows directly to business earnings.
- Comprehensive test suite in `settings-service.js` verifying open month provisional recovery, direct expense changes, recovery caps, mid-pool target completion, multiple target waterfalls, post-recovery 100% profit flow, and accounting invariants.
- Updated Recovery Queue UI in `dashboard-renderer.js` with clear accounting terminology (Startup Cost, Cost Covered, Recovery Contribution, Remaining Cost to Recover, Coffee Operating Profit, Coffee Contribution to Business).

### Changed
- `recovery-service.js`: Refined target status assignment in `calculateSourceSelfRecovery` and `calculateBranchWaterfall` to handle mid-pool completion correctly.
- `dashboard-renderer.js`: Replaced misleading terminology ("Paid Back", "Payback Progress") with standardized accounting terms ("Cost Covered", "Startup Cost Recovery Progress"). Added completion banner when target is FULLY RECOVERED.
- `settings-service.js`: Expanded `runCoffeeSelfRecoveryTests()` to cover all required verification tests (Sections 27-35).

### Tests Passed
- Normal Open Month Test: PASS.
- Expense Change Test: PASS.
- Recovery Cap Test: PASS.
- Fully Recovered Next Month Test: PASS.
- No Targets Test: PASS.
- Multiple Target Waterfall Test: PASS.
- All Targets Complete Mid-Pool Test: PASS.
- Accounting Invariants Test: PASS.
- Negative / Zero Operating Profit Test: PASS.
- Full Regression Test Suite: ALL PASS.

## [1.0.12] - Phase 2 Monthly Recovery Carry-Forward
### Added
- Durable monthly recovery carry-forward engine in `recovery-service.js`.
- Automatic month rollover detection and idempotent period finalization into Firestore `recoveryLedger`.
- Backdated transaction protection flagging closed periods as `RECALCULATION REQUIRED` with explicit Admin recalculation trigger.
- Clear distinction in Recovery Queue UI between Original Cost, Recovered Through Closed Months, Current Month Provisional, Projected Total Recovered, and Projected Remaining Balance.

### Changed
- `recovery-service.js`: Added `getConfirmedRecovered`, `finalizeMonthRecovery`, `checkAndRolloverClosedMonths`.
- `data-service.js`: Integrated `recoveryLedger` real-time sync and automatic month rollover.
- `accounting-service.js`: Updated recovery calculations to incorporate locked recovery ledger history.
- `transaction-service.js`: Integrated `checkBackdatedTransactionPolicy` to flag closed periods when backdated entries occur.
- `settings-service.js`: Added `flagRecoveryPeriodForRecalculation`, `recalculateAndLockPeriod`, and test suite `runPhase2RecoveryTests`.
- `dashboard-renderer.js` & `ui-controller.js`: Updated Recovery Queue UI rendering with carry-forward fields, labels, and recalculation action.

### Tests Passed
- Month Rollover Test: PASS.
- Current Profit Change Test: PASS.
- Historical Immutability Test: PASS.
- Refresh / Restart Persistence Test: PASS.
- Duplicate Finalization Protection Test: PASS.
- Full Regression Test Suite: ALL PASS.

## [1.0.11] - 2026-03-30
### Added
- Future-date protection during transaction entry with confirmation prompt.
- Authoritative date parsing & DD/MM/YYYY vs MM/DD/YYYY disambiguation in `normalization-service.js`.

### Changed
- `index.html`: Platform version updated to v1.0.11.
- `transaction-service.js`: Standardized saving `transactionDate` and `dateStr` as explicit YYYY-MM-DD format.
- `normalization-service.js`: Improved legacy date parser to prevent current-year guessing.

### Fixed
- Fixed historical date interpretation issue for legacy transactions (e.g. DD/MM/YYYY entries distorting future months).
- Corrected record date integrity and verified 0 distortion in October 2026.

## [2023-11-20] - Expense & Partner Classification Fix
### Changed
- `normalization-service.js`: Added missing `label` property to normalized objects. Improved branch exclusion logic for PisoWiFi. Added `normalizeExpenseCategory` for ALECO/DCTV mapping.
- `accounting-service.js`: Standardized ViewModel for branch expenses. Fixed Iraya 50/50 owner/partner settlement breakdown.
- `dashboard-renderer.js`: Replaced "Pending" with live data. Implemented settlement panels and safe formatting.

### Fixed
- Fixed "undefined" display in Iraya ALECO/DCTV rows.
- Fixed Cabagñan actual expenses not reflecting in summary.
- Fixed "Injoy" appearing as a PisoWiFi partner.
- Prevented Cabagñan/Iraya PisoWiFi machines from double-counting in Partner PisoWiFi.

### Tests Passed
- Duplicate check: 0 duplicates.
- Revenue conservation: PASS.
- Ligao/Tabaco/Iraya ownership tests: PASS.
- Savings & Recovery math: PASS.

## [2023-11-21] - Stage 3B Management System
### Added
- `settings-service.js`: Created for Partner, Bill, User, and Income Source CRUD.
- `jgs_audit_logs`: New collection for tracking system changes.
- Transaction Log page with filtering and deep details view.
- User Login system with Admin/User role permissions.
- Dynamic Income Source registry support in settings and accounting.

### Changed
- `firebase-config.js`: Enabled write APIs (`addDoc`, `updateDoc`, `setDoc`).
- `transaction-service.js`: Implemented `updateTransaction` with audit trail.
- `accounting-service.js`: Added `filterLogs` helper and dynamic source support for Cabagñan.
- `dashboard-renderer.js`: Implemented Log view, tabbed Settings, and Transaction Detail modals.

### Fixed
- Fixed date parsing fallback for logs missing Firestore timestamps.

### Tests Passed
- Regression Suite: ALL PASS.
- Transaction Edit Audit: PASS.
- User Security (No passwords in logs): PASS.
- New Income Source (Coffee Vendo 2): PASS.

## [2023-11-22] - Stage 4A Complete Transaction Entry
### Added
- Fully operational Record Income form with dynamic source/partner selection.
- Fully operational Record Expense form with branch/source/shared classification.
- "Quick Pay" upcoming bill pre-fill helper.
- Real-time transaction preview panel (Owner vs Partner shares).
- Duplicate submit guard and status feedback.

### Changed
- `transaction-service.js`: Implemented `recordIncome` and `recordExpense` with Schema V2.
- `ui-controller.js`: Added comprehensive form logic and validation.
- `dashboard-renderer.js`: Replaced entry placeholders with functional forms.

### Tests Passed
- Dry Run A (Cabagnan 100%): PASS.
- Dry Run B (Iraya 50/50): PASS.
- Dry Run C (Partner 40/60): PASS.
- Dry Run D/E (Bills): PASS.
- Regression Suite: ALL PASS.
