import {
    db,
    settingsDocRef,
    auditCol,
    addDoc,
    updateDoc,
    setDoc,
    serverTimestamp
} from './firebase-config.js';
import { DataService } from './data-service.js';

export const SettingsService = {
    async logAudit(action, entityType, entityId, before, after, note = "") {
        try {
            await addDoc(auditCol, {
                action,
                entityType,
                entityId,
                actor: DataService.currentUser?.username || "System",
                timestamp: serverTimestamp(),
                before: before ? JSON.parse(JSON.stringify(before)) : null,
                after: after ? JSON.parse(JSON.stringify(after)) : null,
                note
            });
        } catch (err) {
            console.error("Audit log error:", err);
        }
    },

    // --- PARTNER MANAGEMENT ---
    async addPartner(partner) {
        const currentPartners = [...(DataService.partners || [])];
        const newPartner = {
            ...partner,
            status: 'Active',
            createdAt: Date.now()
        };
        currentPartners.push(newPartner);
        await updateDoc(settingsDocRef, { partners: currentPartners });
        await this.logAudit("partner_added", "partner", newPartner.name, null, newPartner);
    },

    async updatePartner(index, updatedPartner) {
        const currentPartners = [...(DataService.partners || [])];
        const before = currentPartners[index];
        currentPartners[index] = { ...before, ...updatedPartner };
        await updateDoc(settingsDocRef, { partners: currentPartners });
        await this.logAudit("partner_edited", "partner", updatedPartner.name, before, updatedPartner);
    },

    async deletePartner(index) {
        const currentPartners = [...(DataService.partners || [])];
        const before = currentPartners[index];
        currentPartners.splice(index, 1);
        await updateDoc(settingsDocRef, { partners: currentPartners });
        await this.logAudit("partner_removed", "partner", before.name, before, null);
    },

    // --- UPCOMING BILLS MANAGEMENT ---
    async addUpcomingBill(bill) {
        const currentBills = [...(DataService.projectedExpenses || [])];
        const newBill = {
            ...bill,
            id: Date.now().toString()
        };
        currentBills.push(newBill);
        await updateDoc(settingsDocRef, { projectedExpenses: currentBills });
        await this.logAudit("upcoming_bill_added", "upcoming_bill", newBill.name, null, newBill);
    },

    async updateUpcomingBill(id, updatedBill) {
        const currentBills = [...(DataService.projectedExpenses || [])];
        const index = currentBills.findIndex(b => b.id === id);
        if (index === -1) return;
        const before = currentBills[index];
        currentBills[index] = { ...before, ...updatedBill };
        await updateDoc(settingsDocRef, { projectedExpenses: currentBills });
        await this.logAudit("upcoming_bill_edited", "upcoming_bill", updatedBill.name, before, updatedBill);
    },

    async deleteUpcomingBill(id) {
        const currentBills = [...(DataService.projectedExpenses || [])];
        const index = currentBills.findIndex(b => b.id === id);
        if (index === -1) return;
        const before = currentBills[index];
        currentBills.splice(index, 1);
        await updateDoc(settingsDocRef, { projectedExpenses: currentBills });
        await this.logAudit("upcoming_bill_deleted", "upcoming_bill", before.name, before, null);
    },

    // --- USER MANAGEMENT ---
    async addUser(user) {
        const currentUsers = [...(DataService.settings?.users || [])];
        const newUser = {
            username: user.username,
            password: user.password,
            role: user.role || 'user',
            status: 'Active'
        };
        currentUsers.push(newUser);
        await updateDoc(settingsDocRef, { users: currentUsers });
        // Sanitize for audit
        const auditAfter = { ...newUser };
        delete auditAfter.password;
        await this.logAudit("user_added", "user", newUser.username, null, auditAfter);
    },

    async updatePassword(username, newPassword) {
        const currentUsers = [...(DataService.settings?.users || [])];
        const index = currentUsers.findIndex(u => u.username === username);
        if (index === -1) return;
        currentUsers[index].password = newPassword;
        await updateDoc(settingsDocRef, { users: currentUsers });
        await this.logAudit("user_password_changed", "user", username, null, null);
    },

    async removeUser(username) {
        const currentUsers = [...(DataService.settings?.users || [])];
        const index = currentUsers.findIndex(u => u.username === username);
        if (index === -1) return;
        const before = currentUsers[index];
        currentUsers.splice(index, 1);
        await updateDoc(settingsDocRef, { users: currentUsers });
        const auditBefore = { ...before };
        delete auditBefore.password;
        await this.logAudit("user_removed", "user", username, auditBefore, null);
    },

    // --- INCOME SOURCE MANAGEMENT ---
    async addIncomeSource(source) {
        const currentSources = [...(DataService.settings?.incomeSources || [])];
        const newSource = {
            ...source,
            id: 'src-' + Date.now(),
            createdAt: Date.now(),
            active: true
        };
        currentSources.push(newSource);
        await updateDoc(settingsDocRef, { incomeSources: currentSources });
        await this.logAudit("income_source_added", "income_source", newSource.name, null, newSource);
    },

    async updateIncomeSource(id, updatedSource) {
        const currentSources = [...(DataService.settings?.incomeSources || [])];
        const index = currentSources.findIndex(s => s.id === id);
        if (index === -1) return;
        const before = currentSources[index];
        currentSources[index] = { ...before, ...updatedSource };
        await updateDoc(settingsDocRef, { incomeSources: currentSources });
        await this.logAudit("income_source_edited", "income_source", updatedSource.name, before, updatedSource);
    },

    async deactivateIncomeSource(id) {
        await this.updateIncomeSource(id, { active: false });
        await this.logAudit("income_source_deactivated", "income_source", id, null, null);
    }
};
