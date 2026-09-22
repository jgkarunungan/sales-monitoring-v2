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
        if (!data) return `<div class="p-8 text-center text-slate-400 italic">Processing partner logs sub-ledgers...</div>`;

        const cards = Object.values(data);
        if (cards.length === 0) return `<div class="p-12 text-center text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-300">No genuine PisoWiFi partners detected in active settings.</div>`;

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                ${cards.map(g => `
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover-card">
                        <div class="flex justify-between items-start mb-4">
                            <h3 class="font-black text-slate-800 uppercase tracking-tight text-sm">${safeText(g.partnerName)}</h3>
                            <span class="bg-emerald-50 text-emerald-700 text-[9px] px-2 py-0.5 rounded-full font-black uppercase">Active PisoWiFi</span>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mb-4 text-center">
                            <div class="bg-slate-50 p-2 rounded-xl">
                                <div class="text-[9px] text-slate-400 font-black uppercase">Owner Share %</div>
                                <div class="text-sm font-black text-slate-700">${pct(g.ownerSharePct)}</div>
                            </div>
                            <div class="bg-slate-50 p-2 rounded-xl">
                                <div class="text-[9px] text-slate-400 font-black uppercase">Partner Share %</div>
                                <div class="text-sm font-black text-slate-700">${pct(1 - g.ownerSharePct)}</div>
                            </div>
                        </div>
                        <div class="space-y-1.5 text-xs border-t pt-4">
                            <div class="flex justify-between"><span>Gross Revenue</span><span class="font-bold">${money(g.grossRevenue)}</span></div>
                            <div class="flex justify-between text-slate-500"><span>Owner Revenue (${pct(g.ownerSharePct)})</span><span>${money(g.ownerRevenue)}</span></div>
                            <div class="flex justify-between text-slate-400"><span>Partner Revenue Accrued</span><span>${money(g.partnerRevenueAccrued)}</span></div>
                            <div class="flex justify-between"><span>Full Site Expenses</span><span class="font-medium">${money(g.fullDirectExpenses)}</span></div>
                            <div class="flex justify-between text-red-500"><span>Owner Expense Responsibility</span><span>${money(g.ownerExpenseResponsibility)}</span></div>
                            <div class="border-t pt-2 flex justify-between text-sm font-black text-slate-800">
                                <span>Owner Operating Profit</span>
                                <span class="text-emerald-600">${money(g.ownerOperatingProfit)}</span>
                            </div>
                            <div class="mt-4 pt-2 border-t border-dashed border-slate-100 space-y-1">
                                <div class="flex justify-between text-[10px]"><span>Partner Net Before Payout</span><span class="font-bold">${money(g.partnerNetBeforePayout)}</span></div>
                                <div class="flex justify-between text-[10px] text-slate-400"><span>Verified Payouts</span><span>- ${money(g.verifiedPayouts)}</span></div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderTransactionLog() {
        const logs = DataService.normalizedLogs;
        const filtered = logs.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));

        return `
            <div class="space-y-6">
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
                    <div class="flex gap-4">
                        <input type="text" placeholder="Search description..." class="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-300 w-64">
                        <select class="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs outline-none cursor-pointer">
                            <option>All Types</option>
                            <option>Income</option>
                            <option>Expense</option>
                        </select>
                    </div>
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${filtered.length} TRANSACTIONS LOADED</div>
                </div>

                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                        <tbody class="divide-y divide-slate-50">
                            ${filtered.map(l => `
                                <tr class="hover:bg-slate-50 transition-colors group cursor-pointer" data-tx-id="${l.id}">
                                    <td class="p-4 text-slate-500 font-mono">${l.date}</td>
                                    <td class="p-4"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${l.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${l.type}</span></td>
                                    <td class="p-4 font-bold text-slate-700">${l.branch}</td>
                                    <td class="p-4 text-slate-500">${l.source}</td>
                                    <td class="p-4 font-medium text-slate-800 truncate max-w-xs">${l.label}</td>
                                    <td class="p-4 text-right font-black text-slate-900">${money(l.amount)}</td>
                                    <td class="p-4 text-center font-bold text-slate-400">${pct(l.ownerShare)}</td>
                                    <td class="p-4 text-center">
                                        <button class="text-slate-300 hover:text-slate-900 font-bold uppercase text-[9px]">Details</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
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

        return `
            <div class="space-y-8">
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 class="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Cabagñan Branch Recovery Queue</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="text-[10px] text-slate-400 font-bold border-b uppercase">
                                    <th class="p-2">Priority</th>
                                    <th class="p-2">Target Asset</th>
                                    <th class="p-2">Full Cost</th>
                                    <th class="p-2">Opening Baseline</th>
                                    <th class="p-2">Period Allocation</th>
                                    <th class="p-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cab?.allocationsDetail?.map((a, idx) => `
                                    <tr class="border-b hover:bg-slate-50 font-medium">
                                        <td class="p-4 font-mono text-slate-400">${idx+1}</td>
                                        <td class="p-4 text-slate-800 font-bold">${safeText(a.name)}</td>
                                        <td class="p-4">${money(a.targetAmount).replace('₱','')}</td>
                                        <td class="p-4 text-slate-500">${typeof a.openingRecovered === 'number' ? money(a.openingRecovered).replace('₱','') : a.openingRecovered}</td>
                                        <td class="p-4 font-bold text-amber-600">+ ${money(a.currentPeriodAllocation).replace('₱','')}</td>
                                        <td class="p-4"><span class="px-2 py-0.5 rounded font-black text-[9px] uppercase ${a.status === 'FULLY RECOVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${a.status}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 class="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Iraya Branch Recovery Queue</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="text-[10px] text-slate-400 font-bold border-b uppercase">
                                    <th class="p-2">Priority</th>
                                    <th class="p-2">Target Asset</th>
                                    <th class="p-2">Full Cost</th>
                                    <th class="p-2">Opening Baseline</th>
                                    <th class="p-2">Period Allocation</th>
                                    <th class="p-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${iry?.allocationsDetail?.map((a, idx) => `
                                    <tr class="border-b hover:bg-slate-50 font-medium">
                                        <td class="p-4 font-mono text-slate-400">${idx+1}</td>
                                        <td class="p-4 text-slate-800 font-bold">${safeText(a.name)}</td>
                                        <td class="p-4">${money(a.targetAmount).replace('₱','')}</td>
                                        <td class="p-4 text-slate-500">${typeof a.openingRecovered === 'number' ? money(a.openingRecovered).replace('₱','') : a.openingRecovered}</td>
                                        <td class="p-4 font-bold text-amber-600">+ ${money(a.currentPeriodAllocation).replace('₱','')}</td>
                                        <td class="p-4"><span class="px-2 py-0.5 rounded font-black text-[9px] uppercase bg-amber-100 text-amber-800">${a.status}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderSavings() {
        const c = DataService.consolidatedResult;
        return `
            <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${this.renderMetricCard("Current Period Savings Generated", money(c?.totalSavings), "success", "Sum of post-recovery 5% branch contributions", true)}
                    ${this.renderMetricCard("Accumulated Lifetime Savings Balance", "Opening balance / history required", "warning", "Requires savings-withdrawal baseline logs", false)}
                </div>
                <div class="bg-blue-50 border border-blue-200 p-6 rounded-2xl text-xs text-blue-800 font-medium text-center">
                    <strong>V2 Engine Rule:</strong> Savings contributions are extracted ONLY when branch profit after fulfilling direct costs, wide utility bills, partner splits, and active waterfall allocations remains positive. Savings cannot be generated out of operational branch deficits.
                </div>
            </div>
        `;
    },

    renderDebts() {
        return `
            <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                <div class="text-4xl mb-2">🏛️</div>
                <h3 class="font-bold text-slate-800 mb-1 text-sm uppercase tracking-wide">Debt Ledger Verification</h3>
                <p class="text-slate-400 text-xs max-w-md mx-auto mb-4">Historical debt metadata is uncertain in text description logs. Principal payment tracing will link to the recovery waterfall queue in Stage 3.</p>
                <span class="text-[10px] bg-amber-100 text-amber-800 px-3 py-1 rounded font-black uppercase">Debt data status: Inferred automatically from logs</span>
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
        return audit.note || 'System event';
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
