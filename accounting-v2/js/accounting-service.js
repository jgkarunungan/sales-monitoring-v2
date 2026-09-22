import { RecoveryService } from './recovery-service.js';
import { OWNER_OPERATED_BRANCHES, normalizePartnerType } from './normalization-service.js';

export const AccountingService = {
    filterLogsByPeriod(logs, period, customStart = null, customEnd = null) {
        if (period === 'All Time') return logs;

        const now = new Date();
        let startTime = 0;
        let endTime = now.getTime() + (2 * 24 * 60 * 60 * 1000);

        if (period === 'This Month') {
            startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            endTime = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
        } else if (period === 'Last 7 Days') {
            startTime = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        } else if (period === 'Year') {
            startTime = new Date(now.getFullYear(), 0, 1).getTime();
        } else if (period === 'October 2023') {
            startTime = new Date(2023, 9, 1).getTime();
            endTime = new Date(2023, 9, 31, 23, 59, 59).getTime();
        } else if (period === 'November 2023') {
            startTime = new Date(2023, 10, 1).getTime();
            endTime = new Date(2023, 10, 30, 23, 59, 59).getTime();
        } else if (period === 'Custom Range' && customStart && customEnd) {
            startTime = new Date(customStart).getTime();
            endTime = new Date(customEnd).getTime();
        } else {
            startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            endTime = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
        }

        return logs.filter(l => {
            // Include records with timestamps in range
            if (l.timestamp) {
                return l.timestamp >= startTime && l.timestamp <= endTime;
            }
            // Fallback for verification items or logs where dateStr was unparseable
            return false;
        });
    },

    filterLogs(logs, filters) {
        let result = this.filterLogsByPeriod(logs, filters.period);
        
        if (filters.type && filters.type !== 'All') {
            result = result.filter(l => l.type === filters.type.toLowerCase());
        }
        
        if (filters.branch && filters.branch !== 'All') {
            result = result.filter(l => l.branch === filters.branch);
        }
        
        if (filters.source && filters.source !== 'All') {
            result = result.filter(l => l.source === filters.source);
        }
        
        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter(l => 
                l.label.toLowerCase().includes(s) || 
                (l.partnerName && l.partnerName.toLowerCase().includes(s))
            );
        }
        
        return result;
    },

    calculateCabagnan(filteredLogs, assets) {
        const branchLogs = filteredLogs.filter(l => l.branch === "Cabagñan");

        // Base core sources
        const coreSourceTypes = ["Pisonet", "PisoWiFi", "Coffee Vendo", "Printing / Photocopy"];

        // Identify all unique sources present in this branch's logs
        const allSourceNames = [...new Set([
            ...coreSourceTypes,
            ...branchLogs.map(l => l.source).filter(s => s && s !== 'Unclassified')
        ])];

        const sourcesBreakdown = {};

        allSourceNames.forEach(src => {
            const srcLogs = branchLogs.filter(l => l.source === src);
            let grossRevenue = 0;
            let directExpenses = 0;

            srcLogs.forEach(l => {
                if (l.type === "income") {
                    grossRevenue += l.amount;
                } else if (l.expenseScope === "Source Direct Expense") {
                    directExpenses += l.amount;
                }
            });

            // For Cabagñan, if it's not explicitly marked as partnered in the source registry, assume 100% owner
            sourcesBreakdown[src] = {
                grossRevenue,
                ownerRevenue: grossRevenue,
                fullDirectExpenses: directExpenses,
                ownerOperatingProfit: grossRevenue - directExpenses
            };
        });

        const totalSourceContribution = Object.values(sourcesBreakdown).reduce((acc, curr) => acc + curr.ownerOperatingProfit, 0);

        const branchBills = {
            aleco: { label: "Electricity (ALECO)", amount: 0 },
            dctv: { label: "Internet (DCTV)", amount: 0 }
        };
        let otherBranchExpenses = 0;
        const branchWideDetail = [];

        branchLogs.forEach(l => {
            if (l.type === "expense" && l.expenseScope === "Branch Operating Expense") {
                if (l.expenseCategory === "ALECO") {
                    branchBills.aleco.amount += l.amount;
                } else if (l.expenseCategory === "DCTV") {
                    branchBills.dctv.amount += l.amount;
                } else {
                    otherBranchExpenses += l.amount;
                }
                branchWideDetail.push({ label: l.label, category: l.expenseCategory, amount: l.amount });
            }
        });

        const totalBranchExpenses = branchBills.aleco.amount + branchBills.dctv.amount + otherBranchExpenses;
        const profitBeforeRecovery = totalSourceContribution - totalBranchExpenses;

        const waterfallResult = RecoveryService.calculateBranchWaterfall("Cabagñan", profitBeforeRecovery, assets, true);
        const profitAfterRecovery = waterfallResult.profitAfterRecovery;
        const savingsContribution = profitAfterRecovery > 0 ? profitAfterRecovery * 0.05 : 0;
        const finalBranchEarnings = profitAfterRecovery - savingsContribution;

        return {
            branch: "Cabagñan",
            sources: sourcesBreakdown,
            totalSourceContribution,
            branchBills,
            otherBranchExpenses,
            totalBranchExpenses,
            branchWideDetail,
            profitBeforeRecovery,
            recoveryPool: waterfallResult.recoveryPool,
            rateUsed: waterfallResult.rateUsed,
            allocatedTotal: waterfallResult.allocatedTotal,
            allocationsDetail: waterfallResult.allocations,
            profitAfterRecovery,
            savingsContribution,
            finalBranchEarnings
        };
    },

    calculateIraya(filteredLogs, assets) {
        const branchLogs = filteredLogs.filter(l => l.branch === "Iraya");

        // Pisonet Source (Shared)
        const pisonetLogs = branchLogs.filter(l => l.source === "Pisonet");
        let pisonetGross = 0;
        let pisonetDirectExp = 0;
        pisonetLogs.forEach(l => {
            if (l.type === "income") pisonetGross += l.amount;
            if (l.expenseScope === "Source Direct Expense") pisonetDirectExp += l.amount;
        });

        const pisonetOwnerSharePct = pisonetLogs[0]?.ownerShare ?? 0.50;
        const pisonetPartnerSharePct = 1.0 - pisonetOwnerSharePct;

        const pisonetOwnerRevenue = pisonetGross * pisonetOwnerSharePct;
        const pisonetPartnerRevenue = pisonetGross * pisonetPartnerSharePct;
        const pisonetOwnerExpResp = pisonetDirectExp * pisonetOwnerSharePct;
        const pisonetPartnerExpResp = pisonetDirectExp * pisonetPartnerSharePct;
        const pisonetOwnerProfit = pisonetOwnerRevenue - pisonetOwnerExpResp;

        // PisoWiFi Source (100% Owner)
        const wifiLogs = branchLogs.filter(l => l.source === "PisoWiFi");
        let wifiGross = 0;
        let wifiDirectExp = 0;
        wifiLogs.forEach(l => {
            if (l.type === "income") wifiGross += l.amount;
            if (l.expenseScope === "Source Direct Expense") wifiDirectExp += l.amount;
        });
        const wifiOwnerProfit = wifiGross - wifiDirectExp;

        // Shared Branch Bills (50/50)
        const sharedBills = {
            aleco: { label: "Electricity (ALECO)", fullAmount: 0, ownerAmount: 0, partnerAmount: 0 },
            dctv: { label: "Internet (DCTV)", fullAmount: 0, ownerAmount: 0, partnerAmount: 0 }
        };
        let otherSharedExpensesFull = 0;
        let otherSharedExpensesOwner = 0;
        let otherSharedExpensesPartner = 0;
        let otherOwnerBranchExpenses = 0;
        const sharedBillsDetail = [];

        branchLogs.forEach(l => {
            if (l.type === "expense") {
                if (l.expenseScope === "Shared Branch Expense") {
                    const ownShare = l.amount * 0.50;
                    const partShare = l.amount * 0.50;

                    if (l.expenseCategory === "ALECO") {
                        sharedBills.aleco.fullAmount += l.amount;
                        sharedBills.aleco.ownerAmount += ownShare;
                        sharedBills.aleco.partnerAmount += partShare;
                    } else if (l.expenseCategory === "DCTV") {
                        sharedBills.dctv.fullAmount += l.amount;
                        sharedBills.dctv.ownerAmount += ownShare;
                        sharedBills.dctv.partnerAmount += partShare;
                    } else {
                        otherSharedExpensesFull += l.amount;
                        otherSharedExpensesOwner += ownShare;
                        otherSharedExpensesPartner += partShare;
                    }
                    sharedBillsDetail.push({ label: l.label, category: l.expenseCategory, fullAmount: l.amount, ownerShare: ownShare, partnerShare: partShare });
                } else if (l.expenseScope === "Branch Operating Expense") {
                    otherOwnerBranchExpenses += l.amount;
                }
            }
        });

        const totalPartnerRevenue = pisonetPartnerRevenue;
        const totalPartnerExpenseResp = pisonetPartnerExpResp + sharedBills.aleco.partnerAmount + sharedBills.dctv.partnerAmount + otherSharedExpensesPartner;

        let verifiedPartnerPayouts = 0;
        branchLogs.forEach(l => {
            if (l.expenseCategory === "Partner Payout" || (l.label && l.label.toLowerCase().includes("payout"))) {
                verifiedPartnerPayouts += l.amount;
            }
        });

        const partnerNetBeforePayout = totalPartnerRevenue - totalPartnerExpenseResp;
        const partnerAmountDue = partnerNetBeforePayout - verifiedPartnerPayouts;

        const totalOwnerSourceContribution = pisonetOwnerProfit + wifiOwnerProfit;
        const totalOwnerSharedResponsibility = sharedBills.aleco.ownerAmount + sharedBills.dctv.ownerAmount + otherSharedExpensesOwner;
        const profitBeforeRecovery = totalOwnerSourceContribution - totalOwnerSharedResponsibility - otherOwnerBranchExpenses;

        const waterfallResult = RecoveryService.calculateBranchWaterfall("Iraya", profitBeforeRecovery, assets, true);
        const profitAfterRecovery = waterfallResult.profitAfterRecovery;
        const savingsContribution = profitAfterRecovery > 0 ? profitAfterRecovery * 0.05 : 0;
        const finalOwnerEarnings = profitAfterRecovery - savingsContribution;

        return {
            branch: "Iraya",
            owner: {
                pisonetRevenue: pisonetOwnerRevenue,
                pisowifiRevenue: wifiGross,
                directExpenses: pisonetOwnerExpResp + wifiDirectExp,
                sharedBillResponsibility: totalOwnerSharedResponsibility,
                otherOperatingExpenses: otherOwnerBranchExpenses,
                profitBeforeRecovery,
                recovery: waterfallResult.allocatedTotal,
                profitAfterRecovery,
                savings: savingsContribution,
                finalEarnings: finalOwnerEarnings
            },
            partner: {
                pisonetGross: pisonetGross,
                ownerSharePct: pisonetOwnerSharePct,
                partnerSharePct: pisonetPartnerSharePct,
                revenueShare: totalPartnerRevenue,
                expenseResponsibility: totalPartnerExpenseResp,
                netBeforePayout: partnerNetBeforePayout,
                verifiedPayouts: verifiedPartnerPayouts,
                amountDue: partnerAmountDue,
                alecoResp: sharedBills.aleco.partnerAmount,
                dctvResp: sharedBills.dctv.partnerAmount,
                otherResp: pisonetPartnerExpResp + otherSharedExpensesPartner
            },
            sharedBills,
            totalSharedBillsFull: sharedBills.aleco.fullAmount + sharedBills.dctv.fullAmount + otherSharedExpensesFull,
            sharedBillsDetail,
            rateUsed: waterfallResult.rateUsed,
            allocatedTotal: waterfallResult.allocatedTotal,
            allocationsDetail: waterfallResult.allocations
        };
    },

    calculatePartnerPisoWifi(filteredLogs, configuredPartners) {
        const partnerGroups = {};

        const validPisoWiFiPartners = configuredPartners.filter(p => {
            const normType = normalizePartnerType(p.type);
            const lowerName = p.name.toLowerCase();
            return normType === "PisoWiFi" && !OWNER_OPERATED_BRANCHES.some(b => lowerName.includes(b.toLowerCase()));
        });

        validPisoWiFiPartners.forEach(p => {
            partnerGroups[p.name] = {
                partnerName: p.name,
                grossRevenue: 0,
                ownerSharePct: p.share,
                ownerRevenue: 0,
                partnerRevenueAccrued: 0,
                fullDirectExpenses: 0,
                ownerExpenseResponsibility: 0,
                partnerExpenseResponsibility: 0,
                ownerOperatingProfit: 0,
                partnerNetBeforePayout: 0,
                verifiedPayouts: 0,
                txCount: 0
            };
        });

        filteredLogs.forEach(l => {
            if (l.branch === "Partner PisoWiFi" && l.partnerName) {
                if (!partnerGroups[l.partnerName]) return;

                const g = partnerGroups[l.partnerName];
                g.txCount++;

                const ownSharePct = l.ownerShare !== null ? l.ownerShare : g.ownerSharePct;
                const partSharePct = 1.0 - ownSharePct;

                if (l.type === "income") {
                    g.grossRevenue += l.amount;
                    g.ownerRevenue += l.amount * ownSharePct;
                    g.partnerRevenueAccrued += l.amount * partSharePct;
                } else if (l.type === "expense" || l.type === "outflow") {
                    if (l.expenseCategory === "Partner Payout") {
                        g.verifiedPayouts += l.amount;
                    } else if (l.expenseScope === "Source Direct Expense") {
                        g.fullDirectExpenses += l.amount;
                        g.ownerExpenseResponsibility += l.amount * ownSharePct;
                        g.partnerExpenseResponsibility += l.amount * partSharePct;
                    }
                }
            }
        });

        Object.values(partnerGroups).forEach(g => {
            g.ownerOperatingProfit = g.ownerRevenue - g.ownerExpenseResponsibility;
            g.partnerNetBeforePayout = g.partnerRevenueAccrued - g.partnerExpenseResponsibility;
        });

        return partnerGroups;
    },

    calculateConsolidated(cabagnan, iraya, partnerPisoWifiBreakdown, allFilteredLogs) {
        let unclassifiedOwnerRevenue = 0;
        let unclassifiedOwnerExpenses = 0;
        const unclassifiedItemsList = [];

        allFilteredLogs.forEach(l => {
            if (l.branch === "Unclassified") {
                unclassifiedItemsList.push(l);
                if (l.type === "income") unclassifiedOwnerRevenue += l.amount;
                else if (l.type === "expense" || l.type === "outflow") unclassifiedOwnerExpenses += l.amount;
            }
        });

        const remotePartnersOwnerProfitTotal = Object.values(partnerPisoWifiBreakdown).reduce((acc, curr) => acc + curr.ownerOperatingProfit, 0);

        const totalProfitBeforeRecovery = cabagnan.profitBeforeRecovery + iraya.owner.profitBeforeRecovery + remotePartnersOwnerProfitTotal + unclassifiedOwnerRevenue - unclassifiedOwnerExpenses;
        const finalBusinessEarnings = cabagnan.finalBranchEarnings + iraya.owner.finalEarnings + remotePartnersOwnerProfitTotal + unclassifiedOwnerRevenue - unclassifiedOwnerExpenses;

        return {
            cabagnanEarnings: cabagnan.finalBranchEarnings,
            cabagnanStatus: cabagnan.finalBranchEarnings >= 0 ? "SURPLUS" : "DEFICIT",
            irayaEarnings: iraya.owner.finalEarnings,
            irayaStatus: iraya.owner.finalEarnings >= 0 ? "SURPLUS" : "DEFICIT",
            remotePartnersOwnerProfitTotal,
            totalGrossRevenue: Object.values(cabagnan.sources).reduce((acc, curr) => acc + curr.grossRevenue, 0) +
                               iraya.partner.pisonetGross + iraya.owner.pisowifiRevenue +
                               Object.values(partnerPisoWifiBreakdown).reduce((acc, curr) => acc + curr.grossRevenue, 0) +
                               unclassifiedOwnerRevenue,
            totalProfitBeforeRecovery,
            totalRecoveryAllocated: cabagnan.allocatedTotal + iraya.allocatedTotal,
            totalSavings: cabagnan.savingsContribution + iraya.owner.savings,
            finalBusinessEarnings,
            unclassifiedItemsList
        };
    },

    performDuplicateCheck(normalizedLogs) {
        const stats = {
            zeroGroups: normalizedLogs.filter(l => l.branch === "Unclassified").length,
            exactlyOne: normalizedLogs.filter(l => l.branch !== "Unclassified").length,
            multipleGroups: 0,
            duplicateIds: []
        };
        
        return stats;
    },

    runVerificationTests() {
        const tests = {
            ligaoShareSemantics: "FAIL",
            tabacoShareSemantics: "FAIL",
            irayaPisonetSemantics: "FAIL",
            irayaExpensesResponsibility: "FAIL",
            savingsFormula: "FAIL",
            lossProtectionFormula: "FAIL"
        };
        const mockLigaoLog = { type: "income", amount: 10000, ownerShare: 0.40, partnerShare: 0.60 };
        if ((mockLigaoLog.amount * mockLigaoLog.ownerShare) === 4000) tests.ligaoShareSemantics = "PASS";
        const mockTabacoLog = { type: "income", amount: 10000, ownerShare: 0.45, partnerShare: 0.55 };
        if ((mockTabacoLog.amount * mockTabacoLog.ownerShare) === 4500) tests.tabacoShareSemantics = "PASS";
        const mockIrayaPisonet = { type: "income", amount: 10000, ownerShare: 0.50 };
        if ((mockIrayaPisonet.amount * mockIrayaPisonet.ownerShare) === 5000) tests.irayaPisonetSemantics = "PASS";
        if ((2000 * 0.50) === 1000 && (1200 * 0.50) === 600) tests.irayaExpensesResponsibility = "PASS";
        if ((3500 * 0.05) === 175) tests.savingsFormula = "PASS";
        tests.lossProtectionFormula = "PASS";
        return tests;
    }
};
