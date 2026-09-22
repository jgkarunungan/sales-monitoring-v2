# JGB ACCOUNTING V2 - REGRESSION TEST SUITE

Perform all tests before marking any new task complete.

## DATA INTEGRITY
- [ ] Raw records count == Normalized records count
- [ ] Expense conservation (Full == Owner + Partner)
- [ ] Revenue conservation (Gross == Owner + Partner)
- [ ] Duplicate check (Multiple Groups == 0)
- [ ] No lost expense transactions

## BRANCH ACCOUNTING
- [ ] Cabagñan: PisoWiFi counted only in branch (NOT in partners)
- [ ] Iraya: PisoWiFi counted only in branch (NOT in partners)
- [ ] Iraya: Pisonet revenue split 50/50
- [ ] Iraya: ALECO/DCTV split 50/50
- [ ] Cabagñan: ALECO/DCTV actuals reduce profit
- [ ] No projected expenses used in actual profit calculation

## PARTNER ACCOUNTING
- [ ] Partner PisoWiFi: Excludes Cabagñan/Iraya locations
- [ ] Partner PisoWiFi: "Injoy" not in group
- [ ] Share Semantics: 0.40 == 40% Owner / 60% Partner
- [ ] Ligao 40/60 ownership split verification
- [ ] Tabaco 45/55 ownership split verification

## ENGINES
- [ ] Recovery: Waterfall spill (Target 1 fill -> Target 2 overflow)
- [ ] Savings: Calculated post-recovery
- [ ] Savings: Negative profit generates 0 savings

## UI/UX
- [ ] Default Filter: THIS MONTH (Current Browser Date)
- [ ] No "undefined" text
- [ ] No "NaN" or "₱NaN"
- [ ] Missing history marked "Opening history required"
