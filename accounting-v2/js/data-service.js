import {
    db,
    logCol,
    settingsDocRef,
    auditCol,
    onSnapshot,
    query,
    orderBy
} from './firebase-config.js';
import { normalizeLog } from './normalization-service.js';
import { AccountingService } from './accounting-service.js';

export const DEFAULT_PARTNERS = [
    { id: "p_iraya_pisonet", name: "Iraya Pisonet", type: "Pisonet", location: "Iraya", share: 0.50, status: "Active" }
];

export const DEFAULT_RECOVERY_ASSETS = [
    { id: "rec_coffee_machine", name: "Coffee Vendo Machine", branch: "Cabagñan", source: "Coffee Vendo", cost: 20000, recoveryPercent: 0.50, recoveryFundingMode: "SOURCE_SELF_RECOVERY", priority: 1, openingRecovered: 0, paused: false, notes: "", archived: false },
    { id: "rec_metal_case", name: "Coffee Metal Case", branch: "Cabagñan", source: "Coffee Vendo", cost: 8000, recoveryPercent: 0.50, recoveryFundingMode: "SOURCE_SELF_RECOVERY", priority: 2, openingRecovered: 0, paused: false, notes: "", archived: false }
];

// Central Database State Store
export const DataService = {
    rawLogs: [],
    normalizedLogs: [],
    settings: {},
    partners: [],
    assets: [],
    projectedExpenses: [],
    incomeSources: [],
    auditLogs: [],
    connectionStatus: 'CONNECTING',
    lastSync: 'Never',
    error: null,

    // User Session
    currentUser: null,
    currentRole: 'guest',

    getAssets() {
        return this.assets || [];
    },

    getPartners() {
        const rawList = (this.partners && this.partners.length > 0) ? this.partners : DEFAULT_PARTNERS;
        return rawList.filter(p => {
            if (!p || !p.name) return false;
            const lower = p.name.toLowerCase();
            const isFabricatedDefault = lower.includes("ligao") || lower.includes("tabaco");
            if (isFabricatedDefault) {
                const hasTx = (this.rawLogs || []).some(l => {
                    const lStr = (l.partnerName || l.partner || l.label || "").toLowerCase();
                    return lStr.includes(lower);
                });
                return hasTx;
            }
            return true;
        });
    },

    // Master Computed ViewModel states
    currentPeriod: 'This Month',
    cabagnanResult: null,
    irayaResult: null,
    partnerPisoWifiResult: null,
    consolidatedResult: null,
    testSuiteResults: null,

    // Callbacks list
    listeners: [],

    subscribe(callback) {
        this.listeners.push(callback);
    },

    notify() {
        this.listeners.forEach(cb => cb());
    },

    setPeriod(periodName) {
        this.currentPeriod = periodName;
        this.recomputeEngine();
    },

    logsLoaded: false,
    settingsLoaded: false,

    init() {
        console.log("[BOOT] DataService init start");
        this.connectionStatus = 'CONNECTING';

        // 1. Listen to jgs_settings/auth
        console.log("[BOOT] Settings listener attached");
        onSnapshot(settingsDocRef, (docSnap) => {
            console.log("[BOOT] Settings snapshot received");
            try {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    this.settings = data;
                    this.partners = (data.partners && data.partners.length > 0) ? data.partners : DEFAULT_PARTNERS;

                    const rawAssets = data.assets;
                    if (rawAssets && Array.isArray(rawAssets) && rawAssets.length > 0) {
                        this.assets = rawAssets.map(a => {
                            const isCoffee = a.name?.toLowerCase().includes("coffee") || a.source === "Coffee Vendo" || a.id?.includes("coffee") || a.id?.includes("metal_case");
                            if (isCoffee) {
                                return {
                                    ...a,
                                    source: "Coffee Vendo",
                                    recoveryFundingMode: "SOURCE_SELF_RECOVERY",
                                    openingRecovered: (a.openingRecovered === 19000 || typeof a.openingRecovered !== 'number') ? 0 : a.openingRecovered
                                };
                            }
                            return a;
                        }).filter(a => a.name !== "Water Container" && a.id !== "rec_iraya_network");
                    } else {
                        this.assets = [
                            { id: "rec_coffee_machine", name: "Coffee Vendo Machine", branch: "Cabagñan", source: "Coffee Vendo", cost: 20000, recoveryPercent: 0.50, recoveryFundingMode: "SOURCE_SELF_RECOVERY", priority: 1, openingRecovered: 0, paused: false, notes: "", archived: false },
                            { id: "rec_metal_case", name: "Coffee Metal Case", branch: "Cabagñan", source: "Coffee Vendo", cost: 8000, recoveryPercent: 0.50, recoveryFundingMode: "SOURCE_SELF_RECOVERY", priority: 2, openingRecovered: 0, paused: false, notes: "", archived: false }
                        ];
                    }

                    this.projectedExpenses = data.projectedExpenses || [];
                    this.incomeSources = data.incomeSources || [];
                } else {
                    this.settings = {};
                    this.partners = DEFAULT_PARTNERS;
                    this.assets = [
                        { id: "rec_coffee_machine", name: "Coffee Vendo Machine", branch: "Cabagñan", source: "Coffee Vendo", cost: 20000, recoveryPercent: 0.50, recoveryFundingMode: "SOURCE_SELF_RECOVERY", priority: 1, openingRecovered: 0, paused: false, notes: "", archived: false },
                        { id: "rec_metal_case", name: "Coffee Metal Case", branch: "Cabagñan", source: "Coffee Vendo", cost: 8000, recoveryPercent: 0.50, recoveryFundingMode: "SOURCE_SELF_RECOVERY", priority: 2, openingRecovered: 0, paused: false, notes: "", archived: false }
                    ];
                    this.projectedExpenses = [];
                    this.incomeSources = [];
                }

                this.settingsLoaded = true;
                if (this.connectionStatus === 'CONNECTING') {
                    this.connectionStatus = 'CONNECTED';
                    console.log("[BOOT] Connection status -> CONNECTED");
                }
                this.lastSync = new Date().toLocaleTimeString();
                this.recomputeEngine();
            } catch (err) {
                console.error("Settings load error:", err);
                this.connectionStatus = 'ERROR';
                this.error = err.message;
            }
            this.notify();
        }, (err) => {
            console.error("Firestore settings snapshot error:", err);
            this.partners = DEFAULT_PARTNERS;
            this.settingsLoaded = true;
            if (this.connectionStatus === 'CONNECTING') {
                this.connectionStatus = 'CONNECTED';
                console.log("[BOOT] Connection status -> CONNECTED");
            }
            this.lastSync = new Date().toLocaleTimeString();
            this.recomputeEngine();
            this.notify();
        });

        // 2. Listen to jgs_logs
        console.log("[BOOT] Logs listener attached");
        onSnapshot(logCol, (querySnapshot) => {
            console.log("[BOOT] Logs snapshot received");
            try {
                const logs = [];
                querySnapshot.forEach((doc) => {
                    logs.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                this.rawLogs = logs;
                this.logsLoaded = true;
                if (this.connectionStatus === 'CONNECTING') {
                    this.connectionStatus = 'CONNECTED';
                    console.log("[BOOT] Connection status -> CONNECTED");
                }
                this.lastSync = new Date().toLocaleTimeString();
                this.recomputeEngine();
            } catch (err) {
                console.error("Logs load error:", err);
                this.connectionStatus = 'ERROR';
                this.error = err.message;
            }
            this.notify();
        }, (err) => {
            console.error("Firestore logs snapshot error:", err);
            this.connectionStatus = 'ERROR';
            this.error = err.message || "Permission denied or failed to load jgs_logs";
            this.notify();
        });

        // 3. Listen to jgs_audit_logs (Safe listener with error suppression)
        console.log("[BOOT] Audit listener attached");
        try {
            const auditQuery = query(auditCol, orderBy("timestamp", "desc"));
            onSnapshot(auditQuery, (snap) => {
                const audits = [];
                snap.forEach(doc => audits.push({ id: doc.id, ...doc.data() }));
                this.auditLogs = audits;
                this.notify();
            }, (err) => {
                console.warn("Audit log access restricted or unavailable:", err.message);
                // Non-critical: system continues without audit log view
            });
        } catch (err) {
            console.warn("Could not initialize audit listener:", err.message);
        }

        // Restore session
        const savedUser = sessionStorage.getItem('jgb_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.currentRole = this.currentUser.role;
        }

        this.testSuiteResults = AccountingService.runVerificationTests();
    },

    recomputeEngine() {
        this.normalizedLogs = this.rawLogs.map(log => normalizeLog(log, this.partners));
        console.log("[BOOT] Normalization complete");

        const filteredLogs = AccountingService.filterLogsByPeriod(this.normalizedLogs, this.currentPeriod);

        const currentAssets = this.getAssets();
        this.cabagnanResult = AccountingService.calculateCabagnan(filteredLogs, currentAssets);
        this.irayaResult = AccountingService.calculateIraya(filteredLogs, currentAssets);
        this.partnerPisoWifiResult = AccountingService.calculatePartnerPisoWifi(filteredLogs, this.getPartners());

        this.consolidatedResult = AccountingService.calculateConsolidated(
            this.cabagnanResult,
            this.irayaResult,
            this.partnerPisoWifiResult,
            filteredLogs
        );

        console.log("[BOOT] First render complete");
        this.notify();
    },

    async login(username, password) {
        if (!this.settings) return { success: false, message: "Settings not loaded." };

        if (username.toLowerCase() === 'admin' && password === this.settings.adminPassword) {
            this.currentUser = { username: 'Admin', role: 'admin' };
            this.currentRole = 'admin';
            sessionStorage.setItem('jgb_user', JSON.stringify(this.currentUser));
            this.notify();
            return { success: true };
        }

        const foundUser = this.settings.users?.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        if (foundUser) {
            this.currentUser = { username: foundUser.username, role: foundUser.role || 'user' };
            this.currentRole = this.currentUser.role;
            sessionStorage.setItem('jgb_user', JSON.stringify(this.currentUser));
            this.notify();
            return { success: true };
        }

        return { success: false, message: "Invalid credentials." };
    },

    logout() {
        this.currentUser = null;
        this.currentRole = 'guest';
        sessionStorage.removeItem('jgb_user');
        this.notify();
    },

    getDiagnostics() {
        const totalRaw = this.rawLogs.length;
        const totalNormalized = this.normalizedLogs.length;
        const filteredLogs = AccountingService.filterLogsByPeriod(this.normalizedLogs, this.currentPeriod);
        
        const unclassifiedBranchCount = filteredLogs.filter(l => l.branch === 'Unclassified').length;
        const unclassifiedSourceCount = filteredLogs.filter(l => l.source === 'Unclassified').length;

        const incomeCount = filteredLogs.filter(l => l.type === 'income').length;
        const expenseCount = filteredLogs.filter(l => l.type === 'expense' || l.type === 'outflow').length;

        let grossSum = 0;
        let ownerRevenueSum = 0;
        let partnerRevenueSum = 0;

        filteredLogs.forEach(l => {
            if (l.type === "income") {
                grossSum += l.amount;
                ownerRevenueSum += l.amount * (l.ownerShare ?? 1.0);
                partnerRevenueSum += l.amount * (l.partnerShare ?? 0.0);
            }
        });

        const revenueConservationPass = Math.abs(grossSum - (ownerRevenueSum + partnerRevenueSum)) < 0.01;

        return {
            totalRaw,
            totalNormalized,
            difference: totalRaw - totalNormalized,
            unclassifiedBranchCount,
            unclassifiedSourceCount,
            incomeCount,
            expenseCount,
            grossSum,
            ownerRevenueSum,
            partnerRevenueSum,
            revenueConservationPass
        };
    }
};
