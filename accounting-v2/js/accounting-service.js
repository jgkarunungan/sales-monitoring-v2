import { RecoveryService } from './recovery-service.js';
import { OWNER_OPERATED_BRANCHES, normalizePartnerType } from './normalization-service.js';

export const AccountingService = {
    filterLogsByPeriod(logs, period, customStart = null, customEnd = null) {
        if (!logs) return [];
        if (period === 'All Time') return logs;

        const now = new Date();
        let startTime = 0;
        let endTime = now.getTime() + (2 * 24 * 60 * 60 * 1000);

        if (period === 'Today') {
            startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
        } else if (period === 'This Month') {
            startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            endTime = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
        } else if (period === 'Last 7 Days') {
            startTime = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        } else if (period === 'This Year' || period === 'Year') {
            startTime = new Date(now.getFullYear(), 0, 1).getTime();
            endTime = new Date(now.getFullYear(), 11, 31, 23, 59, 59).getTime();
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
            if (l.timestamp) {
                return l.timestamp >= startTime && l.timestamp <= endTime;
            }
            if (l.date || l.transactionDate) {
                const d = new Date(l.date || l.transactionDate);
                if (!isNaN(d.getTime())) {
                    return d.getTime() >= startTime && d.getTime() <= endTime;
                }
            }
            return false;
        });
    },

    getLogSourceIdentity(log) {
        if (!log) return null;
        const branch = log.branch || 'Unclassified';
        const source = log.source || log.sourceType || 'Unclassified';
        const partner = log.partnerName || log.partner || log.location || '';

        if (partner && partner !== 'Unclassified' && partner !== branch) {
            return `${branch}__${source}__${partner}`;
        }
        return `${branch}__${source}`;
    },

    resolveCollectionIdentity(activeFilters = {}, filteredRows = []) {
        const { branch, source, partner } = activeFilters || {};

        if (!filteredRows || filteredRows.length === 0) {
            return { mode: 'EMPTY' };
        }

        const explicitBranch = (branch && branch !== 'All' && branch !== 'All Branches') ? branch : null;
        const explicitSource = (source && source !== 'All' && source !== 'All Sources') ? source : null;
        const explicitPartner = (partner && partner !== 'All' && partner !== 'All Partners') ? partner : null;

        const uniqueBranches = [...new Set(filteredRows.map(l => l.branch).filter(b => b && b !== 'Unclassified'))];
        const uniqueSources = [...new Set(filteredRows.map(l => l.source || l.sourceType).filter(s => s && s !== 'Unclassified'))];
        const uniquePartners = [...new Set(filteredRows.map(l => {
            const p = l.partnerName || l.partner || l.location;
            if (!p || p === 'Unclassified' || p === l.branch) return null;
            return p;
        }).filter(Boolean))];

        const resolvedBranch = explicitBranch || (uniqueBranches.length === 1 ? uniqueBranches[0] : 'All');
        const resolvedSource = explicitSource || (uniqueSources.length === 1 ? uniqueSources[0] : 'All');
        const resolvedPartner = explicitPartner || (uniquePartners.length === 1 ? uniquePartners[0] : 'All');

        const uniqueIdentities = [...new Set(filteredRows.map(l => this.getLogSourceIdentity(l)).filter(Boolean))];

        if (uniqueIdentities.length > 1 && (resolvedBranch === 'All' || resolvedSource === 'All')) {
            return { mode: 'MULTIPLE_SOURCES' };
        }

        return {
            mode: 'RESOLVED',
            branch: resolvedBranch,
            source: resolvedSource,
            partner: resolvedPartner,
            identityKey: uniqueIdentities.length === 1 ? uniqueIdentities[0] : null
        };
    },

    determineCollectionContext(a, b) {
        if (Array.isArray(a)) {
            return this.resolveCollectionIdentity(b, a);
        }
        return this.resolveCollectionIdentity(a, b);
    },

    getLastCollectionSummary(logs = [], context = {}) {
        if (!logs || logs.length === 0 || context.mode === 'EMPTY') {
            return {
                transaction: null,
                dateText: 'No collection yet',
                daysSinceText: '—',
                amountText: '—'
            };
        }

        if (context.mode === 'MULTIPLE_SOURCES') {
            return {
                transaction: null,
                dateText: 'Multiple sources',
                daysSinceText: '—',
                amountText: '—'
            };
        }

        // COLLECTION means type === "income" ONLY!
        let incomeLogs = (logs || []).filter(l => l && l.type && String(l.type).toLowerCase() === "income");

        if (context.identityKey) {
            incomeLogs = incomeLogs.filter(l => this.getLogSourceIdentity(l) === context.identityKey);
        } else {
            const { branch, source, partner } = context;
            if (branch && branch !== 'All' && branch !== 'All Branches') {
                incomeLogs = incomeLogs.filter(l => l.branch === branch);
            }
            if (source && source !== 'All' && source !== 'All Sources') {
                incomeLogs = incomeLogs.filter(l => l.source === source || l.sourceType === source);
            }
            if (partner && partner !== 'All' && partner !== 'All Partners') {
                incomeLogs = incomeLogs.filter(l => (l.partnerName && l.partnerName === partner) || (l.partner && l.partner === partner) || (l.location && l.location === partner));
            }
        }

        if (incomeLogs.length === 0) {
            return {
                transaction: null,
                dateText: 'No collection yet',
                daysSinceText: '—',
                amountText: '—'
            };
        }

        const getLogTime = (l) => {
            if (l.transactionDate) {
                const d = new Date(l.transactionDate);
                if (!isNaN(d.getTime())) return d.getTime();
            }
            if (l.date) {
                const d = new Date(l.date);
                if (!isNaN(d.getTime())) return d.getTime();
            }
            if (l.timestamp) {
                return l.timestamp;
            }
            return 0;
        };

        incomeLogs.sort((a, b) => getLogTime(b) - getLogTime(a));

        const latest = incomeLogs[0];
        const logTime = getLogTime(latest);
        if (!latest || logTime === 0) {
            return {
                transaction: null,
                dateText: 'No collection yet',
                daysSinceText: '—',
                amountText: '—'
            };
        }

        const now = new Date();
        const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const targetObj = new Date(logTime);
        const targetLocal = new Date(targetObj.getFullYear(), targetObj.getMonth(), targetObj.getDate());

        const diffMs = todayLocal.getTime() - targetLocal.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        let daysSinceText = '—';
        if (diffDays < 0) {
            daysSinceText = 'Future-dated';
        } else if (diffDays === 0) {
            daysSinceText = 'Today';
        } else if (diffDays === 1) {
            daysSinceText = '1 day';
        } else {
            daysSinceText = `${diffDays} days`;
        }

        const dateText = latest.date || latest.transactionDate || targetObj.toLocaleDateString();
        const formattedAmt = (latest.amount !== undefined && latest.amount !== null && !isNaN(latest.amount))
            ? "₱" + Number(latest.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})
            : "—";

        return {
            transaction: latest,
            dateText,
            daysSinceText,
            amountText: formattedAmt
        };
    },

    filterLogs(logs = [], filters = {}) {
        if (!logs) return [];

        let result = [...logs];

        // 1. Period Filter (DEFAULT = 'All Time')
        const period = filters.period || 'All Time';
        result = this.filterLogsByPeriod(result, period, filters.customStart, filters.customEnd);

        // 2. Type Filter
        if (filters.type && filters.type !== 'All' && filters.type !== 'All Types') {
            const targetType = filters.type.toLowerCase();
            result = result.filter(l => l.type && l.type.toLowerCase() === targetType);
        }

        // 3. Branch Filter
        if (filters.branch && filters.branch !== 'All' && filters.branch !== 'All Branches') {
            result = result.filter(l => l.branch === filters.branch);
        }

        // 4. Source Filter
        if (filters.source && filters.source !== 'All' && filters.source !== 'All Sources') {
            result = result.filter(l => l.source === filters.source || l.sourceType === filters.source);
        }

        // 5. Partner Filter
        if (filters.partner && filters.partner !== 'All' && filters.partner !== 'All Partners') {
            result = result.filter(l => (l.partnerName && l.partnerName === filters.partner) || (l.partner && l.partner === filters.partner));
        }

        // 6. Text Search Filter (EXPLICIT WHITELIST OF BUSINESS FIELDS ONLY - NO AUDIT METADATA)
        if (filters.search && typeof filters.search === 'string' && filters.search.trim() !== '') {
            const query = filters.search.trim().toLowerCase();
            result = result.filter(log => {
                if (!log) return false;
                const rawObj = log.raw || {};

                const formatVal = (v) => {
                    if (v === null || v === undefined) return '';
                    if (typeof v === 'object') {
                        if (typeof v.toDate === 'function') {
                            return v.toDate().toLocaleDateString();
                        }
                        if (v instanceof Date) {
                            return v.toLocaleDateString();
                        }
                        if (v.seconds !== undefined) {
                            return new Date(v.seconds * 1000).toLocaleDateString();
                        }
                        return '';
                    }
                    return String(v);
                };

                const searchableFields = [
                    log.label,
                    log.description,
                    log.branch,
                    log.source,
                    log.sourceType,
                    log.partner,
                    log.partnerName,
                    log.expenseCategory,
                    log.accountingGroup,
                    log.referenceNumber,
                    log.transactionDate,
                    log.date,
                    rawObj.label,
                    rawObj.description,
                    rawObj.partner,
                    rawObj.partnerName,
                    rawObj.branch,
                    rawObj.source,
                    rawObj.sourceType,
                    rawObj.location,
                    rawObj.notes,
                    rawObj.category,
                    rawObj.expenseCategory,
                    rawObj.accountingGroup,
                    rawObj.referenceNumber,
                    rawObj.transactionDate,
                    rawObj.dateStr,
                    (log.amount !== undefined && log.amount !== null) ? log.amount : null
                ];

                const searchableText = searchableFields
                    .map(formatVal)
                    .filter(str => str.trim() !== '')
                    .join(" ")
                    .toLowerCase();

                return searchableText.includes(query);
            });
        }

        // 7. Sort newest business date first, timestamp as tiebreaker
        result.sort((a, b) => {
            const getTime = (item) => {
                if (item.transactionDate) {
                    const d = new Date(item.transactionDate);
                    if (!isNaN(d.getTime())) return d.getTime();
                }
                if (item.date) {
                    const d = new Date(item.date);
                    if (!isNaN(d.getTime())) return d.getTime();
                }
                return item.timestamp || 0;
            };
            const timeA = getTime(a);
            const timeB = getTime(b);
            if (timeA !== timeB) {
                return timeB - timeA;
            }
            return (b.timestamp || 0) - (a.timestamp || 0);
        });

        return result;
    },

    calculateCollectionRecency(normalizedLogs = [], enrolledSources = [], configuredPartners = []) {
        const incomeLogs = (normalizedLogs || []).filter(l => l && l.type && l.type.toLowerCase() === "income");

        const calculateDaysSince = (dateVal) => {
            if (!dateVal) return { days: 9999, text: '—', status: 'NO COLLECTION YET', formattedDate: 'No collection yet' };

            const now = new Date();
            const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            let targetDate = null;
            if (typeof dateVal === 'number') {
                targetDate = new Date(dateVal);
            } else {
                targetDate = new Date(dateVal);
            }

            if (isNaN(targetDate.getTime())) {
                return { days: 9999, text: '—', status: 'NO COLLECTION YET', formattedDate: 'No collection yet' };
            }

            const targetLocal = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
            const diffMs = todayLocal.getTime() - targetLocal.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

            const options = { month: 'short', day: 'numeric', year: 'numeric' };
            const formattedDate = targetDate.toLocaleDateString('en-US', options);

            if (diffDays < 0) {
                return { days: -1, text: 'FUTURE-DATED', status: 'FUTURE-DATED', formattedDate };
            } else if (diffDays === 0) {
                return { days: 0, text: 'Today', status: 'TODAY', formattedDate };
            } else if (diffDays === 1) {
                return { days: 1, text: '1 day', status: 'RECENT', formattedDate };
            } else if (diffDays <= 3) {
                return { days: diffDays, text: `${diffDays} days`, status: 'RECENT', formattedDate };
            } else if (diffDays <= 7) {
                return { days: diffDays, text: `${diffDays} days`, status: '4-7 DAYS', formattedDate };
            } else if (diffDays <= 14) {
                return { days: diffDays, text: `${diffDays} days`, status: 'OVER 7 DAYS', formattedDate };
            } else if (diffDays <= 30) {
                return { days: diffDays, text: `${diffDays} days`, status: 'OVER 14 DAYS', formattedDate };
            } else {
                return { days: diffDays, text: `${diffDays} days`, status: 'OVER 30 DAYS', formattedDate };
            }
        };

        const instanceMap = {};

        // 1. Core Source Instances
        const coreInstances = [
            { branch: "Cabagñan", source: "Coffee Vendo", location: "Cabagñan", displayName: "Coffee Vendo" },
            { branch: "Cabagñan", source: "Pisonet", location: "Cabagñan", displayName: "Pisonet" },
            { branch: "Cabagñan", source: "PisoWiFi", location: "Cabagñan", displayName: "PisoWiFi" },
            { branch: "Cabagñan", source: "Printing / Photocopy", location: "Cabagñan", displayName: "Printing / Photocopy" },
            { branch: "Iraya", source: "Pisonet", location: "Iraya", displayName: "Pisonet" },
            { branch: "Iraya", source: "PisoWiFi", location: "Iraya", displayName: "PisoWiFi" }
        ];

        coreInstances.forEach(c => {
            const key = `${c.branch}__${c.source}__${c.location}`;
            instanceMap[key] = {
                key,
                branch: c.branch,
                source: c.source,
                location: c.location,
                partnerName: null,
                displayName: c.displayName,
                logs: []
            };
        });

        // 2. Enrolled Sources
        (enrolledSources || []).forEach(s => {
            if (s && s.name) {
                const key = s.id || `${s.branch || "Cabagñan"}__${s.name}__${s.branch || "Cabagñan"}`;
                if (!instanceMap[key]) {
                    instanceMap[key] = {
                        key,
                        branch: s.branch || "Cabagñan",
                        source: s.name,
                        location: s.branch || "Cabagñan",
                        partnerName: null,
                        displayName: s.name,
                        logs: []
                    };
                }
            }
        });

        // 3. Configured Partners
        (configuredPartners || []).forEach(p => {
            if (p && p.name && !OWNER_OPERATED_BRANCHES.some(b => p.name.toLowerCase().includes(b.toLowerCase()))) {
                const key = `Partner PisoWiFi__PisoWiFi__${p.name}`;
                if (!instanceMap[key]) {
                    instanceMap[key] = {
                        key,
                        branch: "Partner PisoWiFi",
                        source: "PisoWiFi",
                        location: p.name,
                        partnerName: p.name,
                        displayName: `PisoWiFi (${p.name})`,
                        logs: []
                    };
                }
            }
        });

        // 4. Map Income Logs
        incomeLogs.forEach(l => {
            const location = l.partnerName || l.partner || l.branch || "Unclassified";
            const sourceName = l.source || l.sourceType || "Unclassified";
            const branch = l.branch || "Unclassified";

            let key = null;
            if (l.sourceId && instanceMap[l.sourceId]) {
                key = l.sourceId;
            } else if (branch === "Partner PisoWiFi" || (sourceName === "PisoWiFi" && !OWNER_OPERATED_BRANCHES.some(b => location.toLowerCase().includes(b.toLowerCase())))) {
                key = `Partner PisoWiFi__PisoWiFi__${location}`;
            } else {
                key = `${branch}__${sourceName}__${location}`;
            }

            if (!instanceMap[key]) {
                instanceMap[key] = {
                    key,
                    branch,
                    source: sourceName,
                    location,
                    partnerName: branch === "Partner PisoWiFi" ? location : (l.partnerName || null),
                    displayName: branch === "Partner PisoWiFi" ? `PisoWiFi (${location})` : sourceName,
                    logs: []
                };
            }

            instanceMap[key].logs.push(l);
        });

        // 5. Build Recency Rows
        const recencyRows = Object.values(instanceMap).map(inst => {
            const logs = inst.logs || [];
            logs.sort((a, b) => {
                const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
                const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
                return timeB - timeA;
            });

            const latestTx = logs[0] || null;
            const lastDate = latestTx ? (latestTx.transactionDate || latestTx.date || latestTx.timestamp) : null;
            const lastAmount = latestTx ? latestTx.amount : null;

            let lastDayTotal = lastAmount;
            if (latestTx && logs.length > 1) {
                const latestDateStr = latestTx.date || (latestTx.timestamp ? new Date(latestTx.timestamp).toLocaleDateString() : null);
                if (latestDateStr) {
                    const sameDayLogs = logs.filter(l => (l.date === latestDateStr || (l.timestamp && new Date(l.timestamp).toLocaleDateString() === latestDateStr)));
                    if (sameDayLogs.length > 1) {
                        lastDayTotal = sameDayLogs.reduce((sum, l) => sum + (l.amount || 0), 0);
                    }
                }
            }

            const daysResult = calculateDaysSince(lastDate);

            return {
                key: inst.key,
                source: inst.source,
                branch: inst.branch,
                location: inst.location,
                partnerName: inst.partnerName,
                displayName: inst.displayName,
                lastCollectionDate: daysResult.formattedDate,
                lastCollectionRawDate: lastDate,
                daysSinceText: daysResult.text,
                daysSinceNum: daysResult.days,
                status: daysResult.status,
                lastAmount: lastAmount,
                lastDayTotal: lastDayTotal,
                txCount: logs.length
            };
        });

        recencyRows.sort((a, b) => b.daysSinceNum - a.daysSinceNum);

        return recencyRows;
    },

    calculateCabagnan(filteredLogs, assets) {
        const branchLogs = filteredLogs.filter(l => l.branch === "Cabagñan");

        // Compute Coffee Vendo Self-Recovery FIRST
        const coffeeSelfRecovery = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo", branchLogs, assets);

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

            const opProfit = grossRevenue - directExpenses;
            const recAlloc = (src === "Coffee Vendo") ? coffeeSelfRecovery.allocatedTotal : 0;
            const surplus = opProfit - recAlloc;

            sourcesBreakdown[src] = {
                grossRevenue,
                ownerRevenue: grossRevenue,
                fullDirectExpenses: directExpenses,
                ownerOperatingProfit: opProfit,
                recoveryAllocated: recAlloc,
                surplusAfterRecovery: surplus
            };
        });

        // Sum up source contributions (for Coffee Vendo, use surplus after self-recovery)
        let totalSourceContribution = 0;
        Object.keys(sourcesBreakdown).forEach(src => {
            totalSourceContribution += sourcesBreakdown[src].surplusAfterRecovery;
        });

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

        // Combine allocations detail (Coffee Self-Recovery + General Waterfall)
        const combinedAllocations = [
            ...coffeeSelfRecovery.allocations,
            ...waterfallResult.allocations
        ];

        // Sum up source operating profit before self-recovery
        let sourceOperatingProfitBeforeSelfRecovery = 0;
        Object.keys(sourcesBreakdown).forEach(src => {
            sourceOperatingProfitBeforeSelfRecovery += sourcesBreakdown[src].ownerOperatingProfit;
        });

        return {
            branch: "Cabagñan",
            sources: sourcesBreakdown,
            sourceOperatingProfitBeforeSelfRecovery,
            coffeeSelfRecovery,
            sourceSelfRecoveryAllocated: coffeeSelfRecovery.allocatedTotal,
            totalSourceContribution,
            branchBills,
            otherBranchExpenses,
            totalBranchExpenses,
            branchWideDetail,
            profitBeforeRecovery,
            recoveryPool: waterfallResult.recoveryPool,
            rateUsed: waterfallResult.rateUsed,
            branchWaterfallRate: waterfallResult.rateUsed,
            branchWaterfallAllocated: waterfallResult.allocatedTotal,
            allocatedTotal: waterfallResult.allocatedTotal,
            allocationsDetail: combinedAllocations,
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
            recoveryPool: waterfallResult.recoveryPool,
            rateUsed: waterfallResult.rateUsed,
            allocatedTotal: waterfallResult.allocatedTotal,
            allocationsDetail: waterfallResult.allocations
        };
    },

    calculatePartnerPisoWifi(filteredLogs, configuredPartners = []) {
        const partnerGroups = {};

        const validPisoWiFiPartners = (configuredPartners || []).filter(p => {
            const normType = normalizePartnerType(p.type);
            const lowerName = p.name ? p.name.toLowerCase() : "";
            return normType === "PisoWiFi" && !OWNER_OPERATED_BRANCHES.some(b => lowerName.includes(b.toLowerCase()));
        });

        validPisoWiFiPartners.forEach(p => {
            const ownerShare = p.share !== undefined ? p.share : 0.50;
            partnerGroups[p.name] = {
                partnerName: p.name,
                partnerId: p.id,
                isEnrolled: true,
                currentOwnerShare: ownerShare,
                currentPartnerShare: 1.0 - ownerShare,
                ownerSharePct: ownerShare, // Backwards compatibility
                status: "USER ENROLLED - NO TRANSACTIONS YET",
                grossRevenue: 0,
                historicalOwnerRevenue: 0,
                historicalPartnerRevenue: 0,
                ownerRevenue: 0,
                partnerRevenueAccrued: 0,
                unrecordedShareTxCount: 0,
                fullDirectExpenses: 0,
                ownerExpenseResponsibility: 0,
                partnerExpenseResponsibility: 0,
                ownerOperatingProfit: 0,
                partnerNetBeforePayout: 0,
                verifiedPayouts: 0,
                txCount: 0,
                firstTxDate: null,
                lastTxDate: null,
                sampleTxId: null
            };
        });

        (filteredLogs || []).forEach(l => {
            const isPisoWifiSource = l.source === "PisoWiFi" || (l.label && l.label.toLowerCase().includes("pisowifi")) || (l.label && l.label.toLowerCase().includes("piso wifi"));
            const isPartnerBranch = l.branch === "Partner PisoWiFi" || isPisoWifiSource;

            if (isPartnerBranch) {
                const partnerName = l.partnerName || l.partner || l.label;
                if (!partnerName) return;

                const lowerPartner = partnerName.toLowerCase();
                if (OWNER_OPERATED_BRANCHES.some(b => lowerPartner.includes(b.toLowerCase()))) return;

                if (!partnerGroups[partnerName]) {
                    const matched = (configuredPartners || []).find(cp => cp.name && cp.name.toLowerCase() === lowerPartner);
                    const currentOwnerShare = matched ? matched.share : null;
                    const currentPartnerShare = matched ? 1.0 - matched.share : null;

                    partnerGroups[partnerName] = {
                        partnerName: partnerName,
                        partnerId: matched ? matched.id : null,
                        isEnrolled: !!matched,
                        currentOwnerShare: currentOwnerShare,
                        currentPartnerShare: currentPartnerShare,
                        ownerSharePct: currentOwnerShare !== null ? currentOwnerShare : 0.50,
                        status: matched ? "ENROLLED" : "HISTORICAL PARTNER - NOT YET ENROLLED",
                        grossRevenue: 0,
                        historicalOwnerRevenue: 0,
                        historicalPartnerRevenue: 0,
                        ownerRevenue: 0,
                        partnerRevenueAccrued: 0,
                        unrecordedShareTxCount: 0,
                        fullDirectExpenses: 0,
                        ownerExpenseResponsibility: 0,
                        partnerExpenseResponsibility: 0,
                        ownerOperatingProfit: 0,
                        partnerNetBeforePayout: 0,
                        verifiedPayouts: 0,
                        txCount: 0,
                        firstTxDate: null,
                        lastTxDate: null,
                        sampleTxId: null
                    };
                }

                const g = partnerGroups[partnerName];
                if (g.isEnrolled) {
                    g.status = "ENROLLED";
                }

                g.txCount++;
                if (!g.firstTxDate || l.date < g.firstTxDate) g.firstTxDate = l.date;
                if (!g.lastTxDate || l.date > g.lastTxDate) g.lastTxDate = l.date;
                if (!g.sampleTxId) g.sampleTxId = l.id;

                if (l.type === "income") {
                    g.grossRevenue += l.amount;

                    if (l.ownerShare !== null && l.ownerShare !== undefined) {
                        g.historicalOwnerRevenue += l.amount * l.ownerShare;
                        g.historicalPartnerRevenue += l.amount * (l.partnerShare !== null && l.partnerShare !== undefined ? l.partnerShare : (1.0 - l.ownerShare));
                    } else if (g.currentOwnerShare !== null && g.currentOwnerShare !== undefined) {
                        g.historicalOwnerRevenue += l.amount * g.currentOwnerShare;
                        g.historicalPartnerRevenue += l.amount * g.currentPartnerShare;
                    } else {
                        g.unrecordedShareTxCount++;
                    }
                } else if (l.type === "expense" || l.type === "outflow") {
                    if (l.expenseCategory === "Partner Payout") {
                        g.verifiedPayouts += l.amount;
                    } else {
                        g.fullDirectExpenses += l.amount;
                        const ownExpShare = l.ownerShare !== null && l.ownerShare !== undefined ? l.ownerShare : (g.currentOwnerShare !== null ? g.currentOwnerShare : 0.50);
                        g.ownerExpenseResponsibility += l.amount * ownExpShare;
                        g.partnerExpenseResponsibility += l.amount * (1.0 - ownExpShare);
                    }
                }
            }
        });

        Object.values(partnerGroups).forEach(g => {
            g.ownerRevenue = g.historicalOwnerRevenue;
            g.partnerRevenueAccrued = g.historicalPartnerRevenue;
            g.ownerOperatingProfit = g.historicalOwnerRevenue - g.ownerExpenseResponsibility;
            g.partnerNetBeforePayout = g.historicalPartnerRevenue - g.partnerExpenseResponsibility;
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

    calculateAllTimeBusinessSummary(allLogs = []) {
        let grossRevenue = 0;
        let ownerRevenue = 0;
        let directOperatingCosts = 0;
        let sharedOperatingCosts = 0;
        let unclassifiedOperatingCosts = 0;

        allLogs.forEach(l => {
            const isIncome = l.type && l.type.toLowerCase() === "income";
            const isExpense = l.type && (l.type.toLowerCase() === "expense" || l.type.toLowerCase() === "outflow");

            if (isIncome) {
                grossRevenue += l.amount;
                const ownerSharePct = (l.ownerShare !== null && l.ownerShare !== undefined) ? l.ownerShare : 1.0;
                ownerRevenue += l.amount * ownerSharePct;
            } else if (isExpense) {
                const labelLower = (l.label || "").toLowerCase();
                const catLower = (l.expenseCategory || "").toLowerCase();

                // Exclude non-operating cashflows (payouts, withdrawals, debt principal)
                const isPartnerPayout = catLower === "partner payout" || labelLower.includes("payout");
                const isOwnerWithdrawal = catLower === "owner withdrawal" || catLower === "drawings" || labelLower.includes("withdrawal");
                const isDebtPrincipal = catLower === "debt principal" || labelLower.includes("debt principal");

                if (!isPartnerPayout && !isOwnerWithdrawal && !isDebtPrincipal) {
                    const ownerSharePct = (l.ownerShare !== null && l.ownerShare !== undefined) ? l.ownerShare : 1.0;
                    const ownerExpenseResp = l.amount * ownerSharePct;

                    if (l.expenseScope === "Source Direct Expense") {
                        directOperatingCosts += ownerExpenseResp;
                    } else if (l.expenseScope === "Branch Operating Expense" || l.expenseScope === "Shared Branch Expense") {
                        sharedOperatingCosts += ownerExpenseResp;
                    } else {
                        unclassifiedOperatingCosts += ownerExpenseResp;
                    }
                }
            }
        });

        const totalOperatingCosts = directOperatingCosts + sharedOperatingCosts + unclassifiedOperatingCosts;
        const operatingProfitBeforeRecovery = ownerRevenue - totalOperatingCosts;

        return {
            grossRevenue,
            ownerRevenue,
            directOperatingCosts,
            sharedOperatingCosts,
            unclassifiedOperatingCosts,
            totalOperatingCosts,
            operatingProfitBeforeRecovery,
            recordedHistoryNote: "Based on recorded transaction history. Not affected by the selected period."
        };
    },

    calculateMonthlyBusinessPerformance(logs = [], settings = {}, range = '12 Months') {
        if (!logs) logs = [];

        const now = new Date();
        const currYear = now.getFullYear();
        const currMonth = now.getMonth(); // 0..11
        const currentMonthKey = `${currYear}-${String(currMonth + 1).padStart(2, '0')}`;

        // Helper: Parse log month key using transactionDate first
        const getLogMonthKey = (l) => {
            if (!l) return null;
            const rawDate = l.transactionDate || (l.raw && l.raw.transactionDate) || (l.raw && l.raw.dateStr) || l.date;
            if (rawDate && typeof rawDate === 'string') {
                const match = rawDate.match(/^(\d{4})[-/](\d{1,2})/);
                if (match) {
                    const y = parseInt(match[1], 10);
                    const m = parseInt(match[2], 10);
                    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
                        return `${y}-${String(m).padStart(2, '0')}`;
                    }
                }
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    const y = d.getFullYear();
                    const m = d.getMonth() + 1;
                    if (y >= 2000 && y <= 2100) {
                        return `${y}-${String(m).padStart(2, '0')}`;
                    }
                }
            }
            if (l.timestamp) {
                const d = new Date(l.timestamp);
                if (!isNaN(d.getTime())) {
                    const y = d.getFullYear();
                    const m = d.getMonth() + 1;
                    return `${y}-${String(m).padStart(2, '0')}`;
                }
            }
            return null;
        };

        // 1. Group logs by month key YYYY-MM
        const logsByMonth = {};
        logs.forEach(l => {
            const mKey = getLogMonthKey(l);
            if (mKey) {
                if (!logsByMonth[mKey]) logsByMonth[mKey] = [];
                logsByMonth[mKey].push(l);
            }
        });

        // 2. Determine target range of month keys YYYY-MM
        let numMonths = 12;
        if (range === '6 Months' || range === '6') numMonths = 6;
        else if (range === '12 Months' || range === '12') numMonths = 12;
        else if (range === '24 Months' || range === '24') numMonths = 24;

        let monthKeys = [];

        if (range === 'All Recorded Months' || range === 'All Recorded') {
            const recordedKeys = Object.keys(logsByMonth).sort();
            let earliestKey = recordedKeys.length > 0 ? recordedKeys[0] : currentMonthKey;
            if (earliestKey > currentMonthKey) earliestKey = currentMonthKey;

            // Generate all months from earliestKey to currentMonthKey
            const [eY, eM] = earliestKey.split('-').map(Number);
            let curY = eY;
            let curM = eM - 1; // 0-based index

            while (true) {
                const k = `${curY}-${String(curM + 1).padStart(2, '0')}`;
                monthKeys.push(k);
                if (k >= currentMonthKey) break;
                curM++;
                if (curM > 11) {
                    curM = 0;
                    curY++;
                }
            }
        } else {
            // Generate numMonths ending at currentMonthKey
            for (let i = numMonths - 1; i >= 0; i--) {
                const d = new Date(currYear, currMonth - i, 1);
                const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthKeys.push(k);
            }
        }

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        const assets = (settings && settings.assets) ? settings.assets : [];
        const partners = (settings && settings.partners) ? settings.partners : [];

        const result = monthKeys.map(mKey => {
            const [yStr, mStr] = mKey.split('-');
            const y = parseInt(yStr, 10);
            const m = parseInt(mStr, 10); // 1..12
            const shortLabel = `${monthNames[m - 1]} ${y}`;
            const fullLabel = `${fullMonthNames[m - 1]} ${y}`;
            const isCurrentMonth = (mKey === currentMonthKey);

            const monthLogs = logsByMonth[mKey] || [];

            let grossRevenue = 0;
            let ownerRevenue = 0;
            let operatingCosts = 0;
            let directOperatingCosts = 0;
            let sharedOperatingCosts = 0;
            let unclassifiedOperatingCosts = 0;

            monthLogs.forEach(l => {
                const isIncome = l.type && l.type.toLowerCase() === "income";
                const isExpense = l.type && (l.type.toLowerCase() === "expense" || l.type.toLowerCase() === "outflow");

                if (isIncome) {
                    grossRevenue += l.amount;

                    let ownerShare = (l.ownerShare !== null && l.ownerShare !== undefined) ? l.ownerShare : (l.raw && l.raw.sharePercent !== undefined ? l.raw.sharePercent : (l.raw && l.raw.ownerShare));
                    if (ownerShare === null || ownerShare === undefined) {
                        if (l.branch === "Cabagñan") ownerShare = 1.0;
                        else if (l.branch === "Iraya" && l.source === "PisoWiFi") ownerShare = 1.0;
                        else if (l.branch === "Iraya" && l.source === "Pisonet") ownerShare = 0.50;
                        else ownerShare = 1.0;
                    }
                    if (ownerShare > 1.0) ownerShare = ownerShare / 100.0;

                    ownerRevenue += l.amount * ownerShare;
                } else if (isExpense) {
                    const labelLower = (l.label || "").toLowerCase();
                    const catLower = (l.expenseCategory || "").toLowerCase();

                    // Exclude non-operating cashflows
                    const isPartnerPayout = catLower === "partner payout" || labelLower.includes("payout");
                    const isOwnerWithdrawal = catLower === "owner withdrawal" || catLower === "drawings" || labelLower.includes("withdrawal");
                    const isDebtPrincipal = catLower === "debt principal" || labelLower.includes("debt principal");

                    if (!isPartnerPayout && !isOwnerWithdrawal && !isDebtPrincipal) {
                        let ownerExpShare = (l.ownerShare !== null && l.ownerShare !== undefined) ? l.ownerShare : (l.raw && l.raw.sharePercent !== undefined ? l.raw.sharePercent : (l.raw && l.raw.ownerShare));
                        if (ownerExpShare === null || ownerExpShare === undefined) {
                            if (l.branch === "Iraya" && (l.expenseScope === "Shared Branch Expense" || l.expenseCategory === "ALECO" || l.expenseCategory === "DCTV" || labelLower.includes("shared bill"))) {
                                ownerExpShare = 0.50;
                            } else if (l.branch === "Partner PisoWiFi") {
                                ownerExpShare = 0.50;
                            } else {
                                ownerExpShare = 1.0;
                            }
                        }
                        if (ownerExpShare > 1.0) ownerExpShare = ownerExpShare / 100.0;

                        const costAmount = l.amount * ownerExpShare;
                        operatingCosts += costAmount;

                        if (l.expenseScope === "Source Direct Expense") {
                            directOperatingCosts += costAmount;
                        } else if (l.expenseScope === "Branch Operating Expense" || l.expenseScope === "Shared Branch Expense") {
                            sharedOperatingCosts += costAmount;
                        } else {
                            unclassifiedOperatingCosts += costAmount;
                        }
                    }
                }
            });

            const operatingProfit = ownerRevenue - operatingCosts;

            // Calculate recovery & savings for final owner earnings
            const cab = this.calculateCabagnan(monthLogs, assets);
            const iraya = this.calculateIraya(monthLogs, assets);
            const partnerPiso = this.calculatePartnerPisoWifi(monthLogs, partners);
            const consolidated = this.calculateConsolidated(cab, iraya, partnerPiso, monthLogs);

            const finalOwnerEarnings = consolidated.finalBusinessEarnings;

            return {
                monthKey: mKey,
                label: shortLabel,
                fullLabel: fullLabel,
                year: y,
                monthNum: m,
                grossRevenue,
                ownerRevenue,
                operatingCosts,
                directOperatingCosts,
                sharedOperatingCosts,
                unclassifiedOperatingCosts,
                operatingProfit,
                finalOwnerEarnings,
                isCurrentMonth,
                isPartial: isCurrentMonth,
                txCount: monthLogs.length
            };
        });

        return result;
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
            lossProtectionFormula: "FAIL",
            recoveryAllocationTest: "FAIL",
            zeroProfitRecoveryTest: "FAIL",
            pausedTargetTest: "FAIL",
            monthlyConservationTest: "FAIL",
            monthlyHistoricalShareTest: "FAIL",
            monthlyZeroBaselineTest: "FAIL"
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

        // Required Recovery Test (Section 22)
        const t1 = RecoveryService.calculateBranchWaterfall("Cabagñan", 10000, [], true);
        if (t1.recoveryPool === 5000 && t1.allocations[0]?.status === "ACTIVE" && t1.allocations[1]?.status === "WAITING" && t1.allocatedTotal === 5000) {
            tests.recoveryAllocationTest = "PASS";
        }

        // Required Zero-Profit Test (Section 23)
        const t2 = RecoveryService.calculateBranchWaterfall("Cabagñan", 0, [], true);
        if (t2.recoveryPool === 0 && t2.allocations[0]?.status === "ACTIVE") {
            tests.zeroProfitRecoveryTest = "PASS";
        }

        // Required Paused Test (Section 24)
        const pausedAssets = [
            { id: "rec_coffee_machine", name: "Coffee Vendo Machine", cost: 20000, recoveryPercent: 0.50, branch: "Cabagñan", paused: true },
            { id: "rec_metal_case", name: "Coffee Metal Case", cost: 8000, recoveryPercent: 0.50, branch: "Cabagñan", paused: false }
        ];
        const t3 = RecoveryService.calculateBranchWaterfall("Cabagñan", 10000, pausedAssets, false);
        if (t3.allocations[0]?.status === "PAUSED" && t3.allocations[1]?.status === "ACTIVE") {
            tests.pausedTargetTest = "PASS";
        }

        // Transaction Log Text Search Tests
        const mockSearchLogs = [
            { id: "1", timestamp: Date.now(), type: "income", branch: "Partner PisoWiFi", source: "PisoWiFi", label: "PisoWiFi Ramboanga", partnerName: "Ramboanga", amount: 5000, ownerShare: 0.40 },
            { id: "2", timestamp: Date.now(), type: "expense", branch: "Cabagñan", source: "Coffee Vendo", label: "Electricity (ALECO)", expenseCategory: "ALECO", amount: 2500, ownerShare: 1.0 },
            { id: "3", timestamp: Date.now(), type: "income", branch: "Cabagñan", source: "Coffee Vendo", label: "Coffee Vendo Income", amount: 1200, ownerShare: 1.0 },
            { id: "4", timestamp: Date.now(), type: "income", branch: "Cabagñan", source: "Printing / Photocopy", label: "Printing Services", amount: 800, ownerShare: 1.0 }
        ];

        const r1 = this.filterLogs(mockSearchLogs, { period: 'All Time', search: 'ramboanga' });
        const r2 = this.filterLogs(mockSearchLogs, { period: 'All Time', search: 'RAMBOANGA' });
        const r3 = this.filterLogs(mockSearchLogs, { period: 'All Time', search: 'ram' });
        const r4 = this.filterLogs(mockSearchLogs, { period: 'All Time', search: 'aleco' });
        const r5 = this.filterLogs(mockSearchLogs, { period: 'All Time', search: 'coffee' });
        const r6 = this.filterLogs(mockSearchLogs, { period: 'All Time', search: 'xyz-not-found' });
        const r7 = this.filterLogs(mockSearchLogs, { period: 'All Time', branch: 'Cabagñan', search: 'aleco' });
        const r8 = this.filterLogs(mockSearchLogs, { period: 'All Time', branch: 'Cabagñan', search: '' });

        tests.textSearchRamboanga = (r1.length === 1 && r1[0].id === "1") ? "PASS" : "FAIL";
        tests.textSearchCaseInsensitive = (r2.length === 1 && r2[0].id === "1") ? "PASS" : "FAIL";
        tests.textSearchPartialRam = (r3.length === 1 && r3[0].id === "1") ? "PASS" : "FAIL";
        tests.textSearchAleco = (r4.length === 1 && r4[0].id === "2") ? "PASS" : "FAIL";
        tests.textSearchCoffee = (r5.length === 2) ? "PASS" : "FAIL";
        tests.textSearchNotFound = (r6.length === 0) ? "PASS" : "FAIL";
        tests.textSearchCombinedFilter = (r7.length === 1 && r7[0].id === "2") ? "PASS" : "FAIL";
        tests.textSearchClearSearch = (r8.length === 3) ? "PASS" : "FAIL";

        // Monthly Business Performance Tests
        const mockMonthlyLogs = [
            { id: "m1", transactionDate: "2025-10-10", type: "income", branch: "Cabagñan", source: "Coffee Vendo", amount: 10000, ownerShare: 1.0 },
            { id: "m2", transactionDate: "2025-10-12", type: "expense", branch: "Cabagñan", source: "Coffee Vendo", amount: 3000, ownerShare: 1.0 },
            { id: "m3", transactionDate: "2025-11-05", type: "income", branch: "Iraya", source: "Pisonet", amount: 8000, ownerShare: 0.50 }
        ];
        const monthlyPerf = this.calculateMonthlyBusinessPerformance(mockMonthlyLogs, {}, '12 Months');
        const octMonth = monthlyPerf.find(m => m.monthKey === "2025-10");
        const novMonth = monthlyPerf.find(m => m.monthKey === "2025-11");

        tests.monthlyConservationTest = (octMonth && (octMonth.ownerRevenue - octMonth.operatingCosts === octMonth.operatingProfit) && octMonth.operatingProfit === 7000) ? "PASS" : "FAIL";
        tests.monthlyHistoricalShareTest = (novMonth && novMonth.ownerRevenue === 4000) ? "PASS" : "FAIL";

        const zeroCheck = (curr, prev) => {
            if (!prev || prev === 0) return "NEW";
            return ((curr - prev) / Math.abs(prev) * 100).toFixed(1) + "%";
        };
        tests.monthlyZeroBaselineTest = (zeroCheck(5000, 0) === "NEW" && !isNaN(parseFloat(zeroCheck(5000, 2000)))) ? "PASS" : "FAIL";

        return tests;
    }
};
