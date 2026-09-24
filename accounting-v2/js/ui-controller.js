import { DashboardRenderer } from './dashboard-renderer.js';
import { DataService } from './data-service.js';
import { SettingsService } from './settings-service.js';
import { TransactionService } from './transaction-service.js';
import { normalizePartnerType, OWNER_OPERATED_BRANCHES } from './normalization-service.js';

export const UIController = {
    activeTab: 'overview',
    settingsTab: 'general',

    txLogFilters: {
        period: 'This Month',
        type: 'All',
        branch: 'All',
        source: 'All',
        partner: 'All',
        search: '',
        customStart: null,
        customEnd: null
    },

    init() {
        // Attach sidebar click listeners
        const navButtons = document.querySelectorAll('[data-tab]');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = btn.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Attach reporting period change listeners
        const selectPeriod = document.getElementById('periodSelect');
        if (selectPeriod) {
            selectPeriod.addEventListener('change', (e) => {
                DataService.setPeriod(e.target.value);
            });
            selectPeriod.value = DataService.currentPeriod;
        }

        // Login / Logout
        document.getElementById('loginBtn')?.addEventListener('click', () => this.showLoginModal());
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            DataService.logout();
            this.refreshView();
        });

        // Close modal on outside click
        document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') this.closeModal();
        });

        // Initialize display refresh hook linked to state changes
        DataService.subscribe(() => {
            this.refreshView();
            this.updateHeaderStatus();
            this.updateUserSessionUI();
        });
    },

    switchTab(tabName) {
        this.activeTab = tabName;

        const navButtons = document.querySelectorAll('[data-tab]');
        navButtons.forEach(btn => {
            const currentTab = btn.getAttribute('data-tab');
            if (currentTab === tabName) {
                btn.className = 'w-full flex items-center gap-3 px-4 py-3 text-xs font-black uppercase bg-slate-800 text-white rounded-xl transition-all shadow-sm';
            } else {
                btn.className = 'w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase text-slate-400 hover:bg-slate-800/50 hover:text-white rounded-xl transition-all';
            }
        });

        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            pageTitle.innerText = tabName.replace(/-/g, ' ').toUpperCase();
        }

        this.refreshView();
    },

    refreshView() {
        const workspace = document.getElementById('workspaceContent');
        if (!workspace) return;

        if (DataService.connectionStatus === 'ERROR') {
            workspace.innerHTML = `
                <div class="bg-red-50 border border-red-200 p-8 rounded-2xl text-center space-y-4 shadow-sm">
                    <div class="text-3xl">⚠️</div>
                    <h3 class="text-lg font-black text-red-800 uppercase tracking-tight">Firestore Connection Error</h3>
                    <p class="text-xs text-red-600 max-w-md mx-auto font-medium leading-relaxed">${DataService.error || "Unable to establish real-time connection to cloud database."}</p>
                    <button onclick="window.DataService.init()" class="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase rounded-xl shadow-md transition-all">Retry Connection</button>
                </div>
            `;
            return;
        }

        // If user is currently on transaction-entry tab and has an active form open,
        // do not wipe out workspaceContent during background snapshot updates.
        if (this.activeTab === 'transaction-entry' && document.getElementById('entryFormWorkspace')) {
            const activeFormWorkspace = document.getElementById('entryFormWorkspace');
            if (activeFormWorkspace && activeFormWorkspace.children.length > 0 && (document.getElementById('btnSaveIncome') || document.getElementById('btnSaveExpense'))) {
                this.updateHeaderStatus();
                this.updateUserSessionUI();
                return;
            }
        }

        let contentHtml = '';
        switch (this.activeTab) {
            case 'overview': contentHtml = DashboardRenderer.renderOverview(); break;
            case 'transaction-entry': contentHtml = DashboardRenderer.renderTransactionEntry(); break;
            case 'transaction-log': contentHtml = DashboardRenderer.renderTransactionLog(this.txLogFilters); break;
            case 'cabagnan': contentHtml = DashboardRenderer.renderCabagnan(); break;
            case 'iraya': contentHtml = DashboardRenderer.renderIraya(); break;
            case 'partner-pisowifi': contentHtml = DashboardRenderer.renderPartnerPisoWifi(); break;
            case 'recovery-queue': contentHtml = DashboardRenderer.renderRecoveryQueue(); break;
            case 'savings': contentHtml = DashboardRenderer.renderSavings(); break;
            case 'debts': contentHtml = DashboardRenderer.renderDebts(); break;
            case 'reports': contentHtml = DashboardRenderer.renderReports(); break;
            case 'settings': contentHtml = DashboardRenderer.renderSettings(this.settingsTab); break;
            default: contentHtml = `<div class="p-8 text-center text-slate-400 italic">Page content coming soon.</div>`;
        }

        workspace.innerHTML = contentHtml;
        this.attachViewListeners();
    },

    attachViewListeners() {
        if (this.activeTab === 'transaction-entry') {
            this.setupTransactionEntryListeners();
        } else if (this.activeTab === 'settings') {
            this.setupSettingsListeners();
        } else if (this.activeTab === 'recovery-queue') {
            this.setupRecoveryQueueListeners();
        } else if (this.activeTab === 'partner-pisowifi') {
            this.setupPartnerPisoWifiListeners();
        } else if (this.activeTab === 'transaction-log') {
            this.setupTransactionLogListeners();
        }
    },

    // --- TRANSACTION LOG LISTENERS & FILTERS ---
    setupTransactionLogListeners() {
        const searchInput = document.getElementById('txLogSearch');
        const periodSelect = document.getElementById('txLogPeriod');
        const typeSelect = document.getElementById('txLogType');
        const branchSelect = document.getElementById('txLogBranch');
        const sourceSelect = document.getElementById('txLogSource');
        const partnerSelect = document.getElementById('txLogPartner');
        const clearBtn = document.getElementById('btnTxLogClearFilters');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.txLogFilters.search = e.target.value;
                this.updateTransactionLogView();
            });
        }

        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                this.txLogFilters.period = e.target.value;
                this.refreshView();
            });
        }

        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                this.txLogFilters.type = e.target.value;
                this.refreshView();
            });
        }

        if (branchSelect) {
            branchSelect.addEventListener('change', (e) => {
                this.txLogFilters.branch = e.target.value;
                this.refreshView();
            });
        }

        if (sourceSelect) {
            sourceSelect.addEventListener('change', (e) => {
                this.txLogFilters.source = e.target.value;
                this.refreshView();
            });
        }

        if (partnerSelect) {
            partnerSelect.addEventListener('change', (e) => {
                this.txLogFilters.partner = e.target.value;
                this.refreshView();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.txLogFilters = {
                    period: 'This Month',
                    type: 'All',
                    branch: 'All',
                    source: 'All',
                    partner: 'All',
                    search: '',
                    customStart: null,
                    customEnd: null
                };
                this.refreshView();
            });
        }

        this.bindTxRowClickListeners();
    },

    bindTxRowClickListeners() {
        document.querySelectorAll('[data-tx-id]').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.getAttribute('data-tx-id');
                this.showTransactionDetails(id);
            });
        });
    },

    updateTransactionLogView() {
        const logs = DataService.normalizedLogs || [];
        const totalDatasetCount = logs.length;
        const filtered = AccountingService.filterLogs(logs, this.txLogFilters);
        filtered.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));

        const tallyEl = document.getElementById('txLogTallyDisplay');
        if (tallyEl) {
            tallyEl.innerText = `Showing ${filtered.length} of ${totalDatasetCount} transactions`;
        }

        const tableContainer = document.getElementById('txLogTableContainer');
        if (tableContainer) {
            if (filtered.length === 0) {
                tableContainer.innerHTML = `
                    <div class="p-12 text-center text-slate-400 italic font-medium">
                        No transactions match the current filters.
                    </div>
                `;
            } else {
                tableContainer.innerHTML = `
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
                                    <td class="p-4 text-right font-black text-slate-900">₱${l.amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                    <td class="p-4 text-center font-bold text-slate-400">${l.ownerShare !== null && l.ownerShare !== undefined ? (l.ownerShare * 100).toFixed(0) + '%' : 'N/A'}</td>
                                    <td class="p-4 text-center">
                                        <button class="text-slate-300 hover:text-slate-900 font-bold uppercase text-[9px]">Details</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
            this.bindTxRowClickListeners();
        }
    },

    // --- PARTNER PISOWIFI LISTENERS & MODALS ---
    setupPartnerPisoWifiListeners() {
        document.querySelectorAll('[data-edit-partner-share]').forEach(btn => {
            btn.addEventListener('click', () => {
                const partnerName = btn.getAttribute('data-edit-partner-share');
                this.showEditPartnerShareModal(partnerName);
            });
        });

        document.querySelectorAll('[data-enroll-partner]').forEach(btn => {
            btn.addEventListener('click', () => {
                const partnerName = btn.getAttribute('data-enroll-partner');
                this.showEnrollPartnerModal(partnerName);
            });
        });
    },

    showEditPartnerShareModal(partnerName) {
        const partners = DataService.getPartners();
        const pObj = partners.find(p => p.name && p.name.toLowerCase() === partnerName.toLowerCase());

        let currentOwnerPct = 50;
        if (pObj && pObj.share !== undefined) {
            currentOwnerPct = pObj.share <= 1.0 ? Math.round(pObj.share * 100) : Math.round(pObj.share);
        } else if (DataService.partnerPisoWifiResult && DataService.partnerPisoWifiResult[partnerName]) {
            const groupData = DataService.partnerPisoWifiResult[partnerName];
            if (groupData.currentOwnerShare !== null && groupData.currentOwnerShare !== undefined) {
                currentOwnerPct = Math.round(groupData.currentOwnerShare * 100);
            }
        }

        this.openModal(DashboardRenderer.renderEditPartnerShareModal(partnerName, currentOwnerPct));

        const ownerInput = document.getElementById('inputOwnerSharePct');
        const partnerInput = document.getElementById('inputPartnerSharePct');

        if (ownerInput && partnerInput) {
            ownerInput.addEventListener('input', () => {
                let val = parseFloat(ownerInput.value || 0);
                if (val < 0) val = 0;
                if (val > 100) val = 100;
                partnerInput.value = 100 - val;
            });
        }

        document.getElementById('btnSavePartnerShare')?.addEventListener('click', async () => {
            const newOwnerPct = parseFloat(ownerInput.value);
            if (isNaN(newOwnerPct) || newOwnerPct < 0 || newOwnerPct > 100) {
                return alert("Owner share must be between 0% and 100%.");
            }
            const newPartnerPct = 100 - newOwnerPct;

            const confirmMsg = `CONFIRM SHARE AGREEMENT CHANGE:\n\n` +
                               `Partner: ${partnerName}\n\n` +
                               `CURRENT AGREEMENT:\nOwner: ${currentOwnerPct}% | Partner: ${100 - currentOwnerPct}%\n\n` +
                               `NEW AGREEMENT:\nOwner: ${newOwnerPct}% | Partner: ${newPartnerPct}%\n\n` +
                               `⚠️ WARNING: This change applies ONLY to future transactions.\nHistorical transactions preserve their recorded shares intact.\n\nDo you want to proceed?`;

            if (confirm(confirmMsg)) {
                try {
                    await SettingsService.updatePartnerShare(partnerName, newOwnerPct / 100.0);
                    this.closeModal();
                } catch (err) {
                    alert("Error updating partner share: " + err.message);
                }
            }
        });
    },

    showEnrollPartnerModal(partnerName) {
        this.openModal(DashboardRenderer.renderEnrollPartnerModal(partnerName));

        const ownerInput = document.getElementById('enrollOwnerSharePct');
        const partnerInput = document.getElementById('enrollPartnerSharePct');
        const nameInput = document.getElementById('enrollPartnerName');

        if (ownerInput && partnerInput) {
            ownerInput.addEventListener('input', () => {
                let val = parseFloat(ownerInput.value || 0);
                if (val < 0) val = 0;
                if (val > 100) val = 100;
                partnerInput.value = 100 - val;
            });
        }

        document.getElementById('btnConfirmEnrollPartner')?.addEventListener('click', async () => {
            const finalName = nameInput.value.trim() || partnerName;
            const newOwnerPct = parseFloat(ownerInput.value);
            if (isNaN(newOwnerPct) || newOwnerPct < 0 || newOwnerPct > 100) {
                return alert("Owner share must be between 0% and 100%.");
            }

            try {
                await SettingsService.enrollPartner({
                    name: finalName,
                    ownerShare: newOwnerPct / 100.0
                });
                this.closeModal();
            } catch (err) {
                alert("Error enrolling partner: " + err.message);
            }
        });
    },

    // --- RECOVERY QUEUE LISTENERS & MODALS ---
    setupRecoveryQueueListeners() {
        document.getElementById('btnAddRecoveryTarget')?.addEventListener('click', () => {
            this.showAddTargetModal();
        });

        document.getElementById('btnAddSourceFromRecovery')?.addEventListener('click', () => {
            this.showAddSourceModal();
        });

        document.querySelectorAll('[data-edit-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-edit-target');
                this.showEditTargetModal(id);
            });
        });

        document.querySelectorAll('[data-delete-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-delete-target');
                this.showDeleteTargetModal(id);
            });
        });

        document.querySelectorAll('[data-restore-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-restore-target');
                this.handleRestoreTarget(id);
            });
        });
    },

    showAddTargetModal() {
        this.openModal(DashboardRenderer.renderAddTargetModal());

        document.getElementById('btnQuickAddSource')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAddSourceModal(() => {
                this.showAddTargetModal();
            });
        });

        document.getElementById('btnSaveNewTarget')?.addEventListener('click', async () => {
            const name = document.getElementById('addTargetName').value.trim();
            const cost = parseFloat(document.getElementById('addTargetCost').value);
            const fundingMode = document.getElementById('addTargetFundingMode').value;
            const branch = document.getElementById('addTargetBranch').value;
            const source = document.getElementById('addTargetSource').value;
            const recoveryPercent = parseFloat(document.getElementById('addTargetPercent').value) / 100.0;
            const openingRecovered = parseFloat(document.getElementById('addTargetOpeningRecovered').value || 0);
            const notes = document.getElementById('addTargetNotes').value.trim();

            if (!name) return alert("Please enter a Target Name.");
            if (isNaN(cost) || cost <= 0) return alert("Target Amount must be greater than 0.");
            if (isNaN(recoveryPercent) || recoveryPercent < 0 || recoveryPercent > 1.0) return alert("Recovery Percentage must be between 0% and 100%.");
            if (isNaN(openingRecovered) || openingRecovered < 0) return alert("Opening Recovered must be >= 0.");
            if (openingRecovered > cost) return alert("Opening Recovered cannot exceed Target Amount.");

            try {
                await SettingsService.addRecoveryTarget({
                    name,
                    cost,
                    recoveryFundingMode: fundingMode,
                    branch,
                    source,
                    recoveryPercent,
                    openingRecovered,
                    notes
                });
                this.closeModal();
            } catch (err) {
                alert("Error adding recovery target: " + err.message);
            }
        });
    },

    showAddSourceModal(onSuccessCallback = null) {
        this.openModal(DashboardRenderer.renderAddSourceModal());

        document.getElementById('btnSaveNewSource')?.addEventListener('click', async () => {
            const name = document.getElementById('addSrcName').value.trim();
            const type = document.getElementById('addSrcType').value;
            const branch = document.getElementById('addSrcBranch').value;
            const ownerShare = parseFloat(document.getElementById('addSrcShare').value || 100) / 100.0;
            const notes = document.getElementById('addSrcNotes').value.trim();

            if (!name) return alert("Please enter a Source Name.");

            try {
                await SettingsService.addIncomeSource({
                    name,
                    sourceType: type,
                    branch,
                    ownerShare,
                    partnerShare: 1.0 - ownerShare,
                    notes
                });
                if (onSuccessCallback) {
                    onSuccessCallback();
                } else {
                    this.closeModal();
                }
            } catch (err) {
                alert("Error adding income source: " + err.message);
            }
        });
    },

    showEditTargetModal(id) {
        const assets = DataService.getAssets();
        const target = assets.find(a => a.id === id);
        if (!target) return alert("Target not found");

        this.openModal(DashboardRenderer.renderEditTargetModal(target));

        document.getElementById('btnSaveTarget')?.addEventListener('click', async () => {
            const name = document.getElementById('targetName').value.trim();
            const branch = document.getElementById('targetBranch').value;
            const priority = parseInt(document.getElementById('targetPriority').value, 10);
            const cost = parseFloat(document.getElementById('targetCost').value);
            const recoveryPercent = parseFloat(document.getElementById('targetPercent').value) / 100.0;
            const openingRecovered = parseFloat(document.getElementById('targetOpeningRecovered').value || 0);
            const paused = document.getElementById('targetPaused').value === "true";
            const notes = document.getElementById('targetNotes').value.trim();

            if (!name) return alert("Please enter a Target Name.");
            if (isNaN(cost) || cost <= 0) return alert("Target Amount must be greater than 0.");
            if (isNaN(recoveryPercent) || recoveryPercent < 0 || recoveryPercent > 1.0) return alert("Recovery Percentage must be between 0% and 100%.");
            if (isNaN(priority) || priority < 1) return alert("Priority must be a positive integer.");
            if (isNaN(openingRecovered) || openingRecovered < 0) return alert("Opening Recovered must be >= 0.");
            if (openingRecovered > cost) return alert("Opening Recovered cannot exceed Target Amount.");

            const hasHistory = target.openingRecovered > 0 || (target.cost !== cost && target.openingRecovered > 0);
            if (hasHistory && cost !== target.cost) {
                const confirmChange = confirm("This recovery target already has recorded recovery history.\n\nChanging the target amount will change the remaining balance but will not change previously recorded recovery.\n\nDo you want to proceed?");
                if (!confirmChange) return;
            }

            const recoveryFundingMode = document.getElementById('targetFundingMode')?.value || "SOURCE_SELF_RECOVERY";
            const source = document.getElementById('targetSource')?.value.trim() || "Coffee Vendo";

            try {
                await SettingsService.editRecoveryTarget(id, {
                    name,
                    branch,
                    source,
                    recoveryFundingMode,
                    priority,
                    cost,
                    recoveryPercent,
                    openingRecovered,
                    paused,
                    notes
                });
                this.closeModal();
            } catch (err) {
                alert("Error updating recovery target: " + err.message);
            }
        });
    },

    showDeleteTargetModal(id) {
        const assets = DataService.getAssets();
        const target = assets.find(a => a.id === id);
        if (!target) return alert("Target not found");

        const openingRecovered = typeof target.openingRecovered === 'number' ? target.openingRecovered : (parseFloat(target.openingRecovered) || 0);
        const cabAlloc = DataService.cabagnanResult?.allocationsDetail?.find(a => a.id === id);
        const iryAlloc = DataService.irayaResult?.allocationsDetail?.find(a => a.id === id);
        const periodAlloc = (cabAlloc?.currentPeriodAllocation || 0) + (iryAlloc?.currentPeriodAllocation || 0);
        const totalRecovered = openingRecovered + periodAlloc;
        const remaining = Math.max(0, target.cost - totalRecovered);

        const hasHistory = openingRecovered > 0 || periodAlloc > 0 || target.hasLedger === true;

        this.openModal(DashboardRenderer.renderDeleteTargetModal(target, hasHistory, totalRecovered, remaining));

        document.getElementById('btnConfirmDelete')?.addEventListener('click', async () => {
            try {
                await SettingsService.deleteOrArchiveRecoveryTarget(id);
                this.closeModal();
            } catch (err) {
                alert("Error removing recovery target: " + err.message);
            }
        });
    },

    async handleRestoreTarget(id) {
        const assets = DataService.getAssets();
        const target = assets.find(a => a.id === id);
        if (!target) return;

        if (confirm(`Restore '${target.name}' back to active Recovery Queue for ${target.branch}?`)) {
            try {
                await SettingsService.restoreRecoveryTarget(id);
            } catch (err) {
                alert("Error restoring target: " + err.message);
            }
        }
    },

    // --- SETTINGS LISTENERS ---
    setupSettingsListeners() {
        document.querySelectorAll('[data-settings-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.settingsTab = btn.getAttribute('data-settings-tab');
                this.refreshView();
            });
        });

        if (this.settingsTab === 'bills') {
            document.getElementById('btnAddBill')?.addEventListener('click', () => this.showBillModal());

            document.querySelectorAll('[data-edit-bill]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = btn.getAttribute('data-edit-bill');
                    const bill = DataService.projectedExpenses.find(b => b.id === id);
                    this.showBillModal(bill);
                });
            });

            document.querySelectorAll('[data-delete-bill]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = btn.getAttribute('data-delete-bill');
                    const bill = DataService.projectedExpenses.find(b => b.id === id);
                    if (confirm(`Delete this upcoming bill template (${bill.name})?\nHistorical expense transactions will remain unchanged.`)) {
                        await SettingsService.deleteUpcomingBill(id);
                    }
                });
            });

            document.querySelectorAll('[data-record-bill]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = btn.getAttribute('data-record-bill');
                    const bill = DataService.projectedExpenses.find(b => b.id === id);
                    this.handleRecordBill(bill);
                });
            });
        }
    },

    showBillModal(bill = null) {
        this.openModal(DashboardRenderer.renderEditBillModal(bill));

        document.getElementById('btnSaveBill')?.addEventListener('click', async () => {
            const data = {
                name: document.getElementById('billName').value,
                branch: document.getElementById('billBranch').value,
                expectedAmount: parseFloat(document.getElementById('billAmount').value),
                amountType: document.getElementById('billAmountType').value,
                category: document.getElementById('billCategory').value,
                dueDay: parseInt(document.getElementById('billDueDay').value),
                frequency: document.getElementById('billFreq').value,
                active: true
            };

            if (!data.name || isNaN(data.expectedAmount)) return alert("Please fill all required fields.");

            if (bill) {
                await SettingsService.updateUpcomingBill(bill.id, data);
            } else {
                await SettingsService.addUpcomingBill(data);
            }
            this.closeModal();
        });
    },

    handleRecordBill(bill) {
        this.switchTab('transaction-entry');
        const ws = document.getElementById('entryFormWorkspace');
        ws.innerHTML = DashboardRenderer.renderExpenseForm();
        this.initExpenseForm(bill);

        // Add duplicate warning if already recorded
        const status = DashboardRenderer.getBillMonthStatus(bill);
        if (status === 'RECORDED') {
            const statusEl = document.getElementById('exStatus');
            if (statusEl) {
                statusEl.innerHTML = `<div class="bg-amber-900/50 p-3 rounded-xl border border-amber-500/50 text-amber-200 mb-4 text-center">
                    ⚠️ This bill appears to have already been recorded this month.
                </div>`;
            }
        }
    },

    // --- TRANSACTION ENTRY LOGIC ---
    setupTransactionEntryListeners() {
        const ws = document.getElementById('entryFormWorkspace');

        document.getElementById('btnIncomeForm')?.addEventListener('click', () => {
            ws.innerHTML = DashboardRenderer.renderIncomeForm();
            this.initIncomeForm();
        });

        document.getElementById('btnExpenseForm')?.addEventListener('click', () => {
            ws.innerHTML = DashboardRenderer.renderExpenseForm();
            this.initExpenseForm();
        });

        document.getElementById('quickPaySelect')?.addEventListener('change', (e) => {
            const billId = e.target.value;
            if (!billId) return;
            const bill = DataService.projectedExpenses.find(b => b.id === billId);
            if (bill) {
                ws.innerHTML = DashboardRenderer.renderExpenseForm();
                this.initExpenseForm(bill);

                // Duplicate check
                const status = DashboardRenderer.getBillMonthStatus(bill);
                if (status === 'RECORDED') {
                    const exStatusEl = document.getElementById('exStatus');
                    if (exStatusEl) {
                        exStatusEl.innerHTML = `<div class="bg-amber-900/50 p-3 rounded-xl border border-amber-500/50 text-amber-200 mb-4 text-center">
                            ⚠️ This bill appears to have already been recorded this month.
                        </div>`;
                    }
                }
            }
        });
    },

    initIncomeForm() {
        const groupEl = document.getElementById('inGroup');
        const sourceEl = document.getElementById('inSource');
        const partnerCont = document.getElementById('partnerSelectContainer');
        const partnerEl = document.getElementById('inPartner');
        const amountEl = document.getElementById('inAmount');
        const dateEl = document.getElementById('inDate');
        const labelEl = document.getElementById('inLabel');
        const saveBtn = document.getElementById('btnSaveIncome');

        dateEl.valueAsDate = new Date();

        const updateSources = () => {
            const group = groupEl.value;
            const coreSources = {
                'Cabagñan': ['Pisonet', 'PisoWiFi', 'Coffee Vendo', 'Printing / Photocopy'],
                'Iraya': ['Pisonet', 'PisoWiFi'],
                'Partner PisoWiFi': ['PisoWiFi']
            };

            let options = (coreSources[group] || []).map(s => `<option value="${s}">${s}</option>`).join('');
            const dynamic = DataService.incomeSources.filter(s => s.branch === group && s.active);
            options += dynamic.map(s => `<option value="${s.name}" data-id="${s.id}" data-type="${s.sourceType}">${s.name}</option>`).join('');

            sourceEl.innerHTML = options;

            if (group === 'Partner PisoWiFi') {
                partnerCont.classList.remove('hidden');
            } else {
                partnerCont.classList.add('hidden');
            }
            updatePreview();
        };

        const updatePreview = () => {
            const amount = parseFloat(amountEl.value || 0);
            const group = groupEl.value;
            const sourceName = sourceEl.value;
            const partnerName = partnerEl.value;

            document.getElementById('preBranch').innerText = group;
            document.getElementById('preSource').innerText = sourceName;
            document.getElementById('preGross').innerText = "₱" + amount.toLocaleString();

            let ownerPct = 1.0;
            if (group === 'Partner PisoWiFi') {
                const p = DataService.partners.find(p => p.name === partnerName);
                ownerPct = p ? p.share : 0.5;
            } else if (group === 'Iraya' && sourceName === 'Pisonet') {
                const p = DataService.partners.find(p => p.name.includes('Iraya') && normalizePartnerType(p.type) === 'Pisonet');
                ownerPct = p ? p.share : 0.5;
            }

            const ownerRev = amount * ownerPct;
            const partnerShare = amount * (1 - ownerPct);

            document.getElementById('preOwner').innerText = "₱" + ownerRev.toLocaleString(undefined, {minimumFractionDigits:2});
            document.getElementById('prePartner').innerText = "₱" + partnerShare.toLocaleString(undefined, {minimumFractionDigits:2});

            return { ownerPct, ownerRev, partnerShare };
        };

        groupEl.addEventListener('change', updateSources);
        sourceEl.addEventListener('change', updatePreview);
        partnerEl.addEventListener('change', updatePreview);
        amountEl.addEventListener('input', updatePreview);

        updateSources();

        saveBtn.addEventListener('click', async () => {
            if (!amountEl.value || amountEl.value <= 0) return alert("Please enter a valid amount.");
            if (!dateEl.value) return alert("Please select a date.");

            const selectedSourceOption = sourceEl.options[sourceEl.selectedIndex];
            const sourceId = selectedSourceOption.getAttribute('data-id');
            const sourceType = selectedSourceOption.getAttribute('data-type') || sourceEl.value;

            const { ownerPct } = updatePreview();
            const partnerObj = groupEl.value === 'Partner PisoWiFi' ? DataService.partners.find(p => p.name === partnerEl.value) : null;

            const data = {
                amount: parseFloat(amountEl.value),
                label: labelEl.value || `${sourceEl.value} Collection`,
                branch: groupEl.value,
                source: sourceEl.value,
                sourceType: sourceType,
                sourceId: sourceId,
                accountingGroup: groupEl.value,
                partnerId: partnerObj?.id || partnerObj?.name || null,
                partnerName: partnerObj?.name || null,
                ownerShare: ownerPct,
                partnerShare: 1 - ownerPct,
                transactionDate: dateEl.value
            };

            saveBtn.disabled = true;
            const originalBtnText = saveBtn.innerText;
            saveBtn.innerText = "Saving Transaction...";

            let docId = null;
            try {
                docId = await TransactionService.recordIncome(data);
            } catch (saveError) {
                console.error("Firestore Income save failed:", saveError);
                alert("Transaction could not be saved: " + saveError.message);
                saveBtn.disabled = false;
                saveBtn.innerText = originalBtnText;
                return;
            }

            try {
                saveBtn.disabled = false;
                saveBtn.innerText = originalBtnText;

                if (amountEl) amountEl.value = "";
                if (labelEl) labelEl.value = "";

                const statusEl = document.getElementById('inStatus');
                if (statusEl) {
                    statusEl.innerHTML = `
                        <div class="text-emerald-600 mb-2 font-bold">✅ Transaction Saved Successfully</div>
                        <button class="text-blue-600 hover:underline text-xs font-bold" onclick="UIController.switchTab('transaction-log')">View in Transaction Log</button>
                    `;
                } else {
                    alert("Transaction saved successfully!");
                }
            } catch (uiError) {
                console.error("Post-save UI error (Income):", uiError);
            }
        });
    },

    initExpenseForm(prefillBill = null) {
        const branchEl = document.getElementById('exBranch');
        const scopeEl = document.getElementById('exScope');
        const sourceCont = document.getElementById('exSourceContainer');
        const sourceEl = document.getElementById('exSource');
        const partnerCont = document.getElementById('exPartnerContainer');
        const partnerEl = document.getElementById('exPartner');
        const amountEl = document.getElementById('exAmount');
        const categoryEl = document.getElementById('exCategory');
        const labelEl = document.getElementById('exLabel');
        const dateEl = document.getElementById('exDate');
        const saveBtn = document.getElementById('btnSaveExpense');

        dateEl.valueAsDate = new Date();

        const updateScopes = () => {
            const branch = branchEl.value;
            let options = '';
            if (branch === 'Cabagñan') {
                options = `
                    <option value="branch">Branch Operating Expense</option>
                    <option value="source">Source Direct Expense</option>
                `;
            } else if (branch === 'Iraya') {
                options = `
                    <option value="shared_branch">Shared Branch Expense (50/50)</option>
                    <option value="source">Source Direct Expense</option>
                    <option value="branch">Other Owner branch Overhead (100%)</option>
                `;
            } else {
                options = `<option value="source">Partner PisoWiFi Direct Expense</option>`;
            }
            scopeEl.innerHTML = options;
            updateFields();
        };

        const updateFields = () => {
            const branch = branchEl.value;
            const scope = scopeEl.value;

            if (scope === 'source') {
                sourceCont.classList.remove('hidden');
                const dynamic = DataService.incomeSources.filter(s => s.branch === branch && s.active);
                const cores = branch === 'Cabagñan' ? ['Pisonet', 'PisoWiFi', 'Coffee Vendo', 'Printing / Photocopy'] : ['Pisonet', 'PisoWiFi'];
                sourceEl.innerHTML = cores.map(c => `<option value="${c}">${c}</option>`).join('') +
                                     dynamic.map(s => `<option value="${s.name}" data-id="${s.id}" data-type="${s.sourceType}">${s.name}</option>`).join('');
            } else {
                sourceCont.classList.add('hidden');
            }

            if (branch === 'Partner PisoWiFi') {
                partnerCont.classList.remove('hidden');
                const pList = DataService.partners.filter(p => normalizePartnerType(p.type) === 'PisoWiFi' && !OWNER_OPERATED_BRANCHES.includes(p.name));
                partnerEl.innerHTML = pList.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
            } else {
                partnerCont.classList.add('hidden');
            }
            updatePreview();
        };

        const updatePreview = () => {
            const amount = parseFloat(amountEl.value || 0);
            const branch = branchEl.value;
            const scope = scopeEl.value;
            const sourceName = sourceEl.value;

            document.getElementById('preExFull').innerText = "₱" + amount.toLocaleString();

            let ownerPct = 1.0;
            let splitText = "Owner 100%";

            if (scope === 'shared_branch') {
                ownerPct = 0.5;
                splitText = "Shared 50/50";
            } else if (branch === 'Partner PisoWiFi') {
                const p = DataService.partners.find(p => p.name === partnerEl.value);
                ownerPct = p ? p.share : 0.5;
                splitText = `Owner ${pct(ownerPct)} / Partner ${pct(1-ownerPct)}`;
            } else if (branch === 'Iraya' && scope === 'source' && sourceName === 'Pisonet') {
                const p = DataService.partners.find(p => p.name.includes('Iraya') && normalizePartnerType(p.type) === 'Pisonet');
                ownerPct = p ? p.share : 0.5;
                splitText = `Owner ${pct(ownerPct)} / Partner ${pct(1-ownerPct)}`;
            }

            const ownerResp = amount * ownerPct;
            const partnerResp = amount * (1 - ownerPct);

            document.getElementById('preExSplit').innerText = splitText;
            document.getElementById('preExOwner').innerText = "₱" + ownerResp.toLocaleString(undefined, {minimumFractionDigits:2});
            document.getElementById('preExPartner').innerText = "₱" + partnerResp.toLocaleString(undefined, {minimumFractionDigits:2});

            return { ownerPct, ownerResp, partnerResp };
        };

        branchEl.addEventListener('change', updateScopes);
        scopeEl.addEventListener('change', updateFields);
        sourceEl.addEventListener('change', updatePreview);
        partnerEl.addEventListener('change', updatePreview);
        amountEl.addEventListener('input', updatePreview);

        if (prefillBill) {
            branchEl.value = prefillBill.branch || 'Cabagñan';
            updateScopes();
            amountEl.value = prefillBill.expectedAmount || prefillBill.amount;
            labelEl.value = prefillBill.name;
            if (prefillBill.category) {
                categoryEl.value = prefillBill.category;
            } else {
                if (prefillBill.name.includes('ALECO')) categoryEl.value = 'ALECO';
                else if (prefillBill.name.includes('DCTV')) categoryEl.value = 'DCTV';
            }
            updatePreview();
        } else {
            updateScopes();
        }

        saveBtn.addEventListener('click', async () => {
            if (!amountEl.value || amountEl.value <= 0) return alert("Please enter a valid amount.");
            if (!dateEl.value) return alert("Please select a date.");
            if (categoryEl.value === 'Other' && !labelEl.value) return alert("Please provide a description for 'Other' category.");

            const { ownerPct, ownerResp, partnerResp } = updatePreview();
            const partnerObj = !partnerCont.classList.contains('hidden') ? DataService.partners.find(p => p.name === partnerEl.value) : null;

            const data = {
                amount: parseFloat(amountEl.value),
                label: labelEl.value || categoryEl.value,
                branch: branchEl.value,
                source: sourceCont.classList.contains('hidden') ? null : sourceEl.value,
                accountingGroup: branchEl.value,
                expenseScope: scopeEl.value === 'shared_branch' ? 'Shared Branch Expense' : (scopeEl.value === 'branch' ? 'Branch Operating Expense' : 'Source Direct Expense'),
                expenseCategory: categoryEl.value,
                partnerId: partnerObj?.id || partnerObj?.name || null,
                partnerName: partnerObj?.name || null,
                ownerShare: ownerPct,
                partnerShare: 1 - ownerPct,
                ownerExpenseResponsibility: ownerResp,
                partnerExpenseResponsibility: partnerResp,
                transactionDate: dateEl.value
            };

            saveBtn.disabled = true;
            const originalBtnText = saveBtn.innerText;
            saveBtn.innerText = "Saving Transaction...";

            let docId = null;
            try {
                docId = await TransactionService.recordExpense(data);
            } catch (saveError) {
                console.error("Firestore Expense save failed:", saveError);
                alert("Transaction could not be saved: " + saveError.message);
                saveBtn.disabled = false;
                saveBtn.innerText = originalBtnText;
                return;
            }

            try {
                saveBtn.disabled = false;
                saveBtn.innerText = originalBtnText;

                if (amountEl) amountEl.value = "";
                if (labelEl) labelEl.value = "";

                const statusEl = document.getElementById('exStatus');
                if (statusEl) {
                    statusEl.innerHTML = `
                        <div class="text-emerald-400 mb-2 font-bold">✅ Transaction Saved Successfully</div>
                        <button class="text-white hover:underline text-xs font-bold" onclick="UIController.switchTab('transaction-log')">View in Transaction Log</button>
                    `;
                } else {
                    alert("Transaction saved successfully!");
                }
            } catch (uiError) {
                console.error("Post-save UI error (Expense):", uiError);
            }
        });
    },

    updateHeaderStatus() {
        const connectionBadge = document.getElementById('connectionBadge');
        const syncTimestamp = document.getElementById('syncTimestamp');

        if (connectionBadge) {
            connectionBadge.innerText = DataService.connectionStatus;
            if (DataService.connectionStatus === 'CONNECTED') {
                connectionBadge.className = 'px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-wider';
            } else if (DataService.connectionStatus === 'ERROR') {
                connectionBadge.className = 'px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black rounded-full uppercase tracking-wider';
                if (DataService.error) connectionBadge.innerText = `ERROR: ${DataService.error.substring(0, 20)}`;
            } else {
                connectionBadge.className = 'px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full uppercase tracking-wider';
            }
        }
        if (syncTimestamp) syncTimestamp.innerText = `Last Sync: ${DataService.lastSync}`;
    },

    updateUserSessionUI() {
        const nameEl = document.getElementById('userName');
        const roleEl = document.getElementById('userRole');
        const initialsEl = document.getElementById('userInitials');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (DataService.currentUser) {
            nameEl.innerText = DataService.currentUser.username;
            roleEl.innerText = DataService.currentUser.role.toUpperCase();
            initialsEl.innerText = DataService.currentUser.username.substring(0, 1).toUpperCase();
            loginBtn?.classList.add('hidden');
            logoutBtn?.classList.remove('hidden');
        } else {
            nameEl.innerText = "Guest";
            roleEl.innerText = "Please Login";
            initialsEl.innerText = "?";
            loginBtn?.classList.remove('hidden');
            logoutBtn?.classList.add('hidden');
        }
    },

    openModal(html) {
        const overlay = document.getElementById('modalOverlay');
        const content = document.getElementById('modalContent');
        if (overlay && content) {
            content.innerHTML = html;
            overlay.classList.remove('hidden');
        }
    },

    closeModal() {
        document.getElementById('modalOverlay')?.classList.add('hidden');
    },

    showLoginModal() {
        const html = `
            <div class="p-8">
                <h2 class="text-2xl font-black text-slate-800 uppercase mb-2">System Login</h2>
                <p class="text-slate-400 text-sm mb-6 font-medium">Please enter your credentials to access management features.</p>
                <div class="space-y-4">
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Username</label>
                        <input type="text" id="loginUsername" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-800 font-bold focus:ring-2 focus:ring-slate-300 outline-none" placeholder="Enter username">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Password</label>
                        <input type="password" id="loginPassword" class="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-800 font-bold focus:ring-2 focus:ring-slate-300 outline-none" placeholder="••••••••">
                    </div>
                    <div id="loginError" class="text-red-500 text-xs font-bold hidden">Invalid username or password.</div>
                    <button id="doLogin" class="w-full bg-slate-900 text-white p-4 rounded-2xl font-black uppercase text-sm shadow-xl hover:bg-slate-800 transition-all mt-4">Sign In</button>
                </div>
            </div>
        `;
        this.openModal(html);
        document.getElementById('doLogin')?.addEventListener('click', async () => {
            const u = document.getElementById('loginUsername').value;
            const p = document.getElementById('loginPassword').value;
            const result = await DataService.login(u, p);
            if (result.success) {
                this.closeModal();
            } else {
                document.getElementById('loginError').classList.remove('hidden');
            }
        });
    },

    showTransactionDetails(id) {
        const tx = DataService.normalizedLogs.find(l => l.id === id);
        if (!tx) return;

        const isAdmin = DataService.currentRole === 'admin';

        const html = `
            <div class="flex flex-col h-full">
                <div class="p-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-black text-slate-800 uppercase">Transaction Details</h2>
                        <p class="text-[10px] text-slate-400 font-mono mt-1">${tx.id}</p>
                    </div>
                    <button class="text-slate-400 hover:text-slate-600 p-2" onclick="window.UIController.closeModal()">✕</button>
                </div>
                <div class="p-8 overflow-y-auto flex-1 space-y-6">
                    <div class="grid grid-cols-2 gap-8">
                        <div>
                            <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Business Date</label>
                            <div class="font-bold text-slate-800">${tx.date}</div>
                        </div>
                        <div>
                            <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Amount</label>
                            <div class="font-black text-slate-900 text-lg">₱${tx.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                        </div>
                        <div>
                            <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                            <div class="uppercase font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'}">${tx.type}</div>
                        </div>
                        <div>
                            <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Accounting Group</label>
                            <div class="font-bold text-slate-700">${tx.branch}</div>
                        </div>
                        <div>
                            <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Source</label>
                            <div class="font-bold text-slate-700">${tx.source}</div>
                        </div>
                        <div>
                            <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Partner / Location</label>
                            <div class="font-bold text-slate-700">${tx.partnerName || 'None'}</div>
                        </div>
                    </div>
                    <div class="border-t pt-6">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                        <div class="p-4 bg-slate-50 rounded-xl font-medium text-slate-700 mt-1 italic">"${tx.label}"</div>
                    </div>
                    <div class="bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <div class="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <div class="text-[8px] font-black text-amber-600 uppercase">Owner Share</div>
                                <div class="text-sm font-black text-amber-800">${(tx.ownerShare * 100).toFixed(1)}%</div>
                            </div>
                            <div>
                                <div class="text-[8px] font-black text-amber-600 uppercase">Partner Share</div>
                                <div class="text-sm font-black text-amber-800">${(tx.partnerShare * 100).toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    ${isAdmin ? `<button id="editTx" class="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg shadow-slate-200">Edit Transaction</button>` : ''}
                    <button class="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-xl font-black uppercase text-xs" onclick="window.UIController.closeModal()">Close</button>
                </div>
            </div>
        `;
        this.openModal(html);

        document.getElementById('editTx')?.addEventListener('click', () => this.showEditTransaction(id));
    },

    showEditTransaction(id) {
        const tx = DataService.normalizedLogs.find(l => l.id === id);
        if (!tx) return;

        const html = `
            <div class="p-8">
                <h2 class="text-xl font-black text-slate-800 uppercase mb-6">Edit Transaction</h2>
                <div class="space-y-4">
                    <div class="bg-amber-50 p-4 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-bold mb-6">
                        ⚠️ Changing ownership percentage changes historical accounting for this transaction.
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Amount (₱)</label>
                            <input type="number" id="editAmount" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold" value="${tx.amount}">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Owner Share (%)</label>
                            <input type="number" id="editOwnerShare" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold" value="${(tx.ownerShare * 100).toFixed(0)}">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Label / Description</label>
                        <input type="text" id="editLabel" class="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold" value="${tx.label}">
                    </div>
                    <div class="flex justify-end gap-3 mt-8">
                        <button id="saveEdit" class="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black uppercase text-xs shadow-lg shadow-emerald-100">Save Changes</button>
                        <button class="bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-xl font-black uppercase text-xs" onclick="window.UIController.closeModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        this.openModal(html);

        document.getElementById('saveEdit')?.addEventListener('click', async () => {
            const upd = {
                amount: parseFloat(document.getElementById('editAmount').value),
                ownerShare: parseFloat(document.getElementById('editOwnerShare').value) / 100,
                label: document.getElementById('editLabel').value,
                raw: tx.raw
            };
            await TransactionService.updateTransaction(id, upd);
            this.closeModal();
        });
    }
};

window.UIController = UIController;
