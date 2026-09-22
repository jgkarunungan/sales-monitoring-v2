# JGB ACCOUNTING V2 - CHANGELOG

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
