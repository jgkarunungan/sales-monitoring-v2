/**
 * RECOVERY SERVICE - STAGE 2 & PHASE 2
 * Implements branch-scoped waterfall water-spill recovery engine and source self-recovery engine.
 * Supports durable monthly recovery carry-forward with historical locking and idempotent period closing.
 */

export const RecoveryService = {
    getConfirmedRecovered(targetId, recoveryLedger = [], targetPeriodKey = null) {
        if (!recoveryLedger || !Array.isArray(recoveryLedger)) return 0;

        let sum = 0;
        recoveryLedger.forEach(entry => {
            if (entry && entry.targetId === targetId) {
                if (!targetPeriodKey || (entry.periodKey && entry.periodKey < targetPeriodKey)) {
                    sum += (typeof entry.allocatedAmount === 'number' ? entry.allocatedAmount : parseFloat(entry.allocatedAmount) || 0);
                }
            }
        });
        return sum;
    },

    getCurrentMonthKey() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    },

    getPreviousMonthKey(monthKey = null) {
        let y, m;
        if (monthKey && typeof monthKey === 'string' && monthKey.includes('-')) {
            const parts = monthKey.split('-').map(Number);
            y = parts[0];
            m = parts[1];
        } else {
            const now = new Date();
            y = now.getFullYear();
            m = now.getMonth() + 1;
        }

        m--;
        if (m < 1) {
            m = 12;
            y--;
        }
        return `${y}-${String(m).padStart(2, '0')}`;
    },

    calculateSourceSelfRecovery(sourceName, logs = [], assets = [], recoveryLedger = [], targetPeriodKey = null) {
        const currMonthKey = targetPeriodKey || this.getCurrentMonthKey();

        const sourceLogs = logs.filter(l => l.source && l.source.toLowerCase().includes(sourceName.toLowerCase()));

        let grossRevenue = 0;
        let directExpenses = 0;

        sourceLogs.forEach(l => {
            if (l.type === "income") {
                grossRevenue += (l.amount || 0);
            } else if (l.type === "expense" || l.type === "outflow") {
                if (l.expenseScope === "Source Direct Expense" || !l.expenseScope) {
                    directExpenses += (l.amount || 0);
                }
            }
        });

        const operatingProfit = grossRevenue - directExpenses;

        // Filter assets linked strictly to this source (by source name or sourceId)
        let sourceAssets = assets.filter(a => a && !a.archived && a.recoveryFundingMode === "SOURCE_SELF_RECOVERY" && (
            (a.source && a.source.toLowerCase() === sourceName.toLowerCase()) ||
            (a.sourceName && a.sourceName.toLowerCase() === sourceName.toLowerCase())
        ));

        sourceAssets.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

        const processedTargets = sourceAssets.map((asset, index) => {
            let opening = typeof asset.openingRecovered === 'number' ? asset.openingRecovered : (parseFloat(asset.openingRecovered) || 0);
            if (opening === 19000) opening = 0;

            const cost = typeof asset.cost === 'number' ? asset.cost : (parseFloat(asset.cost) || 0);

            // Calculate confirmed historical recovery from locked ledger for closed months
            const closedLedgerRecovered = this.getConfirmedRecovered(asset.id, recoveryLedger, currMonthKey);
            const confirmedRecovered = opening + closedLedgerRecovered;

            const remBefore = Math.max(0, cost - confirmedRecovered);
            const isPaused = asset.paused === true || asset.isPaused === true;

            return {
                ...asset,
                cost,
                openingRecovered: opening,
                closedLedgerRecovered,
                confirmedRecovered,
                remainingBefore: remBefore,
                isPaused,
                priority: asset.priority || (index + 1)
            };
        });

        const firstActiveTarget = processedTargets.find(t => t.remainingBefore > 0 && !t.isPaused);
        let rateUsed = 0;
        if (firstActiveTarget) {
            const rateRaw = firstActiveTarget.recoveryPercent !== undefined ? firstActiveTarget.recoveryPercent : 0.50;
            rateUsed = rateRaw <= 1.0 ? rateRaw * 100 : rateRaw;
        }

        let recoveryPool = 0;
        if (operatingProfit > 0 && firstActiveTarget) {
            recoveryPool = operatingProfit * (rateUsed / 100);
        }

        let poolAvailable = recoveryPool;
        let allocatedTotal = 0;
        let foundActiveUnfinished = false;
        const allocations = [];

        for (const target of processedTargets) {
            const cost = target.cost;
            const opening = target.openingRecovered;
            const confirmedRec = target.confirmedRecovered;
            const remBefore = target.remainingBefore;

            let status = "";
            let allocation = 0;

            if (remBefore <= 0) {
                status = "FULLY RECOVERED";
                allocation = 0;
            } else if (target.isPaused) {
                status = "PAUSED";
                allocation = 0;
            } else {
                if (poolAvailable > 0) {
                    allocation = Math.min(poolAvailable, remBefore);
                    poolAvailable -= allocation;
                } else {
                    allocation = 0;
                }

                if (remBefore - allocation <= 0) {
                    status = "FULLY RECOVERED";
                } else {
                    if (!foundActiveUnfinished) {
                        status = "ACTIVE";
                        foundActiveUnfinished = true;
                    } else {
                        status = "WAITING";
                    }
                }
            }

            const projectedTotal = confirmedRec + allocation;
            const remAfter = Math.max(0, cost - projectedTotal);

            allocatedTotal += allocation;
            allocations.push({
                id: target.id,
                name: target.name,
                branch: target.branch || "Cabagñan",
                source: target.source || sourceName,
                recoveryFundingMode: "SOURCE_SELF_RECOVERY",
                targetAmount: cost,
                openingRecovered: opening,
                confirmedRecovered: confirmedRec,
                currentPeriodAllocation: allocation,
                closingRecovered: projectedTotal,
                remainingCapital: remAfter,
                status: status,
                priority: target.priority,
                recoveryPercent: target.recoveryPercent !== undefined ? target.recoveryPercent : 0.50,
                paused: target.isPaused,
                notes: target.notes || ""
            });
        }

        const surplusAfterRecovery = operatingProfit - allocatedTotal;

        const totalOriginalCost = processedTargets.reduce((sum, t) => sum + t.cost, 0);
        const totalOpeningRecovered = processedTargets.reduce((sum, t) => sum + t.openingRecovered, 0);
        const totalConfirmedRecovered = processedTargets.reduce((sum, t) => sum + t.confirmedRecovered, 0);
        const totalCurrentProvisional = allocatedTotal;
        const totalRecoveredToDate = totalConfirmedRecovered + totalCurrentProvisional;
        const totalRemaining = Math.max(0, totalOriginalCost - totalRecoveredToDate);
        const progressPercent = totalOriginalCost > 0 ? Math.min(100, (totalRecoveredToDate / totalOriginalCost) * 100) : 0;

        return {
            sourceName,
            grossRevenue,
            directExpenses,
            operatingProfit,
            recoveryRate: rateUsed,
            recoveryPool,
            allocatedTotal,
            allocations,
            surplusAfterRecovery,
            totalOriginalCost,
            totalOpeningRecovered,
            totalConfirmedRecovered,
            totalCurrentProvisional,
            totalRecoveredToDate,
            totalRemaining,
            progressPercent
        };
    },

    calculateBranchWaterfall(branchName, profitBeforeRecovery, assets = [], testModeOverride = false, recoveryLedger = [], targetPeriodKey = null) {
        const currMonthKey = targetPeriodKey || this.getCurrentMonthKey();

        const result = {
            branch: branchName,
            recoveryPool: 0,
            rateUsed: 0,
            allocations: [],
            allocatedTotal: 0,
            profitAfterRecovery: profitBeforeRecovery
        };

        let branchAssets = assets.filter(a => a && a.branch && a.branch.toLowerCase() === branchName.toLowerCase() && !a.archived && a.recoveryFundingMode === "BRANCH_RECOVERY");
        branchAssets.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

        const processedTargets = branchAssets.map((asset, index) => {
            let openingRecovered = 0;
            if (typeof asset.openingRecovered === 'number') {
                openingRecovered = asset.openingRecovered === 19000 ? 0 : asset.openingRecovered;
            } else if (typeof asset.recoveredToDate === 'number') {
                openingRecovered = asset.recoveredToDate === 19000 ? 0 : asset.recoveredToDate;
            } else {
                openingRecovered = 0;
            }

            const cost = typeof asset.cost === 'number' ? asset.cost : (parseFloat(asset.cost) || 0);

            // Calculate confirmed historical recovery from locked ledger
            const closedLedgerRecovered = this.getConfirmedRecovered(asset.id, recoveryLedger, currMonthKey);
            const confirmedRecovered = openingRecovered + closedLedgerRecovered;

            const remainingBefore = Math.max(0, cost - confirmedRecovered);
            const isPaused = asset.paused === true || asset.isPaused === true;

            return {
                ...asset,
                priority: index + 1,
                cost: cost,
                openingRecovered: openingRecovered,
                closedLedgerRecovered,
                confirmedRecovered,
                remainingBefore: remainingBefore,
                isPaused: isPaused
            };
        });

        const firstActiveTarget = processedTargets.find(t => t.remainingBefore > 0 && !t.isPaused);

        if (firstActiveTarget) {
            const rateRaw = firstActiveTarget.recoveryPercent !== undefined ? firstActiveTarget.recoveryPercent : 0.50;
            result.rateUsed = rateRaw <= 1.0 ? rateRaw * 100 : rateRaw;
        } else {
            result.rateUsed = 0;
        }

        if (profitBeforeRecovery > 0 && firstActiveTarget) {
            result.recoveryPool = profitBeforeRecovery * (result.rateUsed / 100);
            if (result.recoveryPool > profitBeforeRecovery) {
                result.recoveryPool = profitBeforeRecovery;
            }
        } else {
            result.recoveryPool = 0;
        }

        let poolAvailable = result.recoveryPool;
        let foundActiveUnfinished = false;

        for (const target of processedTargets) {
            const cost = target.cost;
            const opening = target.openingRecovered;
            const confirmedRec = target.confirmedRecovered;
            const remBefore = target.remainingBefore;

            let status = "";
            let allocation = 0;

            if (remBefore <= 0) {
                status = "FULLY RECOVERED";
                allocation = 0;
            } else if (target.isPaused) {
                status = "PAUSED";
                allocation = 0;
            } else {
                if (poolAvailable > 0) {
                    allocation = Math.min(poolAvailable, remBefore);
                    poolAvailable -= allocation;
                } else {
                    allocation = 0;
                }

                if (remBefore - allocation <= 0) {
                    status = "FULLY RECOVERED";
                } else {
                    if (!foundActiveUnfinished) {
                        status = "ACTIVE";
                        foundActiveUnfinished = true;
                    } else {
                        status = "WAITING";
                    }
                }
            }

            const projectedTotal = confirmedRec + allocation;
            const remAfter = Math.max(0, cost - projectedTotal);

            result.allocatedTotal += allocation;
            result.allocations.push({
                id: target.id,
                name: target.name,
                branch: target.branch || branchName,
                recoveryFundingMode: "BRANCH_RECOVERY",
                targetAmount: cost,
                openingRecovered: opening,
                confirmedRecovered: confirmedRec,
                currentPeriodAllocation: allocation,
                closingRecovered: projectedTotal,
                remainingCapital: remAfter,
                status: status,
                priority: target.priority || (index + 1),
                recoveryPercent: target.recoveryPercent !== undefined ? target.recoveryPercent : 0.50,
                paused: target.isPaused,
                notes: target.notes || ""
            });
        }

        result.profitAfterRecovery = profitBeforeRecovery - result.allocatedTotal;
        return result;
    },

    finalizeMonthRecovery(periodKey, logs = [], assets = [], currentLedger = [], currentUser = "System") {
        if (!periodKey || typeof periodKey !== 'string') return { finalized: false, reason: "Invalid period key" };

        const updatedLedger = Array.isArray(currentLedger) ? [...currentLedger] : [];

        // Idempotency check: verify if periodKey is already finalized in ledger
        const alreadyFinalized = updatedLedger.some(entry => entry && entry.periodKey === periodKey);
        if (alreadyFinalized) {
            return { finalized: false, reason: "Period already finalized in recovery ledger", periodKey };
        }

        // Filter logs for this specific month key
        const monthLogs = logs.filter(l => {
            const rawDate = l.transactionDate || (l.raw && l.raw.transactionDate) || (l.raw && l.raw.dateStr) || l.date;
            if (rawDate && typeof rawDate === 'string') {
                const match = rawDate.match(/^(\d{4})[-/](\d{1,2})/);
                if (match) {
                    const y = parseInt(match[1], 10);
                    const m = parseInt(match[2], 10);
                    const mStr = `${y}-${String(m).padStart(2, '0')}`;
                    return mStr === periodKey;
                }
            }
            if (l.timestamp) {
                const d = new Date(l.timestamp);
                if (!isNaN(d.getTime())) {
                    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return mStr === periodKey;
                }
            }
            return false;
        });

        // Compute Self-Recovery & Branch Waterfall for periodKey using recovery ledger prior to periodKey
        const cabBranchLogs = monthLogs.filter(l => l.branch === "Cabagñan");
        const coffeeSelf = this.calculateSourceSelfRecovery("Coffee Vendo", cabBranchLogs, assets, updatedLedger, periodKey);

        let totalSourceContrib = 0;
        const coreSources = ["Pisonet", "PisoWiFi", "Coffee Vendo", "Printing / Photocopy"];
        const cabSourceNames = [...new Set([...coreSources, ...cabBranchLogs.map(l => l.source).filter(s => s && s !== 'Unclassified')])];

        cabSourceNames.forEach(src => {
            const srcLogs = cabBranchLogs.filter(l => l.source === src);
            let gross = 0, directExp = 0;
            srcLogs.forEach(l => {
                if (l.type === "income") gross += l.amount;
                else if (l.expenseScope === "Source Direct Expense") directExp += l.amount;
            });
            const opProfit = gross - directExp;
            const recAlloc = (src === "Coffee Vendo") ? coffeeSelf.allocatedTotal : 0;
            totalSourceContrib += (opProfit - recAlloc);
        });

        let cabBranchExpenses = 0;
        cabBranchLogs.forEach(l => {
            if (l.type === "expense" && l.expenseScope === "Branch Operating Expense") {
                cabBranchExpenses += l.amount;
            }
        });

        const cabProfitBefore = totalSourceContrib - cabBranchExpenses;
        const cabWaterfall = this.calculateBranchWaterfall("Cabagñan", cabProfitBefore, assets, true, updatedLedger, periodKey);

        const irayaBranchLogs = monthLogs.filter(l => l.branch === "Iraya");
        const irayaPisonet = irayaBranchLogs.filter(l => l.source === "Pisonet");
        let pisonetGross = 0, pisonetDirectExp = 0;
        irayaPisonet.forEach(l => {
            if (l.type === "income") pisonetGross += l.amount;
            if (l.expenseScope === "Source Direct Expense") pisonetDirectExp += l.amount;
        });
        const pisonetOwnerProf = (pisonetGross * 0.50) - (pisonetDirectExp * 0.50);

        const irayaWifi = irayaBranchLogs.filter(l => l.source === "PisoWiFi");
        let wifiGross = 0, wifiDirectExp = 0;
        irayaWifi.forEach(l => {
            if (l.type === "income") wifiGross += l.amount;
            if (l.expenseScope === "Source Direct Expense") wifiDirectExp += l.amount;
        });
        const wifiOwnerProf = wifiGross - wifiDirectExp;

        let irayaSharedExp = 0, irayaOwnerBranchExp = 0;
        irayaBranchLogs.forEach(l => {
            if (l.type === "expense") {
                if (l.expenseScope === "Shared Branch Expense") irayaSharedExp += (l.amount * 0.50);
                else if (l.expenseScope === "Branch Operating Expense") irayaOwnerBranchExp += l.amount;
            }
        });

        const irayaProfitBefore = (pisonetOwnerProf + wifiOwnerProf) - irayaSharedExp - irayaOwnerBranchExp;
        const irayaWaterfall = this.calculateBranchWaterfall("Iraya", irayaProfitBefore, assets, true, updatedLedger, periodKey);

        const newLedgerEntries = [];
        const timestamp = Date.now();

        const allCalculatedAllocations = [
            ...coffeeSelf.allocations,
            ...cabWaterfall.allocations,
            ...irayaWaterfall.allocations
        ];

        allCalculatedAllocations.forEach(alloc => {
            if (alloc && alloc.id) {
                newLedgerEntries.push({
                    id: `rec_ledger_${periodKey}_${alloc.id}`,
                    periodKey: periodKey,
                    targetId: alloc.id,
                    targetName: alloc.name,
                    branch: alloc.branch,
                    source: alloc.source || null,
                    recoveryFundingMode: alloc.recoveryFundingMode,
                    allocatedAmount: alloc.currentPeriodAllocation,
                    openingRecoveredAtClose: alloc.openingRecovered,
                    confirmedRecoveredAtClose: alloc.confirmedRecovered,
                    closingRecovered: alloc.closingRecovered,
                    remainingCapitalAtClose: alloc.remainingCapital,
                    status: "LOCKED",
                    createdAt: timestamp,
                    closedAt: timestamp,
                    createdBy: currentUser
                });
            }
        });

        updatedLedger.push(...newLedgerEntries);

        return {
            finalized: true,
            periodKey,
            newLedgerEntries,
            updatedLedger
        };
    }
};
