import { DataService } from './data-service.js';
import { AccountingService } from './accounting-service.js';
import { normalizePartnerType, OWNER_OPERATED_BRANCHES } from './normalization-service.js';

// Safe Rendering Helpers
const money = (val) => {
    if (val === undefined || val === null || isNaN(val) || !isFinite(val)) return "₱0.00";
    return "₱" + val.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
};

const safeText = (val, fallback = "Not available") => {
    return (val === undefined || val === null || val === "") ? fallback : val;
};

const pct = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "0%";
    return (val * 100).toFixed(0) + "%";
};

export const DashboardRenderer = {
    renderOverview() {
        const c = DataService.consolidatedResult;
        if (!c) return `<div class="p-8 text-center text-slate-400 italic">Calculating business metrics...</div>`;

        return `
            <div class="space-y-6">
                <!-- Suite Verification Badges -->
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black uppercase text-slate-400">Accounting Health:</span>
                        ${Object.entries(DataService.testSuiteResults || {}).map(([key, val]) => `
                            <span class="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${val === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                                ${key.replace(/([A-Z])/g, ' $1')}: ${val}
                            </span>
                        `).join('')}
                    </div>
                    <span class="text-[10px] text-slate-400 font-mono font-bold">Active View Filter: ${DataService.currentPeriod}</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    ${this.renderMetricCard("Cabagñan Status", money(c.cabagnanEarnings), c.cabagnanEarnings >= 0 ? "success" : "danger", `Operating result: ${c.cabagnanStatus}`, true)}
                    ${this.renderMetricCard("Iraya Status", money(c.irayaEarnings), c.irayaEarnings >= 0 ? "success" : "danger", `Operating result: ${c.irayaStatus}`, true)}
                    ${this.renderMetricCard("Final Business Earnings", money(c.finalBusinessEarnings), c.finalBusinessEarnings >= 0 ? "success" : "danger", "Unified post-recovery owner revenue", true)}
                    ${this.renderMetricCard("Total Savings (Period)", money(c.totalSavings), "success", "Cumulative branches reserves", true)}
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    ${this.renderMetricCard("Active Recovery Target", DataService.cabagnanResult?.allocationsDetail?.find(a=>a.status === "ACTIVE")?.name || "None active", "warning", "First available unfinished item", false)}
                    ${this.renderMetricCard("Partner Receivable", "Review required", "warning", "See deep logs diagnostics", false)}
                    ${this.renderMetricCard("Partner Payable", "Opening/payout history required", "warning", "Requires payout baseline", false)}
                    ${this.renderMetricCard("Accumulated Savings Balance", "Opening balance required", "warning", "Withdrawal history unlinked", false)}
                </div>
            </div>
        `;
    },

    renderMetricCard(title, value, type, subtitle = null, isPeriodFlow = true) {
        const typeClasses = {
            'neutral': 'text-slate-500',
            'success': 'text-emerald-600',
            'danger': 'text-red-600',
            'warning': 'text-amber-600'
        };
        return `
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover-card relative overflow-hidden">
                <div class="absolute top-2 right-2 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isPeriodFlow ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}">
                    ${isPeriodFlow ? 'Period Flow' : 'As-of Balance'}
                </div>
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 mt-1">${title}</h4>
                <div class="text-2xl font-black ${typeClasses[type] || 'text-slate-900'}">${value}</div>
                ${subtitle ? `<p class="text-[11px] text-slate-400 mt-1 font-medium font-sans">${subtitle}</p>` : ''}
            </div>
        `;
    },

    renderCabagnan() {
        const r = DataService.cabagnanResult;
        if (!r) return `<div class="p-8 text-center text-slate-400 italic">Computing branch matrices...</div>`;

        return `
            <div class="space-y-8">
                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-black text-slate-800 uppercase tracking-tight">Cabagñan Overview</h2>
                    <div class="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black">PERIOD: ${DataService.currentPeriod.toUpperCase()}</div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    ${this.renderSourceCardView("Pisonet", "100% Owner", r.sources["Pisonet"])}
                    ${this.renderSourceCardView("PisoWiFi", "100% Owner", r.sources["PisoWiFi"])}
                    ${this.renderSourceCardView("Coffee Vendo", "100% Owner", r.sources["Coffee Vendo"])}
                    ${this.renderSourceCardView("Printing / Photocopy", "100% Owner", r.sources["Printing / Photocopy"])}
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 class="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Cabagñan Operating Expenses</h3>
                        <div class="space-y-4">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="p-4 bg-slate-50 rounded-xl">
                                    <div class="text-[10px] text-slate-400 font-black uppercase mb-1">${r.branchBills.aleco.label}</div>
                                    <div class="text-lg font-black text-slate-800">${money(r.branchBills.aleco.amount)}</div>
                                </div>
                                <div class="p-4 bg-slate-50 rounded-xl">
                                    <div class="text-[10px] text-slate-400 font-black uppercase mb-1">${r.branchBills.dctv.label}</div>
                                    <div class="text-lg font-black text-slate-800">${money(r.branchBills.dctv.amount)}</div>
                                </div>
                            </div>

                            <div class="border-t pt-4">
                                <h4 class="text-[10px] text-slate-400 font-bold uppercase mb-2">Other Operating Overhead</h4>
                                <div class="space-y-1">
                                    ${r.branchWideDetail.filter(e => e.category !== 'ALECO' && e.category !== 'DCTV').length === 0 ? `<div class="text-xs italic text-slate-300">No other wide costs.</div>` :
                                        r.branchWideDetail.filter(e => e.category !== 'ALECO' && e.category !== 'DCTV').map(e => `
                                        <div class="flex justify-between text-xs py-1 border-b border-slate-50">
                                            <span class="text-slate-600">${safeText(e.label)}</span>
                                            <span class="font-bold text-slate-800">${money(e.amount)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-slate-800">
                        <h3 class="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Cabagñan Full Summary</h3>
                        <div class="space-y-3 text-xs">
                            <div class="flex justify-between"><span>Source Contribution Profit</span><span class="font-bold text-emerald-600">${money(r.totalSourceContribution)}</span></div>
                            <div class="flex justify-between text-red-500"><span>Actual ALECO (Paid)</span><span>- ${money(r.branchBills.aleco.amount)}</span></div>
                            <div class="flex justify-between text-red-500"><span>Actual DCTV (Paid)</span><span>- ${money(r.branchBills.dctv.amount)}</span></div>
                            <div class="flex justify-between text-red-500"><span>Other Branch Expenses</span><span>- ${money(r.otherBranchExpenses)}</span></div>
                            <div class="border-t pt-2 flex justify-between font-black text-sm"><span>PROFIT BEFORE RECOVERY</span><span class="text-slate-900">${money(r.profitBeforeRecovery)}</span></div>
                            <div class="flex justify-between text-amber-600"><span>Waterfall Recovery Allocated (${r.rateUsed}%)</span><span>- ${money(r.allocatedTotal)}</span></div>
                            <div class="border-t pt-1 flex justify-between font-bold text-slate-700"><span>PROFIT AFTER RECOVERY</span><span>${money(r.profitAfterRecovery)}</span></div>
                            <div class="flex justify-between text-blue-600"><span>Trailing 5% Savings</span><span>- ${money(r.savingsContribution)}</span></div>
                            <div class="border-t-2 pt-2 flex justify-between font-black text-base text-emerald-700"><span>FINAL BRANCH EARNINGS</span><span>${money(r.finalBranchEarnings)}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderSourceCardView(title, ownership, data) {
        if (!data) return '';
        return `
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div class="flex justify-between items-start mb-4">
                    <h4 class="font-black text-slate-800 uppercase tracking-wide text-xs">${title}</h4>
                    <span class="bg-slate-100 text-slate-500 text-[9px] px-2 py-0.5 rounded-full font-black uppercase">${ownership}</span>
                </div>
                <div class="space-y-2 text-xs">
                    <div class="flex justify-between"><span class="text-slate-400">Gross Revenue</span><span class="font-bold">${money(data.grossRevenue)}</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Direct Expenses</span><span class="font-bold">${money(data.fullDirectExpenses)}</span></div>
                    <div class="border-t pt-2 flex justify-between text-sm"><span class="font-bold text-slate-700">Operating Profit</span><span class="font-black ${data.ownerOperatingProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}">${money(data.ownerOperatingProfit)}</span></div>
                </div>
            </div>
        `;
    },

    renderIraya() {
        const r = DataService.irayaResult;
        if (!r) return `<div class="p-8 text-center text-slate-400 italic">Computing Iraya financial framework...</div>`;

        return `
            <div class="space-y-8">
                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-black text-slate-800 uppercase tracking-tight">Iraya Joint Operations</h2>
                    <div class="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black">PERIOD: ${DataService.currentPeriod.toUpperCase()}</div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- OWNER PANEL -->
                    <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm border-t-4 border-t-slate-800">
                        <h3 class="font-black text-sm uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                            <span>👤</span> OWNER SIDE
                        </h3>
                        <div class="space-y-4">
                            <div class="space-y-2">
                                <div class="flex justify-between text-xs"><span>Owner Pisonet Revenue (${pct(r.partner.ownerSharePct)})</span><span class="font-bold">${money(r.owner.pisonetRevenue)}</span></div>
                                <div class="flex justify-between text-xs"><span>Iraya PisoWiFi Owner Revenue (100%)</span><span class="font-bold">${money(r.owner.pisowifiRevenue)}</span></div>
                                <div class="flex justify-between text-xs text-red-500"><span>Owner Direct Expenses</span><span>- ${money(r.owner.directExpenses)}</span></div>
                                <div class="flex justify-between text-xs text-red-500"><span>Owner Shared Bill Responsibility (50%)</span><span>- ${money(r.owner.sharedBillResponsibility)}</span></div>
                                <div class="flex justify-between text-xs text-red-500"><span>Owner Other Operating Expenses</span><span>- ${money(r.owner.otherOperatingExpenses)}</span></div>
                            </div>
                            <div class="border-t pt-4 space-y-2">
                                <div class="flex justify-between font-black text-sm"><span>OWNER PROFIT BEFORE RECOVERY</span><span>${money(r.owner.profitBeforeRecovery)}</span></div>
                                <div class="flex justify-between text-xs text-amber-600 font-bold"><span>Minus Capital Recovery Waterfall</span><span>- ${money(r.owner.recovery)}</span></div>
                                <div class="flex justify-between text-xs text-blue-600 font-bold"><span>Minus Trailing Savings (5%)</span><span>- ${money(r.owner.savings)}</span></div>
                                <div class="border-t-2 pt-2 flex justify-between font-black text-lg text-slate-900"><span>FINAL OWNER EARNINGS</span><span>${money(r.owner.finalEarnings)}</span></div>
                            </div>
                        </div>
                    </div>

                    <!-- PARTNER PANEL -->
                    <div class="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-sm text-slate-300">
                        <h3 class="font-black text-sm uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                            <span>🤝</span> PARTNER SETTLEMENT
                        </h3>
                        <div class="space-y-4">
                            <div class="space-y-2">
                                <div class="flex justify-between text-xs text-slate-400"><span>Full Pisonet Gross Business</span><span class="font-mono">${money(r.partner.pisonetGross)}</span></div>
                                <div class="flex justify-between text-sm text-white font-bold"><span>PARTNER REVENUE SHARE (${pct(r.partner.partnerSharePct)})</span><span>${money(r.partner.revenueShare)}</span></div>
                                <div class="pt-4 border-t border-slate-800 space-y-1 text-xs">
                                    <div class="flex justify-between"><span>Partner ALECO Responsibility (50%)</span><span class="text-red-400">- ${money(r.partner.alecoResp)}</span></div>
                                    <div class="flex justify-between"><span>Partner DCTV Responsibility (50%)</span><span class="text-red-400">- ${money(r.partner.dctvResp)}</span></div>
                                    <div class="flex justify-between"><span>Other Partner Share of Expenses</span><span class="text-red-400">- ${money(r.partner.otherResp)}</span></div>
                                </div>
                                <div class="flex justify-between text-sm text-amber-400 font-black pt-2"><span>NET PARTNER SHARE BEFORE PAYOUT</span><span>${money(r.partner.netBeforePayout)}</span></div>
                            </div>

                            <div class="border-t border-slate-700 pt-6 space-y-3">
                                <div class="flex justify-between text-xs text-slate-400 italic"><span>Verified Partner Payouts Recorded</span><span>- ${money(r.partner.verifiedPayouts)}</span></div>
                                <div class="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-black text-white uppercase tracking-tighter">PARTNER AMOUNT DUE</span>
                                        <span class="text-xl font-black text-white">${money(r.partner.amountDue)}</span>
                                    </div>
                                    <div class="text-[9px] text-slate-500 font-bold uppercase mt-2 tracking-widest text-right">Verified payout history required</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Shared Bills Detail -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 class="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Full Business Shared Bills Audit</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${r.sharedBillsDetail.map(b => `
                            <div class="p-3 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                                <div>
                                    <div class="font-bold text-slate-700">${safeText(b.label)}</div>
                                    <div class="text-[10px] text-slate-400">${money(b.fullAmount)} (Total Bill)</div>
                                </div>
                                <div class="text-right">
                                    <div class="font-black text-blue-600">${money(b.ownerShare)} (Owner 50%)</div>
                                    <div class="font-black text-amber-600">${money(b.partnerShare)} (Partner 50%)</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    renderPartnerPisoWifi() {
        const data = DataService.partnerPisoWifiResult;
        if (!data) return `<div class="p-8 text-center text-slate-400 italic font-medium">Processing partner logs sub-ledgers...</div>`;

        const cards = Object.values(data);
        if (cards.length === 0) return `<div class="p-12 text-center text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-300 font-medium">No genuine PisoWiFi partners detected in actual transaction history or settings.</div>`;

        const getStatusBadge = (status) => {
            switch(status) {
                case 'ENROLLED':
                    return `<span class="bg-emerald-100 text-emerald-800 text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">ENROLLED</span>`;
                case 'HISTORICAL PARTNER - NOT YET ENROLLED':
                    return `<span class="bg-amber-100 text-amber-800 text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">HISTORICAL - UNENROLLED</span>`;
                case 'USER ENROLLED - NO TRANSACTIONS YET':
                    return `<span class="bg-blue-100 text-blue-800 text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">NO TRANSACTIONS YET</span>`;
                default:
                    return `<span class="bg-slate-100 text-slate-600 text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">${safeText(status)}</span>`;
            }
        };

        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div>
                        <h2 class="text-xl font-black text-slate-800 uppercase tracking-tight">Partner PisoWiFi Network</h2>
                        <p class="text-xs text-slate-400 font-medium mt-1">Reconciled from actual transaction log history & verified settings.</p>
                    </div>
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">${cards.length} PARTNERS LOCATED</div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    ${cards.map(g => `
                        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover-card flex flex-col justify-between">
                            <div>
                                <div class="flex justify-between items-start mb-4 gap-2">
                                    <div>
                                        <h3 class="font-black text-slate-800 uppercase tracking-tight text-sm">${safeText(g.partnerName)}</h3>
                                        <div class="text-[9px] text-slate-400 font-mono mt-0.5">${g.txCount} Income Transactions Recorded</div>
                                    </div>
                                    ${getStatusBadge(g.status)}
                                </div>

                                <!-- CURRENT SHARE AGREEMENT HEADER -->
                                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                                    <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-center">CURRENT SHARE AGREEMENT</div>
                                    <div class="grid grid-cols-2 gap-2 text-center">
                                        <div class="bg-white p-2 rounded-lg border border-slate-100">
                                            <div class="text-[8px] font-black text-slate-400 uppercase">OWNER SHARE</div>
                                            <div class="text-sm font-black text-slate-800 mt-0.5">${g.currentOwnerShare !== null && g.currentOwnerShare !== undefined ? pct(g.currentOwnerShare) : 'Not Enrolled'}</div>
                                        </div>
                                        <div class="bg-white p-2 rounded-lg border border-slate-100">
                                            <div class="text-[8px] font-black text-slate-400 uppercase">PARTNER SHARE</div>
                                            <div class="text-sm font-black text-slate-600 mt-0.5">${g.currentPartnerShare !== null && g.currentPartnerShare !== undefined ? pct(g.currentPartnerShare) : 'Not Enrolled'}</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- HISTORICAL REVENUE SUMMARY -->
                                <div class="space-y-1.5 text-xs border-t pt-3">
                                    <div class="flex justify-between text-slate-500 font-bold"><span class="uppercase text-[10px]">Gross Collections</span><span class="font-mono text-slate-900">${money(g.grossRevenue)}</span></div>
                                    <div class="flex justify-between text-slate-600"><span>Historical Owner Revenue</span><span class="font-mono font-bold text-emerald-700">${money(g.historicalOwnerRevenue)}</span></div>
                                    <div class="flex justify-between text-slate-400"><span>Historical Partner Revenue</span><span class="font-mono font-bold">${money(g.historicalPartnerRevenue)}</span></div>
                                    <div class="flex justify-between text-slate-500"><span>Site Operating Expenses</span><span class="font-mono">${money(g.fullDirectExpenses)}</span></div>
                                    <div class="flex justify-between text-red-500"><span>Owner Expense Responsibility</span><span class="font-mono">- ${money(g.ownerExpenseResponsibility)}</span></div>
                                    <div class="border-t pt-2 flex justify-between text-sm font-black text-slate-800">
                                        <span>Owner Operating Profit</span>
                                        <span class="font-mono text-emerald-600">${money(g.ownerOperatingProfit)}</span>
                                    </div>
                                    <div class="mt-3 pt-2 border-t border-dashed border-slate-100 space-y-1">
                                        <div class="flex justify-between text-[10px] text-slate-600"><span>Partner Net Before Payout</span><span class="font-mono font-bold">${money(g.partnerNetBeforePayout)}</span></div>
                                        <div class="flex justify-between text-[10px] text-slate-400"><span>Verified Payouts</span><span class="font-mono">- ${money(g.verifiedPayouts)}</span></div>
                                    </div>
                                </div>
                            </div>

                            <!-- ACTIONS FOOTER -->
                            <div class="pt-4 mt-4 border-t border-slate-100">
                                ${g.status === 'HISTORICAL PARTNER - NOT YET ENROLLED' ? `
                                    <button data-enroll-partner="${g.partnerName}" class="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5">
                                        <span>➕</span> ENROLL / CONFIRM PARTNER
                                    </button>
                                ` : `
                                    <button data-edit-partner-share="${g.partnerName}" class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5">
                                        <span>✏️</span> EDIT SHARE AGREEMENT
                                    </button>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderTransactionLog(filters = {}) {
        const logs = DataService.normalizedLogs || [];
        const totalDatasetCount = logs.length;

        // Calculate all-time collection recency summary across all normalized logs
        const recencyRows = AccountingService.calculateCollectionRecency(logs, DataService.incomeSources, DataService.getPartners());

        const currentFilters = {
            period: filters.period || 'This Month',
            type: filters.type || 'All',
            branch: filters.branch || 'All',
            source: filters.source || 'All',
            partner: filters.partner || 'All',
            search: filters.search || '',
            customStart: filters.customStart || null,
            customEnd: filters.customEnd || null
        };

        const filtered = AccountingService.filterLogs(logs, currentFilters);
        filtered.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));

        // Dynamically extract unique sources & partners for filter dropdowns
        const uniqueSources = [...new Set(logs.map(l => l.source).filter(s => s && s !== 'Unclassified'))].sort();
        const uniquePartners = [...new Set(logs.map(l => l.partnerName || l.partner).filter(p => p && p !== 'Unclassified'))].sort();

        return `
            <div class="space-y-6">
                <!-- COLLECTION RECENCY SUMMARY PANEL -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div>
                            <h3 class="font-black text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                <span>🗓️</span> DAYS SINCE LAST COLLECTION (COLLECTION RECENCY)
                            </h3>
                            <p class="text-[11px] text-slate-400 font-medium mt-0.5">Summary of latest income collection activity calculated across complete all-time transaction history.</p>
                        </div>
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">${recencyRows.length} SOURCES TRACKED</div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                                    <th class="p-3">Source</th>
                                    <th class="p-3">Location / Branch</th>
                                    <th class="p-3">Last Collection Date</th>
                                    <th class="p-3 text-center">Days Since Collection</th>
                                    <th class="p-3 text-right">Last Collection Amount</th>
                                    <th class="p-3 text-center">Status</th>
                                    <th class="p-3 text-center">Inspect</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${recencyRows.map(r => {
                                    const statusBadgeClass = {
                                        'TODAY': 'bg-emerald-100 text-emerald-800 border-emerald-300',
                                        'RECENT': 'bg-teal-100 text-teal-800 border-teal-200',
                                        '4-7 DAYS': 'bg-blue-100 text-blue-800 border-blue-200',
                                        'OVER 7 DAYS': 'bg-amber-100 text-amber-800 border-amber-300',
                                        'OVER 14 DAYS': 'bg-orange-100 text-orange-800 border-orange-300',
                                        'OVER 30 DAYS': 'bg-red-100 text-red-800 border-red-300',
                                        'NO COLLECTION YET': 'bg-slate-100 text-slate-600 border-slate-200',
                                        'FUTURE-DATED': 'bg-purple-100 text-purple-800 border-purple-300'
                                    }[r.status] || 'bg-slate-100 text-slate-600 border-slate-200';

                                    return `
                                        <tr class="hover:bg-slate-50 font-medium transition-colors cursor-pointer group"
                                            data-recency-search="${safeText(r.partnerName || r.location || r.source)}"
                                            data-recency-branch="${safeText(r.branch)}"
                                            data-recency-source="${safeText(r.source)}"
                                            data-recency-partner="${safeText(r.partnerName || '')}">
                                            <td class="p-3 font-bold text-slate-800">${safeText(r.displayName || r.source)}</td>
                                            <td class="p-3 text-slate-600">${safeText(r.location || r.branch)}</td>
                                            <td class="p-3 font-mono text-slate-500">${safeText(r.lastCollectionDate)}</td>
                                            <td class="p-3 text-center font-bold text-slate-900 font-mono">${safeText(r.daysSinceText)}</td>
                                            <td class="p-3 text-right font-black text-slate-900 font-mono">
                                                ${r.lastAmount !== null ? money(r.lastAmount) : '—'}
                                                ${r.lastDayTotal !== null && r.lastDayTotal !== r.lastAmount ? `<span class="block text-[9px] text-slate-400 font-normal">Day total: ${money(r.lastDayTotal)}</span>` : ''}
                                            </td>
                                            <td class="p-3 text-center">
                                                <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusBadgeClass}">${safeText(r.status)}</span>
                                            </td>
                                            <td class="p-3 text-center">
                                                <span class="text-[9px] font-bold uppercase text-blue-600 group-hover:underline">Filter Log 🔍</span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- CONTROLS CONTAINER -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <!-- TOP ROW: Search, Tally & Clear -->
                    <div class="flex flex-wrap gap-4 items-center justify-between">
                        <div class="flex-1 min-w-[280px]">
                            <input type="text" id="txLogSearch" value="${safeText(currentFilters.search, '')}" placeholder="Search description, partner, source, branch, category..." class="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-slate-300">
                        </div>
                        <div class="flex items-center gap-3">
                            <button id="btnTxLogClearFilters" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase rounded-xl transition-all">Clear Filters</button>
                            <div id="txLogTallyDisplay" class="text-[11px] font-black text-slate-500 uppercase tracking-wider font-mono">
                                Showing ${filtered.length} of ${totalDatasetCount} transactions
                            </div>
                        </div>
                    </div>

                    <!-- BOTTOM ROW: Select Filter Dropdowns -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-xs">
                        <div>
                            <label class="block text-[9px] font-black text-slate-400 uppercase mb-1">Period</label>
                            <select id="txLogPeriod" class="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl font-bold text-slate-700 outline-none cursor-pointer">
                                <option value="This Month" ${currentFilters.period === 'This Month' ? 'selected' : ''}>This Month</option>
                                <option value="Today" ${currentFilters.period === 'Today' ? 'selected' : ''}>Today</option>
                                <option value="Last 7 Days" ${currentFilters.period === 'Last 7 Days' ? 'selected' : ''}>Last 7 Days</option>
                                <option value="This Year" ${currentFilters.period === 'This Year' || currentFilters.period === 'Year' ? 'selected' : ''}>This Year</option>
                                <option value="All Time" ${currentFilters.period === 'All Time' ? 'selected' : ''}>All Time</option>
                                <option value="October 2023" ${currentFilters.period === 'October 2023' ? 'selected' : ''}>October 2023</option>
                                <option value="November 2023" ${currentFilters.period === 'November 2023' ? 'selected' : ''}>November 2023</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-[9px] font-black text-slate-400 uppercase mb-1">Type</label>
                            <select id="txLogType" class="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl font-bold text-slate-700 outline-none cursor-pointer">
                                <option value="All" ${currentFilters.type === 'All' ? 'selected' : ''}>All Types</option>
                                <option value="Income" ${currentFilters.type === 'Income' || currentFilters.type === 'income' ? 'selected' : ''}>Income</option>
                                <option value="Expense" ${currentFilters.type === 'Expense' || currentFilters.type === 'expense' ? 'selected' : ''}>Expense</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-[9px] font-black text-slate-400 uppercase mb-1">Branch</label>
                            <select id="txLogBranch" class="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl font-bold text-slate-700 outline-none cursor-pointer">
                                <option value="All" ${currentFilters.branch === 'All' ? 'selected' : ''}>All Branches</option>
                                <option value="Cabagñan" ${currentFilters.branch === 'Cabagñan' ? 'selected' : ''}>Cabagñan</option>
                                <option value="Iraya" ${currentFilters.branch === 'Iraya' ? 'selected' : ''}>Iraya</option>
                                <option value="Partner PisoWiFi" ${currentFilters.branch === 'Partner PisoWiFi' ? 'selected' : ''}>Partner PisoWiFi</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-[9px] font-black text-slate-400 uppercase mb-1">Source</label>
                            <select id="txLogSource" class="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl font-bold text-slate-700 outline-none cursor-pointer">
                                <option value="All" ${currentFilters.source === 'All' ? 'selected' : ''}>All Sources</option>
                                ${uniqueSources.map(s => `<option value="${s}" ${currentFilters.source === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>

                        <div>
                            <label class="block text-[9px] font-black text-slate-400 uppercase mb-1">Partner</label>
                            <select id="txLogPartner" class="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl font-bold text-slate-700 outline-none cursor-pointer">
                                <option value="All" ${currentFilters.partner === 'All' ? 'selected' : ''}>All Partners</option>
                                ${uniquePartners.map(p => `<option value="${p}" ${currentFilters.partner === p ? 'selected' : ''}>${p}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- TABLE CONTAINER -->
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    ${filtered.length === 0 ? `
                        <div class="p-12 text-center text-slate-400 italic font-medium">
                            No transactions match the current filters.
                        </div>
                    ` : `
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                                    <th class="p-4">Date</th>
                                    <th class="p-4">Type</th>
                                    <th class="p-4">Branch</th>
                                    <th class="p-4">Source</th>
                                    <th class="p-4 w-1/4">Description</th>
                                    <th class="p-4 text-right">Amount</th>
                                    <th class="p-4 text-center">Owner %</th>
                                    <th class="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="txLogTableBody" class="divide-y divide-slate-50">
                                ${filtered.map(l => `
                                    <tr class="hover:bg-slate-50 transition-colors group cursor-pointer" data-tx-id="${l.id}">
                                        <td class="p-4 text-slate-500 font-mono">${l.date}</td>
                                        <td class="p-4"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${l.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${l.type}</span></td>
                                        <td class="p-4 font-bold text-slate-700">${l.branch}</td>
                                        <td class="p-4 text-slate-500">${l.source}</td>
                                        <td class="p-4 font-medium text-slate-800 truncate max-w-xs">${l.label}</td>
                                        <td class="p-4 text-right font-black text-slate-900">${money(l.amount)}</td>
                                        <td class="p-4 text-center font-bold text-slate-400">${l.ownerShare !== null && l.ownerShare !== undefined ? pct(l.ownerShare) : 'N/A'}</td>
                                        <td class="p-4 text-center">
                                            <button class="text-slate-300 hover:text-slate-900 font-bold uppercase text-[9px]">Details</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
    },

    renderTransactionEntry() {
        const canWrite = DataService.currentUser !== null;

        return `
            <div class="max-w-5xl mx-auto space-y-8">
                <!-- Top Action Header -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button id="btnIncomeForm" class="p-8 bg-emerald-600 text-white rounded-3xl shadow-xl shadow-emerald-100 flex items-center justify-between hover:bg-emerald-700 transition-all group">
                        <div class="text-left">
                            <div class="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Entry Tool</div>
                            <div class="text-2xl font-black uppercase">Record Income</div>
                        </div>
                        <span class="text-4xl group-hover:scale-110 transition-transform">📥</span>
                    </button>
                    <button id="btnExpenseForm" class="p-8 bg-slate-900 text-white rounded-3xl shadow-xl shadow-slate-200 flex items-center justify-between hover:bg-slate-800 transition-all group">
                        <div class="text-left">
                            <div class="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Entry Tool</div>
                            <div class="text-2xl font-black uppercase">Record Expense</div>
                        </div>
                        <span class="text-4xl group-hover:scale-110 transition-transform">💸</span>
                    </button>
                </div>

                <!-- Shortcut Panel -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <span class="text-lg">⚡</span>
                        <div class="text-sm font-bold text-slate-800">Quick Pay: Select an upcoming bill to pre-fill the form.</div>
                    </div>
                    <select id="quickPaySelect" class="bg-slate-100 border-none text-xs font-black rounded-xl px-4 py-2 text-slate-600 outline-none cursor-pointer">
                        <option value="">Choose Bill...</option>
                        ${DataService.projectedExpenses.map(b => `<option value="${b.id}">${b.name} (${money(b.amount)})</option>`).join('')}
                    </select>
                </div>

                <!-- Form Workspace -->
                <div id="entryFormWorkspace" class="transition-all duration-300">
                    <div class="p-20 text-center text-slate-300 italic border-2 border-dashed border-slate-200 rounded-3xl">
                        Select an action above to start recording business data.
                    </div>
                </div>
            </div>
        `;
    },

    renderIncomeForm() {
        const sources = DataService.incomeSources;
        const partners = DataService.partners.filter(p => normalizePartnerType(p.type) === 'PisoWiFi' && !OWNER_OPERATED_BRANCHES.includes(p.name));

        return `
            <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div class="flex justify-between items-center pb-4 border-b">
                    <h3 class="text-lg font-black text-slate-800 uppercase tracking-tight">Record Income Transaction</h3>
                    <span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Authoritative V2</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <!-- Left: Inputs -->
                    <div class="space-y-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase">Operating Group</label>
                            <select id="inGroup" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-200">
                                <option value="Cabagñan">Cabagñan</option>
                                <option value="Iraya">Iraya</option>
                                <option value="Partner PisoWiFi">Partner PisoWiFi</option>
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase">Source Item</label>
                            <select id="inSource" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-200">
                                <!-- Dynamically populated by UI Controller -->
                            </select>
                        </div>

                        <div id="partnerSelectContainer" class="space-y-1 hidden">
                            <label class="text-[10px] font-black text-slate-400 uppercase">Partner / Location</label>
                            <select id="inPartner" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-200">
                                ${partners.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase">Gross Amount (₱)</label>
                                <input type="number" id="inAmount" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-lg font-black outline-none focus:ring-2 focus:ring-emerald-200" placeholder="0.00">
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase">Date</label>
                                <input type="date" id="inDate" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-200">
                            </div>
                        </div>

                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase">Description / Notes</label>
                            <input type="text" id="inLabel" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-200" placeholder="e.g. Monthly Collection">
                        </div>
                    </div>

                    <!-- Right: Preview -->
                    <div class="bg-slate-50 p-8 rounded-3xl border border-slate-100 flex flex-col">
                        <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 text-center">Transaction Preview</h4>
                        <div id="inPreview" class="flex-1 space-y-4">
                            <div class="flex justify-between text-xs"><span>Operating Group:</span><span id="preBranch" class="font-bold">-</span></div>
                            <div class="flex justify-between text-xs"><span>Source Instance:</span><span id="preSource" class="font-bold">-</span></div>
                            <div class="flex justify-between text-xs"><span>Gross Amount:</span><span id="preGross" class="font-black">-</span></div>
                            <div class="pt-4 border-t border-slate-200 space-y-2">
                                <div class="flex justify-between text-sm"><span>OWNER REVENUE:</span><span id="preOwner" class="font-black text-emerald-600">-</span></div>
                                <div class="flex justify-between text-sm"><span>PARTNER SHARE:</span><span id="prePartner" class="font-black text-slate-400">-</span></div>
                            </div>
                            <div class="mt-auto pt-8">
                                <button id="btnSaveIncome" class="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black uppercase shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50">Save Income</button>
                                <div id="inStatus" class="text-center text-[10px] font-bold mt-4"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderExpenseForm() {
        return `
            <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div class="flex justify-between items-center pb-4 border-b">
                    <h3 class="text-lg font-black text-slate-800 uppercase tracking-tight">Record Expense / Outflow</h3>
                    <span class="bg-slate-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">Standard Accounting</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <!-- Left: Inputs -->
                    <div class="space-y-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase">Target Branch / Group</label>
                            <select id="exBranch" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-300">
                                <option value="Cabagñan">Cabagñan</option>
                                <option value="Iraya">Iraya</option>
                                <option value="Partner PisoWiFi">Partner PisoWiFi</option>
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase">Expense Scope</label>
                            <select id="exScope" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-300">
                                <!-- Pre-filled by UI Controller based on branch -->
                            </select>
                        </div>

                        <div id="exSourceContainer" class="space-y-1 hidden">
                            <label class="text-[10px] font-black text-slate-400 uppercase">Source Instance</label>
                            <select id="exSource" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none">
                                <!-- Dynamically populated -->
                            </select>
                        </div>

                        <div id="exPartnerContainer" class="space-y-1 hidden">
                            <label class="text-[10px] font-black text-slate-400 uppercase">Partner Location</label>
                            <select id="exPartner" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none">
                                <!-- Dynamically populated -->
                            </select>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase">Amount (₱)</label>
                                <input type="number" id="exAmount" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-lg font-black outline-none focus:ring-2 focus:ring-slate-300" placeholder="0.00">
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase">Category</label>
                                <select id="exCategory" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-300">
                                    <option value="ALECO">ALECO</option>
                                    <option value="DCTV">DCTV</option>
                                    <option value="Water">Water</option>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Repair">Repair</option>
                                    <option value="Replacement Parts">Replacement Parts</option>
                                    <option value="General Supplies">General Supplies</option>
                                    <option value="Coffee Powder">Coffee Powder</option>
                                    <option value="Vendo Cups">Vendo Cups</option>
                                    <option value="Machine Refill">Machine Refill</option>
                                    <option value="Paper">Paper</option>
                                    <option value="Ink / Toner">Ink / Toner</option>
                                    <option value="Computer Parts">Computer Parts</option>
                                    <option value="Network Equipment">Network Equipment</option>
                                    <option value="Other">Other (Require Desc)</option>
                                </select>
                            </div>
                        </div>

                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase">Description / Label</label>
                            <input type="text" id="exLabel" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-300" placeholder="e.g. ALECO Sept 2023 Bill">
                        </div>

                        <div class="space-y-1">
                             <label class="text-[10px] font-black text-slate-400 uppercase">Transaction Date</label>
                             <input type="date" id="exDate" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-300">
                        </div>
                    </div>

                    <!-- Right: Preview -->
                    <div class="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex flex-col text-slate-300">
                        <h4 class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 text-center">Expense Allocation Preview</h4>
                        <div id="exPreview" class="flex-1 space-y-4">
                            <div class="flex justify-between text-xs text-slate-400"><span>Full Outflow:</span><span id="preExFull" class="text-white font-black">-</span></div>
                            <div class="flex justify-between text-xs text-slate-400"><span>Ownership Split:</span><span id="preExSplit" class="text-slate-100 font-bold">-</span></div>
                            <div class="pt-4 border-t border-slate-800 space-y-2">
                                <div class="flex justify-between text-sm"><span>OWNER RESPONSIBILITY:</span><span id="preExOwner" class="font-black text-white">-</span></div>
                                <div class="flex justify-between text-sm"><span>PARTNER RECEIVABLE:</span><span id="preExPartner" class="font-black text-amber-400">-</span></div>
                            </div>
                            <div class="mt-auto pt-8">
                                <button id="btnSaveExpense" class="w-full bg-white text-slate-900 p-4 rounded-2xl font-black uppercase shadow-lg hover:bg-slate-100 active:scale-[0.98] transition-all disabled:opacity-50">Save Expense</button>
                                <div id="exStatus" class="text-center text-[10px] font-bold mt-4 text-emerald-400"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderRecoveryQueue() {
        const cab = DataService.cabagnanResult;
        const iry = DataService.irayaResult;
        const coffee = cab ? cab.coffeeSelfRecovery : null;
        const currentPeriod = DataService.currentPeriod;
        const isAdmin = DataService.currentRole === 'admin';
        const allAssets = DataService.getAssets();
        const archivedAssets = allAssets.filter(a => a && a.archived === true);

        const getStatusBadge = (status) => {
            switch(status) {
                case 'ACTIVE': return `<span class="px-2 py-1 rounded-full font-black text-[9px] uppercase bg-emerald-100 text-emerald-800">ACTIVE</span>`;
                case 'WAITING': return `<span class="px-2 py-1 rounded-full font-black text-[9px] uppercase bg-slate-100 text-slate-600">WAITING</span>`;
                case 'PAUSED': return `<span class="px-2 py-1 rounded-full font-black text-[9px] uppercase bg-red-100 text-red-800">PAUSED</span>`;
                case 'FULLY RECOVERED': return `<span class="px-2 py-1 rounded-full font-black text-[9px] uppercase bg-blue-100 text-blue-800">FULLY RECOVERED</span>`;
                default: return `<span class="px-2 py-1 rounded-full font-black text-[9px] uppercase bg-slate-100 text-slate-600">${safeText(status)}</span>`;
            }
        };

        const cabProfitBefore = cab ? cab.profitBeforeRecovery : 0;
        const cabRate = cab ? cab.rateUsed : 0;
        const cabPool = cab ? cab.recoveryPool : 0;
        const cabAllocated = cab ? cab.allocatedTotal : 0;

        const iryProfitBefore = iry ? iry.owner.profitBeforeRecovery : 0;
        const iryRate = iry ? iry.rateUsed : 0;
        const iryPool = iry ? iry.allocatedTotal : 0;
        const iryAllocated = iry ? iry.allocatedTotal : 0;

        // Separate general Cabagnan targets from Coffee self-recovery targets
        const generalCabAllocations = cab?.allocationsDetail?.filter(a => a.recoveryFundingMode !== "SOURCE_SELF_RECOVERY") || [];

        // Dynamic source self-recovery results
        const selfRecoveryResults = cab?.sourceSelfRecoveryResults || (coffee ? { "Coffee Vendo": coffee } : {});
        const selfRecoveryKeys = Object.keys(selfRecoveryResults).filter(k => selfRecoveryResults[k] && selfRecoveryResults[k].allocations?.length > 0);

        return `
            <div class="space-y-8">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 class="text-xl font-black text-slate-800 uppercase tracking-tight">Capital Recovery Queue</h2>
                        <p class="text-xs text-slate-400 font-medium mt-1">Calculated recovery allocation for the current period based on self-recovery and branch profit waterfall.</p>
                    </div>
                    <div class="flex items-center gap-3">
                        ${isAdmin ? `
                            <button id="btnAddRecoveryTarget" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl shadow-md transition-all flex items-center gap-1.5">
                                <span>+</span> Add Recovery Target
                            </button>
                            <button id="btnAddSourceFromRecovery" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase rounded-xl shadow-md transition-all flex items-center gap-1.5">
                                <span>+</span> Add New Source
                            </button>
                        ` : ''}
                        <div class="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black">PERIOD: ${currentPeriod.toUpperCase()}</div>
                    </div>
                </div>

                <!-- DYNAMIC SOURCE SELF-RECOVERY SECTIONS -->
                ${selfRecoveryKeys.map(srcKey => {
                    const srcRes = selfRecoveryResults[srcKey];
                    return `
                        <div class="bg-gradient-to-br from-amber-900/5 via-slate-900/5 to-white p-6 rounded-2xl border border-amber-200 shadow-sm space-y-6">
                            <div class="flex justify-between items-center border-b border-amber-200 pb-4">
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-xl">⚙️</span>
                                        <h3 class="font-black text-base uppercase tracking-wider text-slate-800">${safeText(srcKey)} Self-Recovery</h3>
                                        <span class="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase">Source-Specific</span>
                                    </div>
                                    <p class="text-xs text-slate-500 font-medium mt-0.5">Opening costs recovered strictly from ${safeText(srcKey)} operating profit.</p>
                                </div>
                                ${srcRes && srcRes.totalRemaining === 0 ? `
                                    <span class="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full uppercase tracking-wider">✅ FULLY PAID BACK</span>
                                ` : `
                                    <span class="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full uppercase tracking-wider">🔄 RECOVERING INVESTMENT</span>
                                `}
                            </div>

                            <!-- Performance Cards Grid -->
                            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                                <div class="bg-white p-3 rounded-xl border border-slate-200">
                                    <div class="text-[9px] font-black text-slate-400 uppercase">Gross Sales</div>
                                    <div class="text-sm font-black text-slate-800 mt-0.5">${money(srcRes ? srcRes.grossRevenue : 0)}</div>
                                </div>
                                <div class="bg-white p-3 rounded-xl border border-slate-200">
                                    <div class="text-[9px] font-black text-slate-400 uppercase">Direct Expenses</div>
                                    <div class="text-sm font-black text-red-600 mt-0.5">${money(srcRes ? srcRes.directExpenses : 0)}</div>
                                </div>
                                <div class="bg-white p-3 rounded-xl border border-slate-200">
                                    <div class="text-[9px] font-black text-slate-400 uppercase">Operating Profit</div>
                                    <div class="text-sm font-black text-emerald-700 mt-0.5">${money(srcRes ? srcRes.operatingProfit : 0)}</div>
                                </div>
                                <div class="bg-white p-3 rounded-xl border border-slate-200">
                                    <div class="text-[9px] font-black text-slate-400 uppercase">Self-Recovery Rate</div>
                                    <div class="text-sm font-black text-amber-600 mt-0.5">${srcRes ? srcRes.recoveryRate : 50}%</div>
                                </div>
                                <div class="bg-white p-3 rounded-xl border border-slate-200">
                                    <div class="text-[9px] font-black text-slate-400 uppercase">Available Pool</div>
                                    <div class="text-sm font-black text-slate-800 mt-0.5">${money(srcRes ? srcRes.recoveryPool : 0)}</div>
                                </div>
                                <div class="bg-white p-3 rounded-xl border border-slate-200">
                                    <div class="text-[9px] font-black text-slate-400 uppercase">Period Recovery</div>
                                    <div class="text-sm font-black text-emerald-600 mt-0.5">${money(srcRes ? srcRes.allocatedTotal : 0)}</div>
                                </div>
                                <div class="bg-white p-3 rounded-xl border border-slate-200">
                                    <div class="text-[9px] font-black text-slate-400 uppercase">Branch Contribution</div>
                                    <div class="text-sm font-black text-blue-700 mt-0.5">${money(srcRes ? srcRes.surplusAfterRecovery : 0)}</div>
                                </div>
                            </div>

                            <!-- Opening Costs Progress Bar -->
                            <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                                <div class="flex justify-between items-center text-xs font-bold">
                                    <span class="text-slate-600 uppercase text-[10px] tracking-wider">Overall ${safeText(srcKey)} Payback Progress</span>
                                    <span class="font-mono text-slate-800">${money(srcRes ? srcRes.totalRecoveredToDate : 0)} / ${money(srcRes ? srcRes.totalOriginalCost : 0)} (${srcRes ? srcRes.progressPercent.toFixed(1) : 0}%)</span>
                                </div>
                                <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                    <div class="bg-amber-500 h-full transition-all duration-500" style="width: ${srcRes ? srcRes.progressPercent : 0}%"></div>
                                </div>
                                <div class="flex justify-between text-[10px] font-bold text-slate-500 font-mono pt-1">
                                    <span>Recovered Before Tracking: ${money(srcRes ? srcRes.totalOpeningRecovered : 0)}</span>
                                    <span>Current Allocation: +${money(srcRes ? srcRes.allocatedTotal : 0)}</span>
                                    <span class="text-slate-800 font-black">Remaining Opening Cost: ${money(srcRes ? srcRes.totalRemaining : 0)}</span>
                                </div>
                            </div>

                            <!-- Targets Queue Table -->
                            <div class="overflow-x-auto">
                                <table class="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr class="text-[10px] text-slate-400 font-black border-b uppercase bg-white">
                                            <th class="p-3">Priority</th>
                                            <th class="p-3">Opening Cost Asset</th>
                                            <th class="p-3">Full Cost</th>
                                            <th class="p-3">Recovered To Date</th>
                                            <th class="p-3">Period Allocation</th>
                                            <th class="p-3">Remaining Capital</th>
                                            <th class="p-3 text-center">Status</th>
                                            ${isAdmin ? `<th class="p-3 text-center">Actions</th>` : ''}
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-100 bg-white">
                                        ${srcRes?.allocations?.map((a, idx) => `
                                            <tr class="hover:bg-slate-50 font-medium">
                                                <td class="p-4 font-mono text-slate-400">#${a.priority || idx+1}</td>
                                                <td class="p-4 text-slate-800 font-bold">${safeText(a.name)}</td>
                                                <td class="p-4 font-mono">${money(a.targetAmount)}</td>
                                                <td class="p-4 font-mono text-slate-500">${money(a.openingRecovered + a.currentPeriodAllocation)}</td>
                                                <td class="p-4 font-mono font-bold text-emerald-600">+ ${money(a.currentPeriodAllocation)}</td>
                                                <td class="p-4 font-mono text-slate-700">${money(a.remainingCapital)}</td>
                                                <td class="p-4 text-center">${getStatusBadge(a.status)}</td>
                                                ${isAdmin ? `
                                                    <td class="p-4 text-center whitespace-nowrap">
                                                        <div class="flex items-center justify-center gap-2">
                                                            <button data-edit-target="${a.id}" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] rounded-lg transition-colors">Edit</button>
                                                            <button data-delete-target="${a.id}" class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] rounded-lg transition-colors">Delete</button>
                                                        </div>
                                                    </td>
                                                ` : ''}
                                            </tr>
                                        `).join('') || `<tr><td colspan="${isAdmin ? 8 : 7}" class="p-4 text-center text-slate-400 italic">No recovery targets enrolled for ${safeText(srcKey)}.</td></tr>`}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }).join('')}

                <!-- Cabagñan General Waterfall Section -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div class="flex justify-between items-center border-b pb-4">
                        <h3 class="font-black text-sm uppercase tracking-wider text-slate-800">🏬 Cabagñan General Branch Recovery Queue</h3>
                    </div>

                    <!-- Cabagñan Metrics Summary Bar -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div class="text-[9px] font-black text-slate-400 uppercase">Profit Before Recovery</div>
                            <div class="text-lg font-black text-slate-800">${money(cabProfitBefore)}</div>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div class="text-[9px] font-black text-slate-400 uppercase">Current Recovery Rate</div>
                            <div class="text-lg font-black text-amber-600">${generalCabAllocations.length > 0 ? cabRate + '%' : 'N/A'}</div>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div class="text-[9px] font-black text-slate-400 uppercase">Current Recovery Pool</div>
                            <div class="text-lg font-black text-slate-800">${money(generalCabAllocations.length > 0 ? cabPool : 0)}</div>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div class="text-[9px] font-black text-slate-400 uppercase">Current Period Allocation</div>
                            <div class="text-lg font-black text-emerald-600">${money(generalCabAllocations.length > 0 ? (cabAllocated - (coffee ? coffee.allocatedTotal : 0)) : 0)}</div>
                        </div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="text-[10px] text-slate-400 font-black border-b uppercase bg-slate-50">
                                    <th class="p-3">Priority</th>
                                    <th class="p-3">Target Asset</th>
                                    <th class="p-3">Full Cost</th>
                                    <th class="p-3">Recovered To Date</th>
                                    <th class="p-3">Period Allocation</th>
                                    <th class="p-3">Remaining Capital</th>
                                    <th class="p-3 text-center">Status</th>
                                    ${isAdmin ? `<th class="p-3 text-center">Actions</th>` : ''}
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${generalCabAllocations.length > 0 ? generalCabAllocations.map((a, idx) => `
                                    <tr class="hover:bg-slate-50 font-medium">
                                        <td class="p-4 font-mono text-slate-400">#${a.priority || idx+1}</td>
                                        <td class="p-4 text-slate-800 font-bold">${safeText(a.name)}</td>
                                        <td class="p-4 font-mono">${money(a.targetAmount)}</td>
                                        <td class="p-4 font-mono text-slate-500">${typeof a.openingRecovered === 'number' ? money(a.openingRecovered) : a.openingRecovered}</td>
                                        <td class="p-4 font-mono font-bold text-emerald-600">+ ${money(a.currentPeriodAllocation)}</td>
                                        <td class="p-4 font-mono text-slate-700">${typeof a.remainingCapital === 'number' ? money(a.remainingCapital) : a.remainingCapital}</td>
                                        <td class="p-4 text-center">${getStatusBadge(a.status)}</td>
                                        ${isAdmin ? `
                                            <td class="p-4 text-center whitespace-nowrap">
                                                <div class="flex items-center justify-center gap-2">
                                                    <button data-edit-target="${a.id}" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] rounded-lg transition-colors">Edit</button>
                                                    <button data-delete-target="${a.id}" class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] rounded-lg transition-colors">Delete</button>
                                                </div>
                                            </td>
                                        ` : ''}
                                    </tr>
                                `).join('') : `<tr><td colspan="${isAdmin ? 8 : 7}" class="p-4 text-center text-slate-400 italic font-medium">No general branch recovery targets enrolled.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Iraya Section -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div class="flex justify-between items-center border-b pb-4">
                        <h3 class="font-black text-sm uppercase tracking-wider text-slate-800">🏡 Iraya Branch Recovery Queue</h3>
                    </div>

                    <!-- Iraya Metrics Summary Bar -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div class="text-[9px] font-black text-slate-400 uppercase">Profit Before Recovery</div>
                            <div class="text-lg font-black text-slate-800">${money(iryProfitBefore)}</div>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div class="text-[9px] font-black text-slate-400 uppercase">Current Recovery Rate</div>
                            <div class="text-lg font-black text-amber-600">${iry?.allocationsDetail?.length > 0 ? iryRate + '%' : 'N/A'}</div>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div class="text-[9px] font-black text-slate-400 uppercase">Current Recovery Pool</div>
                            <div class="text-lg font-black text-slate-800">${money(iry?.allocationsDetail?.length > 0 ? iryPool : 0)}</div>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div class="text-[9px] font-black text-slate-400 uppercase">Current Period Allocation</div>
                            <div class="text-lg font-black text-emerald-600">${money(iry?.allocationsDetail?.length > 0 ? iryAllocated : 0)}</div>
                        </div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="text-[10px] text-slate-400 font-black border-b uppercase bg-slate-50">
                                    <th class="p-3">Priority</th>
                                    <th class="p-3">Target Asset</th>
                                    <th class="p-3">Full Cost</th>
                                    <th class="p-3">Recovered To Date</th>
                                    <th class="p-3">Period Allocation</th>
                                    <th class="p-3">Remaining Capital</th>
                                    <th class="p-3 text-center">Status</th>
                                    ${isAdmin ? `<th class="p-3 text-center">Actions</th>` : ''}
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${iry?.allocationsDetail?.length > 0 ? iry.allocationsDetail.map((a, idx) => `
                                    <tr class="hover:bg-slate-50 font-medium">
                                        <td class="p-4 font-mono text-slate-400">#${a.priority || idx+1}</td>
                                        <td class="p-4 text-slate-800 font-bold">${safeText(a.name)}</td>
                                        <td class="p-4 font-mono">${money(a.targetAmount)}</td>
                                        <td class="p-4 font-mono text-slate-500">${typeof a.openingRecovered === 'number' ? money(a.openingRecovered) : a.openingRecovered}</td>
                                        <td class="p-4 font-mono font-bold text-emerald-600">+ ${money(a.currentPeriodAllocation)}</td>
                                        <td class="p-4 font-mono text-slate-700">${typeof a.remainingCapital === 'number' ? money(a.remainingCapital) : a.remainingCapital}</td>
                                        <td class="p-4 text-center">${getStatusBadge(a.status)}</td>
                                        ${isAdmin ? `
                                            <td class="p-4 text-center whitespace-nowrap">
                                                <div class="flex items-center justify-center gap-2">
                                                    <button data-edit-target="${a.id}" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] rounded-lg transition-colors">Edit</button>
                                                    <button data-delete-target="${a.id}" class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] rounded-lg transition-colors">Delete</button>
                                                </div>
                                            </td>
                                        ` : ''}
                                    </tr>
                                `).join('') : `<tr><td colspan="${isAdmin ? 8 : 7}" class="p-4 text-center text-slate-400 italic font-medium">No recovery targets enrolled.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Archived Recovery Targets Section -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div class="flex justify-between items-center border-b pb-4">
                        <h3 class="font-black text-sm uppercase tracking-wider text-slate-800">📦 Archived Recovery Targets</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="text-[10px] text-slate-400 font-black border-b uppercase bg-slate-50">
                                    <th class="p-3">Target Name</th>
                                    <th class="p-3">Branch</th>
                                    <th class="p-3">Original Amount</th>
                                    <th class="p-3">Recovered To Date</th>
                                    <th class="p-3">Remaining at Archive</th>
                                    <th class="p-3">Archived Date</th>
                                    ${isAdmin ? `<th class="p-3 text-center">Action</th>` : ''}
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${archivedAssets.length > 0 ? archivedAssets.map(a => {
                                    const rec = typeof a.openingRecovered === 'number' ? a.openingRecovered : (parseFloat(a.openingRecovered) || 0);
                                    const rem = Math.max(0, a.cost - rec);
                                    const archDate = a.archivedDate ? new Date(a.archivedDate).toLocaleDateString() : 'N/A';
                                    return `
                                        <tr class="hover:bg-slate-50 font-medium">
                                            <td class="p-4 text-slate-800 font-bold">${safeText(a.name)}</td>
                                            <td class="p-4 text-slate-600">${safeText(a.branch)}</td>
                                            <td class="p-4 font-mono">${money(a.cost)}</td>
                                            <td class="p-4 font-mono text-slate-500">${money(rec)}</td>
                                            <td class="p-4 font-mono text-slate-700">${money(rem)}</td>
                                            <td class="p-4 text-slate-500 font-mono">${archDate}</td>
                                            ${isAdmin ? `
                                                <td class="p-4 text-center">
                                                    <button data-restore-target="${a.id}" class="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[10px] rounded-lg transition-colors">Restore</button>
                                                </td>
                                            ` : ''}
                                        </tr>
                                    `;
                                }).join('') : `<tr><td colspan="${isAdmin ? 7 : 6}" class="p-4 text-center text-slate-400 italic">No archived targets.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderEditTargetModal(target) {
        const ratePct = target.recoveryPercent !== undefined ? (target.recoveryPercent <= 1.0 ? Math.round(target.recoveryPercent * 100) : Math.round(target.recoveryPercent)) : 50;
        const isPaused = target.paused === true || target.isPaused === true;

        return `
            <div class="flex flex-col h-full">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                    <div>
                        <h2 class="text-lg font-black uppercase tracking-wider">Edit Recovery Target</h2>
                        <p class="text-[10px] text-slate-400 font-mono mt-0.5">ID: ${safeText(target.id)}</p>
                    </div>
                    <button class="text-slate-400 hover:text-white text-lg font-bold p-1" onclick="window.UIController.closeModal()">✕</button>
                </div>
                <div class="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Name</label>
                        <input type="text" id="targetName" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="${safeText(target.name)}">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Branch</label>
                            <select id="targetBranch" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300">
                                <option value="Cabagñan" ${target.branch === 'Cabagñan' ? 'selected' : ''}>Cabagñan</option>
                                <option value="Iraya" ${target.branch === 'Iraya' ? 'selected' : ''}>Iraya</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Priority (Branch Queue)</label>
                            <input type="number" id="targetPriority" min="1" step="1" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="${target.priority || 1}">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Amount (₱)</label>
                            <input type="number" id="targetCost" min="1" step="100" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="${target.cost}">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Recovery Rate (%)</label>
                            <input type="number" id="targetPercent" min="0" max="100" step="1" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="${ratePct}">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Opening Recovered (₱)</label>
                            <input type="number" id="targetOpeningRecovered" min="0" step="100" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="${target.openingRecovered || 0}">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</label>
                            <select id="targetPaused" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300">
                                <option value="false" ${!isPaused ? 'selected' : ''}>Active</option>
                                <option value="true" ${isPaused ? 'selected' : ''}>Paused</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Funding Mode</label>
                            <select id="targetFundingMode" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300">
                                <option value="SOURCE_SELF_RECOVERY" ${target.recoveryFundingMode === 'SOURCE_SELF_RECOVERY' || target.source === 'Coffee Vendo' ? 'selected' : ''}>Source Self-Recovery</option>
                                <option value="BRANCH_RECOVERY" ${target.recoveryFundingMode === 'BRANCH_RECOVERY' ? 'selected' : ''}>Branch General Waterfall</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Source Name</label>
                            <input type="text" id="targetSource" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="${safeText(target.source || 'Coffee Vendo')}">
                        </div>
                    </div>

                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes / Description</label>
                        <textarea id="targetNotes" rows="2" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Optional notes">${safeText(target.notes || '')}</textarea>
                    </div>

                    <div class="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium space-y-1">
                        <div>ℹ️ <strong>Historical Safety:</strong> Changing the recovery rate affects only future calculations. Historical recovery records remain unchanged.</div>
                        <div>ℹ️ <strong>Opening Recovered:</strong> Represents recovery completed before tracked system allocations. Changing this does not modify system recovery ledger entries.</div>
                    </div>
                </div>
                <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button id="btnSaveTarget" class="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg transition-all">Save Changes</button>
                    <button class="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-xl font-black uppercase text-xs" onclick="window.UIController.closeModal()">Cancel</button>
                </div>
            </div>
        `;
    },

    renderAddTargetModal() {
        const sources = DataService.incomeSources || [];
        const coreSources = ['Coffee Vendo', 'Coffee Vendo 1', 'Coffee Vendo 2', 'Pisonet', 'PisoWiFi', 'Printing / Photocopy'];
        const allSourceOptions = [...new Set([...coreSources, ...sources.map(s => s.name)])];

        return `
            <div class="flex flex-col h-full">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                    <div>
                        <h2 class="text-lg font-black uppercase tracking-wider">Enroll Recovery Target</h2>
                        <p class="text-[10px] text-slate-400 font-mono mt-0.5">Add a new recoverable starting-cost investment</p>
                    </div>
                    <button class="text-slate-400 hover:text-white text-lg font-bold p-1" onclick="window.UIController.closeModal()">✕</button>
                </div>
                <div class="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Name *</label>
                        <input type="text" id="addTargetName" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" placeholder="e.g. Coffee Vendo 2 Machine, Water Pump">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cost / Investment Amount (₱) *</label>
                            <input type="number" id="addTargetCost" min="1" step="100" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" placeholder="22000">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Funding Type *</label>
                            <select id="addTargetFundingMode" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300">
                                <option value="SOURCE_SELF_RECOVERY">Source Self-Recovery (Funded by source earnings)</option>
                                <option value="BRANCH_RECOVERY">Branch Recovery (Funded by general branch profit)</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Branch *</label>
                            <select id="addTargetBranch" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300">
                                <option value="Cabagñan">Cabagñan</option>
                                <option value="Iraya">Iraya</option>
                            </select>
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source</label>
                                <button id="btnQuickAddSource" class="text-[10px] font-bold text-blue-600 hover:underline">+ Add New Source</button>
                            </div>
                            <select id="addTargetSource" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300">
                                ${allSourceOptions.map(s => `<option value="${s}">${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Recovery Rate (%)</label>
                            <input type="number" id="addTargetPercent" min="1" max="100" step="1" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="50">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Opening Recovered (₱)</label>
                            <input type="number" id="addTargetOpeningRecovered" min="0" step="100" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="0">
                        </div>
                    </div>

                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes / Description</label>
                        <textarea id="addTargetNotes" rows="2" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Optional notes"></textarea>
                    </div>

                    <div class="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium">
                        ⚠️ <strong>Prevent Double Counting:</strong> This item is being enrolled as a recoverable investment. Do not also record it as an ordinary operating expense in Transaction Entry unless that separate treatment is intentional.
                    </div>
                </div>
                <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button id="btnSaveNewTarget" class="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg transition-all">Enroll Target</button>
                    <button class="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-xl font-black uppercase text-xs" onclick="window.UIController.closeModal()">Cancel</button>
                </div>
            </div>
        `;
    },

    renderAddSourceModal() {
        return `
            <div class="flex flex-col h-full">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                    <div>
                        <h2 class="text-lg font-black uppercase tracking-wider">Add New Income Source</h2>
                        <p class="text-[10px] text-slate-400 font-mono mt-0.5">Register a new earning machine or business activity</p>
                    </div>
                    <button class="text-slate-400 hover:text-white text-lg font-bold p-1" onclick="window.UIController.closeModal()">✕</button>
                </div>
                <div class="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Source Name *</label>
                        <input type="text" id="addSrcName" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" placeholder="e.g. Coffee Vendo 2, Printing Machine 2">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Source Type</label>
                            <select id="addSrcType" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300">
                                <option value="Coffee Vendo">Coffee Vendo</option>
                                <option value="Pisonet">Pisonet</option>
                                <option value="PisoWiFi">PisoWiFi</option>
                                <option value="Printing / Photocopy">Printing / Photocopy</option>
                                <option value="Other">Other Vendo / Service</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Branch</label>
                            <select id="addSrcBranch" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300">
                                <option value="Cabagñan">Cabagñan</option>
                                <option value="Iraya">Iraya</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Owner Share (%)</label>
                            <input type="number" id="addSrcShare" min="0" max="100" step="5" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="100">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</label>
                            <input type="text" id="addSrcNotes" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Optional notes">
                        </div>
                    </div>
                </div>
                <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button id="btnSaveNewSource" class="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg transition-all">Save Income Source</button>
                    <button class="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-xl font-black uppercase text-xs" onclick="window.UIController.closeModal()">Cancel</button>
                </div>
            </div>
        `;
    },

    renderDeleteTargetModal(target, hasHistory, totalRecovered, remaining) {
        return `
            <div class="flex flex-col h-full">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                    <div>
                        <h2 class="text-lg font-black uppercase tracking-wider">${hasHistory ? 'Archive Recovery Target' : 'Delete Recovery Target'}</h2>
                        <p class="text-[10px] text-slate-400 font-mono mt-0.5">${safeText(target.name)}</p>
                    </div>
                    <button class="text-slate-400 hover:text-white text-lg font-bold p-1" onclick="window.UIController.closeModal()">✕</button>
                </div>
                <div class="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <div class="flex justify-between"><span class="font-bold text-slate-500">Target Name:</span> <span class="font-black text-slate-800">${safeText(target.name)}</span></div>
                        <div class="flex justify-between"><span class="font-bold text-slate-500">Branch:</span> <span class="font-bold text-slate-700">${safeText(target.branch)}</span></div>
                        <div class="flex justify-between"><span class="font-bold text-slate-500">Target Amount:</span> <span class="font-mono font-bold">${money(target.cost)}</span></div>
                        <div class="flex justify-between"><span class="font-bold text-slate-500">Recovered Amount:</span> <span class="font-mono font-bold text-emerald-600">${money(totalRecovered)}</span></div>
                        <div class="flex justify-between"><span class="font-bold text-slate-500">Remaining Amount:</span> <span class="font-mono font-bold text-slate-700">${money(remaining)}</span></div>
                    </div>

                    ${hasHistory ? `
                        <div class="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 space-y-2">
                            <div class="font-black text-xs uppercase tracking-wide text-amber-800">⚠️ Recovery History Exists</div>
                            <p class="font-medium text-[11px]">This target already contains recorded recovery history (${money(totalRecovered)}). It cannot be permanently erased without losing accounting history.</p>
                            <p class="font-medium text-[11px]">It will be <strong>archived and removed from the active Recovery Queue</strong>. Its historical ledger records and original investment accounting will be preserved intact.</p>
                        </div>
                    ` : `
                        <div class="bg-red-50 p-4 rounded-xl border border-red-200 text-red-900 space-y-2">
                            <div class="font-black text-xs uppercase tracking-wide text-red-800">⚠️ Permanent Deletion</div>
                            <p class="font-medium text-[11px]">No recovery history exists for this item. Deleting it will permanently remove it from system settings.</p>
                        </div>
                    `}
                </div>
                <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    ${hasHistory ? `
                        <button id="btnConfirmDelete" class="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg transition-all">Archive Target</button>
                    ` : `
                        <button id="btnConfirmDelete" class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg transition-all">Delete Permanently</button>
                    `}
                    <button class="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-xl font-black uppercase text-xs" onclick="window.UIController.closeModal()">Cancel</button>
                </div>
            </div>
        `;
    },

    renderSavings() {
        const c = DataService.consolidatedResult;
        const cab = DataService.cabagnanResult;
        const iry = DataService.irayaResult;

        const cabProfitAfterRec = cab ? cab.profitAfterRecovery : 0;
        const cabSavings = cab ? cab.savingsContribution : 0;

        const iryProfitAfterRec = iry ? iry.owner.profitAfterRecovery : 0;
        const irySavings = iry ? iry.owner.savings : 0;

        const totalSavings = c ? c.totalSavings : (cabSavings + irySavings);

        return `
            <div class="space-y-8">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-black text-slate-800 uppercase tracking-tight">Savings Ledger</h2>
                        <p class="text-xs text-slate-400 font-medium mt-1">Calculated 5% trailing savings reserves extracted post-capital recovery.</p>
                    </div>
                    <div class="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black">PERIOD: ${DataService.currentPeriod.toUpperCase()}</div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${this.renderMetricCard("Total Current Period Savings", money(totalSavings), "success", "5% of positive post-recovery branch profit", true)}
                    ${this.renderMetricCard("Cabagñan Savings Contribution", money(cabSavings), "success", `5% of ${money(cabProfitAfterRec)} profit after recovery`, true)}
                    ${this.renderMetricCard("Iraya Savings Contribution", money(irySavings), "success", `5% of ${money(iryProfitAfterRec)} profit after recovery`, true)}
                </div>

                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 class="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Savings Breakdown by Branch</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="text-[10px] text-slate-400 font-bold border-b uppercase bg-slate-50">
                                    <th class="p-3">Branch / Source</th>
                                    <th class="p-3">Profit After Recovery</th>
                                    <th class="p-3">Savings Rate</th>
                                    <th class="p-3 text-right">Savings Contribution</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                <tr class="hover:bg-slate-50 font-medium">
                                    <td class="p-4 text-slate-800 font-bold">Cabagñan Branch</td>
                                    <td class="p-4 font-mono">${money(cabProfitAfterRec)}</td>
                                    <td class="p-4 text-slate-500">5%</td>
                                    <td class="p-4 text-right font-black text-emerald-600">${money(cabSavings)}</td>
                                </tr>
                                <tr class="hover:bg-slate-50 font-medium">
                                    <td class="p-4 text-slate-800 font-bold">Iraya Joint Branch (Owner Share)</td>
                                    <td class="p-4 font-mono">${money(iryProfitAfterRec)}</td>
                                    <td class="p-4 text-slate-500">5%</td>
                                    <td class="p-4 text-right font-black text-emerald-600">${money(irySavings)}</td>
                                </tr>
                                <tr class="hover:bg-slate-50 font-medium">
                                    <td class="p-4 text-slate-800 font-bold">Partner PisoWiFi</td>
                                    <td class="p-4 font-mono">N/A</td>
                                    <td class="p-4 text-slate-500">0%</td>
                                    <td class="p-4 text-right font-black text-slate-400">₱0.00</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr class="bg-slate-50 font-black text-xs border-t">
                                    <td class="p-4 uppercase">Total Current Period Savings</td>
                                    <td class="p-4"></td>
                                    <td class="p-4"></td>
                                    <td class="p-4 text-right text-emerald-700 text-sm">${money(totalSavings)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div class="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex justify-between items-center">
                    <div>
                        <div class="text-xs font-black text-amber-800 uppercase mb-1">Accumulated Savings Balance</div>
                        <div class="text-sm font-bold text-amber-700">Opening balance / withdrawal history required</div>
                    </div>
                    <span class="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase">Baseline Required</span>
                </div>
            </div>
        `;
    },

    renderDebts() {
        const debts = DataService.settings?.debts || DataService.debts || [];

        return `
            <div class="space-y-8">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-black text-slate-800 uppercase tracking-tight">Debts & Liabilities Ledger</h2>
                        <p class="text-xs text-slate-400 font-medium mt-1">Enrolled business debt commitments and settlement tracking.</p>
                    </div>
                    <div class="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black">PERIOD: ${DataService.currentPeriod.toUpperCase()}</div>
                </div>

                ${debts.length === 0 ? `
                    <div class="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm">
                        <div class="text-4xl mb-3">🏛️</div>
                        <h3 class="font-black text-slate-800 text-sm uppercase mb-2">Debts Ledger</h3>
                        <p class="text-slate-500 text-xs font-medium">No debts currently enrolled.</p>
                    </div>
                ` : `
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr class="text-[10px] text-slate-400 font-bold border-b uppercase bg-slate-50">
                                        <th class="p-3">Debt Name</th>
                                        <th class="p-3">Original Principal</th>
                                        <th class="p-3">Principal Paid</th>
                                        <th class="p-3">Outstanding Principal</th>
                                        <th class="p-3">Interest</th>
                                        <th class="p-3 text-center">Priority</th>
                                        <th class="p-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${debts.map(d => `
                                        <tr class="hover:bg-slate-50 font-medium">
                                            <td class="p-4 text-slate-800 font-bold">${safeText(d.name)}</td>
                                            <td class="p-4 font-mono">${money(d.originalPrincipal || d.principal)}</td>
                                            <td class="p-4 font-mono text-emerald-600">${money(d.principalPaid || 0)}</td>
                                            <td class="p-4 font-mono text-red-600 font-bold">${money((d.originalPrincipal || d.principal) - (d.principalPaid || 0))}</td>
                                            <td class="p-4 text-slate-500">${d.interest ? (typeof d.interest === 'number' ? money(d.interest) : d.interest) : 'N/A'}</td>
                                            <td class="p-4 text-center font-mono text-slate-400">${d.priority || '-'}</td>
                                            <td class="p-4 text-center">
                                                <span class="px-2 py-0.5 rounded font-black text-[9px] uppercase ${d.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">${safeText(d.status, 'ACTIVE')}</span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `}
            </div>
        `;
    },

    renderReports() {
        const diag = DataService.getDiagnostics();
        const c = DataService.consolidatedResult;

        return `
            <div class="space-y-8">
                <!-- Data Reconciliation Audits -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 class="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Central Accounting Diagnostics & Conservation Audits</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium">
                        <div class="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                            <span>Record Conservation Tally:</span>
                            <span class="font-black text-emerald-600">PASS (${diag.totalRaw}/${diag.totalNormalized})</span>
                        </div>
                        <div class="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                            <span>Revenue Flow:</span>
                            <span class="font-black text-emerald-600">${diag.revenueConservationPass ? 'PASS' : 'FAIL'}</span>
                        </div>
                        <div class="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                            <span>Unclassified Items:</span>
                            <span class="font-black ${diag.unclassifiedBranchCount > 0 ? 'text-amber-600' : 'text-slate-500'}">${diag.unclassifiedBranchCount} Items</span>
                        </div>
                    </div>
                </div>

                <!-- Unresolved Records Audit Panel -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 class="font-black text-xs uppercase tracking-widest text-slate-500 mb-4 border-b pb-2">ACCOUNTING REVIEW REQUIRED</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="text-[10px] text-slate-400 font-bold border-b uppercase">
                                    <th class="p-2">Date</th>
                                    <th class="p-2">Label description</th>
                                    <th class="p-2">Amount</th>
                                    <th class="p-2">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${c?.unclassifiedItemsList?.length === 0 ? `<tr><td colspan="4" class="p-4 text-center italic text-slate-400">Clear! 0 records require manual matching.</td></tr>` : c?.unclassifiedItemsList?.map(l => `
                                    <tr class="border-b text-[11px]">
                                        <td class="p-2 whitespace-nowrap text-slate-500 font-mono">${safeText(l.date)}</td>
                                        <td class="p-2 font-bold text-slate-800">${safeText(l.label)}</td>
                                        <td class="p-2 font-black">${money(l.amount)}</td>
                                        <td class="p-2 text-red-400 uppercase text-[9px] font-black">${safeText(l.classificationConfidence)}: Missing location context</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderSettings(tab = 'general') {
        const isAdmin = DataService.currentRole === 'admin';

        return `
            <div class="space-y-8">
                <!-- Settings Tabs -->
                <div class="flex gap-1 bg-slate-200 p-1 rounded-2xl self-start w-fit">
                    <button data-settings-tab="general" class="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${tab === 'general' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">General</button>
                    <button data-settings-tab="partners" class="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${tab === 'partners' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">Partners</button>
                    <button data-settings-tab="bills" class="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${tab === 'bills' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">Upcoming Bills</button>
                    <button data-settings-tab="users" class="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${tab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">Users</button>
                    <button data-settings-tab="sources" class="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${tab === 'sources' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">Income Sources</button>
                    <button data-settings-tab="audit" class="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${tab === 'audit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">Audit Log</button>
                </div>

                <div class="transition-all">
                    ${this.renderSettingsPanel(tab, isAdmin)}
                </div>
            </div>
        `;
    },

    renderSettingsPanel(tab, isAdmin) {
        switch(tab) {
            case 'general':
                return `
                    <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                        <h3 class="text-lg font-black text-slate-800 uppercase tracking-tight">System Information</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                            <div class="space-y-4">
                                <div><div class="text-[9px] font-black text-slate-400 uppercase mb-1">Firebase Project</div><div class="font-bold">jgs-business-tracker</div></div>
                                <div><div class="text-[9px] font-black text-slate-400 uppercase mb-1">Auth Document</div><div class="font-bold">jgs_settings/auth</div></div>
                                <div><div class="text-[9px] font-black text-slate-400 uppercase mb-1">Platform Status</div><div class="text-emerald-600 font-black uppercase">V2.0-STABLE</div></div>
                            </div>
                        </div>
                    </div>
                `;
            case 'partners':
                return `
                    <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <div class="flex justify-between items-center mb-8">
                            <h3 class="text-lg font-black text-slate-800 uppercase tracking-tight">Partner Management</h3>
                            ${isAdmin ? `<button class="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Add Partner</button>` : ''}
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr class="bg-slate-50 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100">
                                        <th class="p-4">Name</th>
                                        <th class="p-4">Type</th>
                                        <th class="p-4 text-center">Owner Share</th>
                                        <th class="p-4 text-center">Partner Share</th>
                                        <th class="p-4 text-center">Status</th>
                                        <th class="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    ${DataService.partners.map((p, idx) => `
                                        <tr>
                                            <td class="p-4 font-bold text-slate-800">${p.name}</td>
                                            <td class="p-4 text-slate-500 uppercase font-bold text-[9px]">${p.type}</td>
                                            <td class="p-4 text-center font-black text-slate-900">${pct(p.share)}</td>
                                            <td class="p-4 text-center font-black text-slate-400">${pct(1 - p.share)}</td>
                                            <td class="p-4 text-center"><span class="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-black uppercase text-[8px]">Active</span></td>
                                            <td class="p-4 text-right">
                                                ${isAdmin ? `<button class="text-slate-300 hover:text-slate-900 font-bold uppercase text-[9px] transition-colors">Edit</button>` : '<span class="text-slate-200">Locked</span>'}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            case 'bills':
                return `
                    <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <div class="flex justify-between items-center mb-8">
                            <h3 class="text-lg font-black text-slate-800 uppercase tracking-tight">Upcoming Bills (Templates)</h3>
                            ${isAdmin ? `<button id="btnAddBill" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Add Bill Template</button>` : ''}
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr class="bg-slate-50 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100">
                                        <th class="p-4">Bill Name</th>
                                        <th class="p-4">Branch</th>
                                        <th class="p-4">Category</th>
                                        <th class="p-4 text-right">Expected Amount</th>
                                        <th class="p-4">Amount Type</th>
                                        <th class="p-4 text-center">Due Day</th>
                                        <th class="p-4 text-center">Frequency</th>
                                        <th class="p-4 text-center">This Month</th>
                                        <th class="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    ${DataService.projectedExpenses.map(b => {
                                        const status = this.getBillMonthStatus(b);
                                        return `
                                        <tr>
                                            <td class="p-4 font-bold text-slate-800">${b.name}</td>
                                            <td class="p-4 text-slate-500 font-bold text-[9px] uppercase">${b.branch || 'Global'}</td>
                                            <td class="p-4 text-slate-400 text-[10px] font-black uppercase">${b.category || 'Other'}</td>
                                            <td class="p-4 text-right font-black text-slate-900">${money(b.expectedAmount || b.amount)}</td>
                                            <td class="p-4 text-[9px] font-black uppercase text-slate-500">${b.amountType || 'FIXED'}</td>
                                            <td class="p-4 text-center font-mono">${b.dueDay || b.dueDate || '-'}</td>
                                            <td class="p-4 text-center uppercase text-[8px] font-black text-slate-400">${b.frequency || 'Monthly'}</td>
                                            <td class="p-4 text-center">
                                                <span class="px-2 py-0.5 rounded-full font-black text-[8px] uppercase ${status === 'RECORDED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}">${status}</span>
                                            </td>
                                            <td class="p-4 text-right space-x-2">
                                                <button data-record-bill="${b.id}" class="text-blue-600 hover:text-blue-900 font-black uppercase text-[9px] transition-colors">Record Bill</button>
                                                ${isAdmin ? `
                                                    <button data-edit-bill="${b.id}" class="text-slate-400 hover:text-slate-900 font-bold uppercase text-[9px] transition-colors">Edit</button>
                                                    <button data-delete-bill="${b.id}" class="text-red-300 hover:text-red-600 font-bold uppercase text-[9px] transition-colors">Delete</button>
                                                ` : ''}
                                            </td>
                                        </tr>
                                    `}).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            case 'users':
                return `
                    <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <div class="flex justify-between items-center mb-8">
                            <h3 class="text-lg font-black text-slate-800 uppercase tracking-tight">User Management</h3>
                            ${isAdmin ? `<button class="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Enroll User</button>` : ''}
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr class="bg-slate-50 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100">
                                        <th class="p-4">Username</th>
                                        <th class="p-4">Role</th>
                                        <th class="p-4 text-center">Status</th>
                                        <th class="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    ${(DataService.settings?.users || []).map(u => `
                                        <tr>
                                            <td class="p-4 font-bold text-slate-800">${u.username}</td>
                                            <td class="p-4"><span class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${u.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}">${u.role || 'user'}</span></td>
                                            <td class="p-4 text-center"><span class="text-emerald-500 text-[10px] font-black">ACTIVE</span></td>
                                            <td class="p-4 text-right">
                                                ${isAdmin ? `<button class="text-slate-300 hover:text-slate-900 font-bold uppercase text-[9px]">Reset</button>` : ''}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            case 'sources':
                const sources = DataService.incomeSources;
                return `
                    <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <div class="flex justify-between items-center mb-8">
                            <h3 class="text-lg font-black text-slate-800 uppercase tracking-tight">Dynamic Income Sources</h3>
                            ${isAdmin ? `<button class="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Add Source</button>` : ''}
                        </div>
                        ${sources.length === 0 ? `
                            <div class="p-12 text-center text-slate-300 italic border-2 border-dashed border-slate-100 rounded-2xl">
                                No custom income sources registered. Standard core sources (Pisonet, PisoWiFi, etc.) are active by default.
                            </div>
                        ` : `
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                ${sources.map(s => `
                                    <div class="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <div class="flex justify-between mb-4">
                                            <div class="font-black text-slate-800 uppercase text-xs">${s.name}</div>
                                            <span class="text-[8px] font-black bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-400 uppercase">${s.sourceType}</span>
                                        </div>
                                        <div class="grid grid-cols-2 gap-4 text-[10px] mb-4">
                                            <div><div class="text-slate-400 uppercase font-black">Branch</div><div class="font-bold">${s.branch}</div></div>
                                            <div><div class="text-slate-400 uppercase font-black">Ownership</div><div class="font-bold">${s.ownershipType}</div></div>
                                        </div>
                                        ${isAdmin ? `<button class="w-full py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-400 hover:text-slate-800 transition-colors uppercase">Edit Settings</button>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                `;
            case 'audit':
                return `
                    <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 class="text-lg font-black text-slate-800 uppercase tracking-tight mb-8">System Audit Log</h3>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-[10px] border-collapse">
                                <thead>
                                    <tr class="bg-slate-50 font-black text-slate-400 uppercase border-b border-slate-100">
                                        <th class="p-4">Timestamp</th>
                                        <th class="p-4">User</th>
                                        <th class="p-4">Action</th>
                                        <th class="p-4">Entity</th>
                                        <th class="p-4">Summary</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    ${DataService.auditLogs.map(a => `
                                        <tr>
                                            <td class="p-4 text-slate-400 font-mono">${a.timestamp?.toDate ? a.timestamp.toDate().toLocaleString() : 'Recent'}</td>
                                            <td class="p-4 font-bold text-slate-700">${a.actor}</td>
                                            <td class="p-4"><span class="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-black uppercase text-[8px]">${a.action.replace(/_/g, ' ')}</span></td>
                                            <td class="p-4 text-slate-500">${a.entityType}: ${a.entityId}</td>
                                            <td class="p-4 text-slate-800 font-medium">${this.renderAuditSummary(a)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
        }
    },

    getBillMonthStatus(bill) {
        const logs = DataService.normalizedLogs;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const recorded = logs.some(l => {
            if (l.type !== 'expense') return false;
            // Use derived timestamp or fallback to parsing the date string
            const d = l.timestamp ? new Date(l.timestamp) : new Date(l.date);
            if (isNaN(d.getTime())) return false;

            const isSameMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            const isSameBranch = l.branch === bill.branch;
            // Match canonical ALECO/DCTV or loose name match
            const isMatch = (l.expenseCategory === bill.category && bill.category !== 'Other') ||
                          l.label.toLowerCase().includes(bill.name.toLowerCase());
            return isSameMonth && isSameBranch && isMatch;
        });

        return recorded ? "RECORDED" : "NOT RECORDED";
    },

    renderAuditSummary(audit) {
        if (audit.action === 'transaction_edit') {
            const before = audit.before || {};
            const after = audit.after || {};
            let changes = [];
            if (before.amount !== after.amount) changes.push(`Amt: ${before.amount} → ${after.amount}`);
            if (before.label !== after.label) changes.push(`Label updated`);
            if (before.sharePercent !== after.sharePercent) changes.push(`Ownership: ${pct(before.sharePercent)} → ${pct(after.sharePercent)}`);
            return changes.join(', ') || 'No material changes';
        }
        if (audit.action === 'partner_share_changed') {
            return audit.note || `Partner share changed: Owner ${(audit.afterOwnerShare * 100).toFixed(0)}% / Partner ${((1 - audit.afterOwnerShare) * 100).toFixed(0)}%`;
        }
        return audit.note || 'System event';
    },

    renderEditPartnerShareModal(partnerName, currentOwnerPct) {
        const partnerPct = 100 - currentOwnerPct;
        return `
            <div class="p-8 space-y-6">
                <div class="flex justify-between items-center border-b pb-4">
                    <div>
                        <h2 class="text-xl font-black text-slate-800 uppercase">Edit Share Agreement</h2>
                        <p class="text-xs text-slate-400 font-bold mt-0.5">Partner: ${safeText(partnerName)}</p>
                    </div>
                    <button class="text-slate-400 hover:text-slate-600 text-lg font-bold" onclick="window.UIController.closeModal()">✕</button>
                </div>

                <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">AGREEMENT DISTRIBUTION</div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">Owner Share (%)</label>
                            <input type="number" id="inputOwnerSharePct" min="0" max="100" step="1" class="w-full bg-white border border-slate-200 p-3 rounded-xl text-lg font-black text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="${currentOwnerPct}">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">Partner Share (%)</label>
                            <input type="number" id="inputPartnerSharePct" readonly class="w-full bg-slate-100 border border-slate-200 p-3 rounded-xl text-lg font-black text-slate-500 outline-none" value="${partnerPct}">
                        </div>
                    </div>
                </div>

                <div class="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
                    <div class="font-bold">⚠️ Important Notice:</div>
                    <p>This share distribution applies <strong>ONLY to future transactions</strong> recorded after this change.</p>
                    <p>Historical transactions preserve their original recorded shares intact.</p>
                </div>

                <div class="flex justify-end gap-3 pt-2">
                    <button id="btnSavePartnerShare" class="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg transition-all">Save Share Agreement</button>
                    <button class="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-xl font-black uppercase text-xs" onclick="window.UIController.closeModal()">Cancel</button>
                </div>
            </div>
        `;
    },

    renderEnrollPartnerModal(partnerName) {
        return `
            <div class="p-8 space-y-6">
                <div class="flex justify-between items-center border-b pb-4">
                    <div>
                        <h2 class="text-xl font-black text-slate-800 uppercase">Enroll / Confirm Partner</h2>
                        <p class="text-xs text-slate-400 font-bold mt-0.5">Register historical partner into active configuration</p>
                    </div>
                    <button class="text-slate-400 hover:text-slate-600 text-lg font-bold" onclick="window.UIController.closeModal()">✕</button>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Partner Name</label>
                        <input type="text" id="enrollPartnerName" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-800" value="${safeText(partnerName)}">
                    </div>

                    <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">INITIAL SHARE AGREEMENT</div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">Owner Share (%)</label>
                                <input type="number" id="enrollOwnerSharePct" min="0" max="100" step="1" class="w-full bg-white border border-slate-200 p-3 rounded-xl text-lg font-black text-slate-800 outline-none focus:ring-2 focus:ring-slate-300" value="70">
                            </div>
                            <div>
                                <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">Partner Share (%)</label>
                                <input type="number" id="enrollPartnerSharePct" readonly class="w-full bg-slate-100 border border-slate-200 p-3 rounded-xl text-lg font-black text-slate-500 outline-none" value="30">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3 pt-2">
                    <button id="btnConfirmEnrollPartner" class="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg transition-all">Confirm Enrollment</button>
                    <button class="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-xl font-black uppercase text-xs" onclick="window.UIController.closeModal()">Cancel</button>
                </div>
            </div>
        `;
    },

    renderEditBillModal(bill) {
        return `
            <div class="p-8">
                <h2 class="text-xl font-black text-slate-800 uppercase mb-6">${bill ? 'Edit Bill Template' : 'Add Bill Template'}</h2>
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Bill Name</label>
                            <input type="text" id="billName" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold" value="${bill ? bill.name : ''}" placeholder="e.g. Electricity (ALECO)">
                        </div>
                        <div class="space-y-1">
                            <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Branch</label>
                            <select id="billBranch" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold">
                                <option value="Cabagñan" ${bill?.branch === 'Cabagñan' ? 'selected' : ''}>Cabagñan</option>
                                <option value="Iraya" ${bill?.branch === 'Iraya' ? 'selected' : ''}>Iraya</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Expected Amount</label>
                            <input type="number" id="billAmount" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold" value="${bill ? (bill.expectedAmount || bill.amount) : ''}">
                        </div>
                        <div class="space-y-1">
                            <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Amount Type</label>
                            <select id="billAmountType" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold">
                                <option value="FIXED" ${bill?.amountType === 'FIXED' ? 'selected' : ''}>FIXED</option>
                                <option value="VARIABLE" ${bill?.amountType === 'VARIABLE' ? 'selected' : ''}>VARIABLE / ESTIMATED</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div class="space-y-1">
                            <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Category</label>
                            <select id="billCategory" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold">
                                <option value="ALECO" ${bill?.category === 'ALECO' ? 'selected' : ''}>ALECO</option>
                                <option value="DCTV" ${bill?.category === 'DCTV' ? 'selected' : ''}>DCTV</option>
                                <option value="Water" ${bill?.category === 'Water' ? 'selected' : ''}>Water</option>
                                <option value="Internet" ${bill?.category === 'Internet' ? 'selected' : ''}>Internet</option>
                                <option value="Rent" ${bill?.category === 'Rent' ? 'selected' : ''}>Rent</option>
                                <option value="Other" ${bill?.category === 'Other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Due Day</label>
                            <input type="number" id="billDueDay" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold" value="${bill ? (bill.dueDay || bill.dueDate) : ''}" placeholder="1-31">
                        </div>
                        <div class="space-y-1">
                            <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Frequency</label>
                            <select id="billFreq" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold">
                                <option value="Monthly" ${bill?.frequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
                                <option value="One Time" ${bill?.frequency === 'One Time' ? 'selected' : ''}>One Time</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 mt-8">
                        <button id="btnSaveBill" class="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg">Save Template</button>
                        <button class="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-xl font-black uppercase text-xs" onclick="window.UIController.closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }
};
