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

## MONTHLY RECOVERY CARRY-FORWARD
- [ ] Current month recovery allocation is dynamic (provisional)
- [ ] Closed month recovery allocation is locked in Firestore ledger
- [ ] Confirmed recovery carries forward correctly into subsequent months
- [ ] Idempotent month rollover (no duplicate ledger entries created on refresh or restart)
- [ ] Backdated transactions in locked closed months flag `RECALCULATION REQUIRED`
- [ ] Admin explicit recalculation and re-locking works cleanly
- [ ] No double counting of current month provisional in confirmed recovered
- [ ] Baseline `openingRecovered` preserved and never overwritten

## COFFEE VENDO STARTUP RECOVERY
- [ ] Recovery treated as accounting coverage measurement, NOT cash payment
- [ ] Provisional recovery adjusts dynamically with current month income/expenses
- [ ] Recovery capped at remaining recoverable cost (no over-recovery beyond cost)
- [ ] Target status reaches `FULLY RECOVERED` when cost is 100% covered
- [ ] After full recovery, future recovery contribution = ₱0.00
- [ ] After full recovery, 100% of Coffee Operating Profit flows to business earnings
- [ ] Multiple targets waterfall correctly in source self-recovery queue
- [ ] Mid-pool completion of all targets leaves surplus in business earnings
- [ ] Negative or zero Coffee Operating Profit generates ₱0.00 recovery contribution
- [ ] Coffee self-recovery deducted only at source level (no double deduction at branch level)

