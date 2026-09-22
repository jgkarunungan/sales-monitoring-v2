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

    // Master Computed ViewModel states
    currentPeriod: 'All Time', // Reverted to All Time to ensure data is visible immediately
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

    init() {
        // 1. Listen to jgs_settings/auth
        onSnapshot(settingsDocRef, (docSnap) => {
            try {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    this.settings = data;
                    this.partners = data.partners || [];
                    this.assets = data.assets || [];
                    this.projectedExpenses = data.projectedExpenses || [];
                    this.incomeSources = data.incomeSources || [];

                    if (this.connectionStatus === 'CONNECTING') this.connectionStatus = 'CONNECTED';
                    this.lastSync = new Date().toLocaleTimeString();
                    this.recomputeEngine();
                }
            } catch (err) {
                console.error("Settings load error:", err);
                this.connectionStatus = 'ERROR';
                this.error = err.message;
            }
            this.notify();
        }, (err) => {
            console.error("Firestore settings snapshot error:", err);
            this.connectionStatus = 'ERROR';
            this.error = err.message;
            this.notify();
        });

        // 2. Listen to jgs_logs
        onSnapshot(logCol, (querySnapshot) => {
            try {
                const logs = [];
                querySnapshot.forEach((doc) => {
                    logs.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                this.rawLogs = logs;
                this.recomputeEngine();

                if (this.connectionStatus === 'CONNECTING') this.connectionStatus = 'CONNECTED';
                this.lastSync = new Date().toLocaleTimeString();
            } catch (err) {
                console.error("Logs load error:", err);
                this.connectionStatus = 'ERROR';
            }
            this.notify();
        }, (err) => {
            console.error("Firestore logs snapshot error:", err);
            this.connectionStatus = 'ERROR';
            this.notify();
        });

        // 3. Listen to jgs_audit_logs (Safe listener with error suppression)
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
        if (this.rawLogs.length === 0) return;

        this.normalizedLogs = this.rawLogs.map(log => normalizeLog(log, this.partners));
        const filteredLogs = AccountingService.filterLogsByPeriod(this.normalizedLogs, this.currentPeriod);

        this.cabagnanResult = AccountingService.calculateCabagnan(filteredLogs, this.assets);
        this.irayaResult = AccountingService.calculateIraya(filteredLogs, this.assets);
        this.partnerPisoWifiResult = AccountingService.calculatePartnerPisoWifi(filteredLogs, this.partners);

        this.consolidatedResult = AccountingService.calculateConsolidated(
            this.cabagnanResult,
            this.irayaResult,
            this.partnerPisoWifiResult,
            filteredLogs
        );

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
