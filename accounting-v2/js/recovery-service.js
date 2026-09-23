/**
 * RECOVERY SERVICE - STAGE 2
 * Implements branch-scoped waterfall water-spill recovery engine and source self-recovery engine.
 * Operating entirely in-memory with safety checks for missing historical baseline opening states.
 */

export const RecoveryService = {
    calculateSourceSelfRecovery(sourceName, logs = [], assets = []) {
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

        // Default fallback if no custom assets enrolled for default Coffee Vendo
        if (sourceAssets.length === 0 && sourceName.toLowerCase() === "coffee vendo") {
            sourceAssets = [
                { id: "rec_coffee_machine", name: "Coffee Vendo Machine", cost: 20000, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo", recoveryFundingMode: "SOURCE_SELF_RECOVERY", priority: 1, openingRecovered: 0, paused: false },
                { id: "rec_metal_case", name: "Coffee Metal Case", cost: 8000, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo", recoveryFundingMode: "SOURCE_SELF_RECOVERY", priority: 2, openingRecovered: 0, paused: false }
            ];
        }

        sourceAssets.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

        const processedTargets = sourceAssets.map((asset, index) => {
            let opening = typeof asset.openingRecovered === 'number' ? asset.openingRecovered : (parseFloat(asset.openingRecovered) || 0);
            const cost = typeof asset.cost === 'number' ? asset.cost : (parseFloat(asset.cost) || 0);
            const remBefore = Math.max(0, cost - opening);
            const isPaused = asset.paused === true || asset.isPaused === true;

            return {
                ...asset,
                cost,
                openingRecovered: opening,
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
                if (!foundActiveUnfinished) {
                    status = "ACTIVE";
                    foundActiveUnfinished = true;
                } else {
                    status = "WAITING";
                }

                if (poolAvailable > 0) {
                    allocation = Math.min(poolAvailable, remBefore);
                    poolAvailable -= allocation;
                } else {
                    allocation = 0;
                }
            }

            const closing = opening + allocation;
            const remAfter = Math.max(0, cost - closing);

            allocatedTotal += allocation;
            allocations.push({
                id: target.id,
                name: target.name,
                branch: target.branch || "Cabagñan",
                source: target.source || sourceName,
                recoveryFundingMode: "SOURCE_SELF_RECOVERY",
                targetAmount: cost,
                openingRecovered: opening,
                currentPeriodAllocation: allocation,
                closingRecovered: closing,
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
        const totalRecoveredToDate = totalOpeningRecovered + allocatedTotal;
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
            totalRecoveredToDate,
            totalRemaining,
            progressPercent
        };
    },

    calculateBranchWaterfall(branchName, profitBeforeRecovery, assets = [], testModeOverride = false) {
        const result = {
            branch: branchName,
            recoveryPool: 0,
            rateUsed: 0,
            allocations: [],
            allocatedTotal: 0,
            profitAfterRecovery: profitBeforeRecovery
        };

        // Filter assets by branch (must use BRANCH_RECOVERY explicitly and NOT be a self-recovery target)
        let branchAssets = assets.filter(a => a && a.branch && a.branch.toLowerCase() === branchName.toLowerCase() && !a.archived && a.recoveryFundingMode === "BRANCH_RECOVERY");

        // Sort by priority if defined
        branchAssets.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

        // Process targets: baseline openingRecovered and pause flags
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
            const remainingBefore = Math.max(0, cost - openingRecovered);
            const isPaused = asset.paused === true || asset.isPaused === true;

            return {
                ...asset,
                priority: index + 1,
                cost: cost,
                openingRecovered: openingRecovered,
                remainingBefore: remainingBefore,
                isPaused: isPaused
            };
        });

        // Find first active (unfinished AND non-paused) target to determine cycle recovery rate
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
                if (!foundActiveUnfinished) {
                    status = "ACTIVE";
                    foundActiveUnfinished = true;
                } else {
                    status = "WAITING";
                }

                if (poolAvailable > 0) {
                    allocation = Math.min(poolAvailable, remBefore);
                    poolAvailable -= allocation;
                } else {
                    allocation = 0;
                }
            }

            const closing = opening + allocation;
            const remAfter = Math.max(0, cost - closing);

            result.allocatedTotal += allocation;
            result.allocations.push({
                id: target.id,
                name: target.name,
                branch: target.branch || branchName,
                targetAmount: cost,
                openingRecovered: opening,
                currentPeriodAllocation: allocation,
                closingRecovered: closing,
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
    }
};
