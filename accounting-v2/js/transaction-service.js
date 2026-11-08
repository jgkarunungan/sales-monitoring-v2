import {
    db,
    logCol,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
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
    async checkBackdatedTransactionPolicy(txDate) {
        if (!txDate || typeof txDate !== 'string') return;

        const match = txDate.match(/^(\d{4})[-/](\d{1,2})/);
        if (!match) return;

        const y = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const txPeriodKey = `${y}-${String(m).padStart(2, '0')}`;

        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        if (txPeriodKey < currentMonthKey) {
            const hasLockedLedger = (DataService.recoveryLedger || []).some(entry => entry && entry.periodKey === txPeriodKey);
            if (hasLockedLedger) {
                await SettingsService.flagRecoveryPeriodForRecalculation(txPeriodKey);
            }
        }
    },

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
            dateStr: data.transactionDate
        };

        const docRef = await addDoc(logCol, payload);
        await SettingsService.logAudit("income_added", "transaction", docRef.id, null, payload);
        await this.checkBackdatedTransactionPolicy(data.transactionDate);
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
            dateStr: data.transactionDate
        };

        const docRef = await addDoc(logCol, payload);
        await SettingsService.logAudit("expense_added", "transaction", docRef.id, null, payload);
        await this.checkBackdatedTransactionPolicy(data.transactionDate);
        return docRef.id;
    },

    async updateTransaction(id, updatedData, reason = "") {
        if (!id) throw new Error("Transaction ID is required for edit.");

        const docRef = doc(db, "jgs_logs", id);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
            throw new Error("Transaction not found in database.");
        }

        const previousData = snapshot.data();
        const adminUser = DataService.currentUser?.username || "Admin";

        const payload = { ...updatedData };
        delete payload.id;
        delete payload.raw;
        delete payload.classificationConfidence;
        delete payload.classificationNotes;
        delete payload.isAmbiguousDate;
        delete payload.timestamp;
        delete payload.date;

        if (payload.ownerShare !== undefined && payload.ownerShare !== null) {
            payload.sharePercent = payload.ownerShare;
            payload.partnerShare = 1.0 - payload.ownerShare;
        }

        payload.updatedBy = adminUser;
        payload.updatedAt = serverTimestamp();
        payload.lastUpdated = serverTimestamp();

        if (reason && reason.trim()) {
            payload.editReason = reason.trim();
        }

        await updateDoc(docRef, payload);

        await SettingsService.logAudit("transaction_edited", "transaction", id, previousData, payload, reason ? `Edited transaction ${id}: ${reason}` : `Edited transaction ${id}`);

        const prevDate = previousData.transactionDate || previousData.dateStr || previousData.date;
        if (prevDate) {
            await this.checkBackdatedTransactionPolicy(prevDate);
        }
        if (payload.transactionDate && payload.transactionDate !== prevDate) {
            await this.checkBackdatedTransactionPolicy(payload.transactionDate);
        }

        return true;
    },

    async voidTransaction(id, reason = "") {
        if (!id) throw new Error("Transaction ID is required for retraction.");
        if (!reason || !reason.trim()) throw new Error("Retraction reason is required.");

        const docRef = doc(db, "jgs_logs", id);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
            throw new Error("Transaction not found in database.");
        }

        const previousData = snapshot.data();
        if (previousData.status === "VOIDED" || previousData.isVoided) {
            throw new Error("Transaction is already voided.");
        }

        const adminUser = DataService.currentUser?.username || "Admin";
        const voidPayload = {
            status: "VOIDED",
            isVoided: true,
            voidedAt: serverTimestamp(),
            voidedBy: adminUser,
            voidReason: reason.trim(),
            lastUpdated: serverTimestamp()
        };

        await updateDoc(docRef, voidPayload);

        await SettingsService.logAudit("transaction_voided", "transaction", id, previousData, {
            ...previousData,
            ...voidPayload
        }, `Voided transaction ${id}: ${reason.trim()}`);

        const txDate = previousData.transactionDate || previousData.dateStr || previousData.date;
        if (txDate) {
            await this.checkBackdatedTransactionPolicy(txDate);
        }

        return true;
    },

    async deleteTransaction(id) {
        const docRef = doc(db, "jgs_logs", id);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
            return { exists: false };
        }
        const data = snapshot.data();
        await deleteDoc(docRef);
        await SettingsService.logAudit("transaction_deleted", "transaction", id, data, null, "Owner-approved removal of unknown legacy transaction");
        return { exists: true, data };
    }
};
