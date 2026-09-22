import {
    db,
    logCol,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp
} from './firebase-config.js';
import { SettingsService } from './settings-service.js';
import { DataService } from './data-service.js';

/**
 * TRANSACTION SERVICE - STAGE 4A
 * Handles ordinary income and expense entry with full V2 schema.
 */

export const TransactionService = {
    async recordIncome(data) {
        const payload = {
            schemaVersion: 2,
            type: "income",
            amount: data.amount,
            label: data.label,
            branch: data.branch,
            source: data.source,
            sourceType: data.sourceType,
            sourceId: data.sourceId,
            accountingGroup: data.accountingGroup,
            partner: data.partnerId || null,
            partnerName: data.partnerName || null,
            sharePercent: data.ownerShare, // authoritative owner share
            ownerShare: data.ownerShare,
            partnerShare: data.partnerShare,
            transactionDate: data.transactionDate,
            description: data.description || "",
            createdBy: DataService.currentUser?.username || "Unknown",
            entryOrigin: "accounting-v2",
            expenseAllocation: 0,
            savingsAllocation: 0,
            pendingBalance: 0,
            timestamp: serverTimestamp(),
            dateStr: new Date(data.transactionDate).toLocaleDateString()
        };

        const docRef = await addDoc(logCol, payload);
        await SettingsService.logAudit("income_added", "transaction", docRef.id, null, payload);
        return docRef.id;
    },

    async recordExpense(data) {
        const payload = {
            schemaVersion: 2,
            type: "expense",
            amount: data.amount,
            label: data.label,
            branch: data.branch,
            source: data.source || "Unclassified",
            sourceType: data.sourceType || "Unclassified",
            sourceId: data.sourceId || null,
            accountingGroup: data.accountingGroup,
            expenseScope: data.expenseScope,
            expenseCategory: data.expenseCategory,
            partner: data.partnerId || null,
            partnerName: data.partnerName || null,
            sharePercent: data.ownerShare,
            ownerShare: data.ownerShare,
            partnerShare: data.partnerShare,
            ownerExpenseResponsibility: data.ownerExpenseResponsibility,
            partnerExpenseResponsibility: data.partnerExpenseResponsibility,
            transactionDate: data.transactionDate,
            description: data.description || "",
            createdBy: DataService.currentUser?.username || "Unknown",
            entryOrigin: "accounting-v2",
            expenseAllocation: 0,
            savingsAllocation: 0,
            pendingBalance: data.partnerExpenseResponsibility || 0,
            timestamp: serverTimestamp(),
            dateStr: new Date(data.transactionDate).toLocaleDateString()
        };

        const docRef = await addDoc(logCol, payload);
        await SettingsService.logAudit("expense_added", "transaction", docRef.id, null, payload);
        return docRef.id;
    },

    async updateTransaction(id, updatedData) {
        const before = updatedData.raw;
        const docRef = doc(db, "jgs_logs", id);

        const payload = { ...updatedData };
        delete payload.id;
        delete payload.raw;
        delete payload.classificationConfidence;
        delete payload.classificationNotes;

        if (payload.ownerShare !== undefined) {
            payload.sharePercent = payload.ownerShare;
            payload.partnerShare = 1 - payload.ownerShare;
        }
        
        await updateDoc(docRef, {
            ...payload,
            lastUpdated: serverTimestamp()
        });

        await SettingsService.logAudit("transaction_edit", "transaction", id, before, payload);
    }
};
