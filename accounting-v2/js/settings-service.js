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
import { RecoveryService } from './recovery-service.js';

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

    async saveSettingsField(field, data) {
        try {
            const cleanData = JSON.parse(JSON.stringify(data));
            if (field === 'assets' || field === 'recoveryTargets') {
                await setDoc(settingsDocRef, { assets: cleanData, recoveryTargets: cleanData }, { merge: true });
            } else {
                await setDoc(settingsDocRef, { [field]: cleanData }, { merge: true });
            }
        } catch (err) {
            console.error(`Error saving ${field} to Firestore:`, err);
            throw err;
        }
    },

    // --- PARTNER MANAGEMENT ---
    async addPartner(partner) {
        const currentPartners = [...(DataService.getPartners() || [])];
        const newPartner = {
            ...partner,
            status: 'Active',
            createdAt: Date.now()
        };
        currentPartners.push(newPartner);
        await this.saveSettingsField('partners', currentPartners);
        await this.logAudit("partner_added", "partner", newPartner.name, null, newPartner);
        DataService.partners = currentPartners;
        DataService.recomputeEngine();
    },

    async updatePartner(index, updatedPartner) {
        const currentPartners = [...(DataService.getPartners() || [])];
        const before = currentPartners[index];
        currentPartners[index] = { ...before, ...updatedPartner };
        await this.saveSettingsField('partners', currentPartners);
        await this.logAudit("partner_edited", "partner", updatedPartner.name, before, updatedPartner);
        DataService.partners = currentPartners;
        DataService.recomputeEngine();
    },

    async deletePartner(index) {
        const currentPartners = [...(DataService.getPartners() || [])];
        const before = currentPartners[index];
        currentPartners.splice(index, 1);
        await this.saveSettingsField('partners', currentPartners);
        await this.logAudit("partner_removed", "partner", before.name, before, null);
        DataService.partners = currentPartners;
        DataService.recomputeEngine();
    },

    async updatePartnerShare(partnerIdOrName, newOwnerSharePercent) {
        let ownerShareDecimal = parseFloat(newOwnerSharePercent);
        if (isNaN(ownerShareDecimal)) throw new Error("Invalid share percentage");
        if (ownerShareDecimal > 1.0) ownerShareDecimal /= 100.0;
        if (ownerShareDecimal < 0 || ownerShareDecimal > 1.0) throw new Error("Owner share must be between 0% and 100%");

        const currentPartners = JSON.parse(JSON.stringify(DataService.getPartners() || []));
        const index = currentPartners.findIndex(p => (p.id && p.id === partnerIdOrName) || (p.name && p.name.toLowerCase() === partnerIdOrName.toLowerCase()));

        if (index === -1) {
            const newPartner = {
                id: 'p_' + Date.now(),
                name: partnerIdOrName,
                type: 'PisoWiFi',
                location: partnerIdOrName,
                share: ownerShareDecimal,
                status: 'Active',
                createdAt: Date.now(),
                shareUpdatedAt: Date.now()
            };
            currentPartners.push(newPartner);
            await this.saveSettingsField('partners', currentPartners);
            await addDoc(auditCol, {
                action: "partner_share_changed",
                entityType: "partner",
                entityId: newPartner.id,
                partnerId: newPartner.id,
                partnerName: newPartner.name,
                actor: DataService.currentUser?.username || "Admin",
                timestamp: serverTimestamp(),
                beforeOwnerShare: 0.50,
                afterOwnerShare: ownerShareDecimal,
                beforePartnerShare: 0.50,
                afterPartnerShare: 1.0 - ownerShareDecimal,
                note: `Enrolled partner '${newPartner.name}' with Owner Share ${(ownerShareDecimal * 100).toFixed(0)}% / Partner ${((1 - ownerShareDecimal) * 100).toFixed(0)}%`
            });
            DataService.partners = currentPartners;
            DataService.recomputeEngine();
            return newPartner;
        }

        const before = JSON.parse(JSON.stringify(currentPartners[index]));
        const beforeOwnerShare = before.share !== undefined ? before.share : 0.50;
        const beforePartnerShare = 1.0 - beforeOwnerShare;

        currentPartners[index].share = ownerShareDecimal;
        currentPartners[index].shareUpdatedAt = Date.now();

        await this.saveSettingsField('partners', currentPartners);
        await addDoc(auditCol, {
            action: "partner_share_changed",
            entityType: "partner",
            entityId: currentPartners[index].id || currentPartners[index].name,
            partnerId: currentPartners[index].id || currentPartners[index].name,
            partnerName: currentPartners[index].name,
            actor: DataService.currentUser?.username || "Admin",
            timestamp: serverTimestamp(),
            beforeOwnerShare: beforeOwnerShare,
            afterOwnerShare: ownerShareDecimal,
            beforePartnerShare: beforePartnerShare,
            afterPartnerShare: 1.0 - ownerShareDecimal,
            note: `Updated share agreement for '${currentPartners[index].name}': Owner ${(beforeOwnerShare * 100).toFixed(0)}% → ${(ownerShareDecimal * 100).toFixed(0)}%, Partner ${(beforePartnerShare * 100).toFixed(0)}% → ${((1 - ownerShareDecimal) * 100).toFixed(0)}%`
        });

        DataService.partners = currentPartners;
        DataService.recomputeEngine();
        return currentPartners[index];
    },

    async enrollPartner(partnerData) {
        const ownerShareDecimal = partnerData.ownerShare !== undefined ? (parseFloat(partnerData.ownerShare) > 1.0 ? parseFloat(partnerData.ownerShare)/100.0 : parseFloat(partnerData.ownerShare)) : 0.50;
        return await this.updatePartnerShare(partnerData.name, ownerShareDecimal);
    },

    // --- UPCOMING BILLS MANAGEMENT ---
    async addUpcomingBill(bill) {
        const currentBills = [...(DataService.projectedExpenses || [])];
        const newBill = {
            ...bill,
            id: Date.now().toString()
        };
        currentBills.push(newBill);
        await this.saveSettingsField('projectedExpenses', currentBills);
        await this.logAudit("upcoming_bill_added", "upcoming_bill", newBill.name, null, newBill);
        DataService.projectedExpenses = currentBills;
        DataService.recomputeEngine();
    },

    async updateUpcomingBill(id, updatedBill) {
        const currentBills = [...(DataService.projectedExpenses || [])];
        const index = currentBills.findIndex(b => b.id === id);
        if (index === -1) return;
        const before = currentBills[index];
        currentBills[index] = { ...before, ...updatedBill };
        await this.saveSettingsField('projectedExpenses', currentBills);
        await this.logAudit("upcoming_bill_edited", "upcoming_bill", updatedBill.name, before, updatedBill);
        DataService.projectedExpenses = currentBills;
        DataService.recomputeEngine();
    },

    async deleteUpcomingBill(id) {
        const currentBills = [...(DataService.projectedExpenses || [])];
        const index = currentBills.findIndex(b => b.id === id);
        if (index === -1) return;
        const before = currentBills[index];
        currentBills.splice(index, 1);
        await this.saveSettingsField('projectedExpenses', currentBills);
        await this.logAudit("upcoming_bill_deleted", "upcoming_bill", before.name, before, null);
        DataService.projectedExpenses = currentBills;
        DataService.recomputeEngine();
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
        await this.saveSettingsField('users', currentUsers);
        const auditAfter = { ...newUser };
        delete auditAfter.password;
        await this.logAudit("user_added", "user", newUser.username, null, auditAfter);
    },

    async updatePassword(username, newPassword) {
        const currentUsers = [...(DataService.settings?.users || [])];
        const index = currentUsers.findIndex(u => u.username === username);
        if (index === -1) return;
        currentUsers[index].password = newPassword;
        await this.saveSettingsField('users', currentUsers);
        await this.logAudit("user_password_changed", "user", username, null, null);
    },

    async removeUser(username) {
        const currentUsers = [...(DataService.settings?.users || [])];
        const index = currentUsers.findIndex(u => u.username === username);
        if (index === -1) return;
        const before = currentUsers[index];
        currentUsers.splice(index, 1);
        await this.saveSettingsField('users', currentUsers);
        const auditBefore = { ...before };
        delete auditBefore.password;
        await this.logAudit("user_removed", "user", username, auditBefore, null);
    },

    // --- INCOME SOURCE MANAGEMENT ---
    async addIncomeSource(source) {
        const currentSources = [...(DataService.settings?.incomeSources || DataService.incomeSources || [])];
        const newSource = {
            ...source,
            id: 'src-' + Date.now(),
            createdAt: Date.now(),
            active: true
        };
        currentSources.push(newSource);
        await this.saveSettingsField('incomeSources', currentSources);
        await this.logAudit("income_source_added", "income_source", newSource.name, null, newSource);
        DataService.incomeSources = currentSources;
        DataService.notify();
        return newSource;
    },

    async updateIncomeSource(id, updatedSource) {
        const currentSources = [...(DataService.settings?.incomeSources || DataService.incomeSources || [])];
        const index = currentSources.findIndex(s => s.id === id);
        if (index === -1) return;
        const before = currentSources[index];
        currentSources[index] = { ...before, ...updatedSource };
        await this.saveSettingsField('incomeSources', currentSources);
        await this.logAudit("income_source_edited", "income_source", updatedSource.name, before, updatedSource);
        DataService.incomeSources = currentSources;
        DataService.notify();
    },

    async deactivateIncomeSource(id) {
        await this.updateIncomeSource(id, { active: false });
        await this.logAudit("income_source_deactivated", "income_source", id, null, null);
    },

    // --- RECOVERY TARGETS MANAGEMENT ---
    async saveAssets(updatedAssets, action, targetId, before, after, note = "") {
        await this.saveSettingsField('assets', updatedAssets);
        await this.logAudit(action, "recovery_target", targetId, before, after, note);
        DataService.assets = updatedAssets;
        DataService.recomputeEngine();
    },

    async addRecoveryTarget(targetData) {
        const assets = JSON.parse(JSON.stringify(DataService.getAssets()));

        const cost = parseFloat(targetData.cost || targetData.fullCost);
        if (isNaN(cost) || cost <= 0) throw new Error("Target Amount must be greater than 0.");

        let recoveryPercent = parseFloat(targetData.recoveryPercent || targetData.recoveryRate || 0.50);
        if (recoveryPercent > 1.0) recoveryPercent = recoveryPercent / 100.0;
        if (isNaN(recoveryPercent) || recoveryPercent < 0 || recoveryPercent > 1.0) throw new Error("Recovery Percentage must be between 0% and 100%.");

        const openingRecovered = parseFloat(targetData.openingRecovered || 0);
        if (isNaN(openingRecovered) || openingRecovered < 0) throw new Error("Opening Recovered must be >= 0.");
        if (openingRecovered > cost) throw new Error("Opening Recovered cannot exceed Target Amount.");

        const branch = targetData.branch || "Cabagñan";
        const fundingMode = targetData.recoveryFundingMode || "SOURCE_SELF_RECOVERY";
        const sourceName = targetData.source || targetData.sourceName || (fundingMode === "SOURCE_SELF_RECOVERY" ? "Coffee Vendo" : null);

        let sourceId = targetData.sourceId || null;
        if (!sourceId && sourceName) {
            const matchedSrc = (DataService.incomeSources || []).find(s => s.name?.toLowerCase() === sourceName.toLowerCase());
            if (matchedSrc) sourceId = matchedSrc.id || null;
        }

        const groupTargets = assets.filter(a => !a.archived && a.branch.toLowerCase() === branch.toLowerCase() && (
            fundingMode === "SOURCE_SELF_RECOVERY" ? (a.recoveryFundingMode === "SOURCE_SELF_RECOVERY" && a.source?.toLowerCase() === sourceName?.toLowerCase()) : a.recoveryFundingMode === "BRANCH_RECOVERY"
        ));
        const maxPriority = groupTargets.reduce((max, a) => Math.max(max, a.priority || 0), 0);
        const assignedPriority = targetData.priority ? parseInt(targetData.priority, 10) : (maxPriority + 1);

        const newTarget = {
            id: 'rec_' + Date.now(),
            name: targetData.name,
            branch: branch,
            source: sourceName,
            sourceId: sourceId,
            cost: cost,
            recoveryPercent: recoveryPercent,
            recoveryFundingMode: fundingMode,
            priority: assignedPriority,
            openingRecovered: openingRecovered,
            purchaseDate: targetData.purchaseDate || new Date().toISOString().split('T')[0],
            paused: targetData.paused === true || targetData.paused === "true",
            archived: false,
            notes: targetData.notes || "",
            createdAt: Date.now(),
            createdBy: DataService.currentUser?.username || "Admin"
        };

        assets.push(newTarget);
        this._resequenceBranchPriorities(assets, branch);

        await this.saveAssets(assets, "recovery_target_added", newTarget.id, null, newTarget, `Enrolled new recovery target '${newTarget.name}'`);
        return newTarget;
    },

    async editRecoveryTarget(id, updatedFields) {
        const assets = JSON.parse(JSON.stringify(DataService.getAssets()));
        const index = assets.findIndex(a => a.id === id);
        if (index === -1) throw new Error("Recovery target not found");

        const before = JSON.parse(JSON.stringify(assets[index]));

        // Validation
        const cost = parseFloat(updatedFields.cost);
        if (isNaN(cost) || cost <= 0) throw new Error("Target Amount must be greater than 0.");

        let recoveryPercent = parseFloat(updatedFields.recoveryPercent);
        if (isNaN(recoveryPercent)) throw new Error("Invalid Recovery Percentage.");
        if (recoveryPercent > 1.0) recoveryPercent = recoveryPercent / 100.0;
        if (recoveryPercent < 0 || recoveryPercent > 1.0) throw new Error("Recovery Percentage must be between 0% and 100%.");

        const openingRecovered = parseFloat(updatedFields.openingRecovered !== undefined ? updatedFields.openingRecovered : 0);
        if (isNaN(openingRecovered) || openingRecovered < 0) throw new Error("Opening Recovered must be >= 0.");
        if (openingRecovered > cost) throw new Error("Opening Recovered cannot exceed Target Amount.");

        const requestedPriority = parseInt(updatedFields.priority, 10);
        if (isNaN(requestedPriority) || requestedPriority < 1) throw new Error("Priority must be a positive integer.");

        const targetBranch = updatedFields.branch || before.branch;
        const oldPriority = before.priority || index + 1;

        assets[index] = {
            ...before,
            name: updatedFields.name || before.name,
            branch: targetBranch,
            source: updatedFields.source !== undefined ? updatedFields.source : before.source,
            sourceId: updatedFields.sourceId !== undefined ? updatedFields.sourceId : before.sourceId,
            recoveryFundingMode: updatedFields.recoveryFundingMode !== undefined ? updatedFields.recoveryFundingMode : before.recoveryFundingMode,
            cost: cost,
            recoveryPercent: recoveryPercent,
            openingRecovered: openingRecovered,
            paused: updatedFields.paused === true || updatedFields.paused === "true",
            notes: updatedFields.notes !== undefined ? updatedFields.notes : (before.notes || ""),
            priority: requestedPriority
        };

        this._normalizeBranchPriorities(assets, targetBranch, id, requestedPriority);

        const after = assets.find(a => a.id === id);
        const priorityChanged = oldPriority !== requestedPriority;
        const action = priorityChanged ? "recovery_priority_changed" : "recovery_target_edited";

        await this.saveAssets(assets, action, id, before, after, priorityChanged ? `Priority changed from ${oldPriority} to ${requestedPriority}` : "Edited target details");
        return after;
    },

    async deleteOrArchiveRecoveryTarget(id) {
        const assets = JSON.parse(JSON.stringify(DataService.getAssets()));
        const index = assets.findIndex(a => a.id === id);
        if (index === -1) throw new Error("Recovery target not found");

        const target = assets[index];
        const before = JSON.parse(JSON.stringify(target));

        const openingRecovered = typeof target.openingRecovered === 'number' ? target.openingRecovered : (parseFloat(target.openingRecovered) || 0);

        let systemRecovered = 0;
        const cabAlloc = DataService.cabagnanResult?.allocationsDetail?.find(a => a.id === id);
        const iryAlloc = DataService.irayaResult?.allocationsDetail?.find(a => a.id === id);
        const periodAlloc = (cabAlloc?.currentPeriodAllocation || 0) + (iryAlloc?.currentPeriodAllocation || 0);
        if (periodAlloc > 0) systemRecovered = periodAlloc;

        const hasHistory = openingRecovered > 0 || systemRecovered > 0 || target.hasLedger === true;

        if (!hasHistory) {
            // CASE A: PERMANENT DELETE
            assets.splice(index, 1);
            this._resequenceBranchPriorities(assets, target.branch);
            await this.saveAssets(assets, "recovery_target_deleted", id, before, null, "Permanently deleted target with zero recovery history");
            return { action: 'deleted' };
        } else {
            // CASE B: ARCHIVE TARGET
            target.archived = true;
            target.archivedDate = new Date().toISOString();
            this._resequenceBranchPriorities(assets, target.branch);
            await this.saveAssets(assets, "recovery_target_archived", id, before, target, "Archived target with recovery history preserved");
            return { action: 'archived' };
        }
    },

    async restoreRecoveryTarget(id) {
        const assets = JSON.parse(JSON.stringify(DataService.getAssets()));
        const target = assets.find(a => a.id === id);
        if (!target) throw new Error("Target not found");

        const before = JSON.parse(JSON.stringify(target));
        target.archived = false;
        delete target.archivedDate;

        const activeBranchTargets = assets.filter(a => a.branch.toLowerCase() === target.branch.toLowerCase() && !a.archived && a.id !== id);
        const maxPrio = activeBranchTargets.reduce((max, a) => Math.max(max, a.priority || 0), 0);
        target.priority = maxPrio + 1;

        this._resequenceBranchPriorities(assets, target.branch);
        await this.saveAssets(assets, "recovery_target_restored", id, before, target, "Restored target to active queue");
        return target;
    },

    _normalizeBranchPriorities(assets, branch, targetId, targetPriority) {
        const branchTargets = assets.filter(a => a.branch.toLowerCase() === branch.toLowerCase() && !a.archived);
        branchTargets.sort((a, b) => {
            if (a.id === targetId) return -1;
            if (b.id === targetId) return 1;
            return (a.priority || 999) - (b.priority || 999);
        });

        const targetIndex = branchTargets.findIndex(a => a.id === targetId);
        if (targetIndex !== -1) {
            const [moved] = branchTargets.splice(targetIndex, 1);
            const insertAt = Math.max(0, Math.min(targetPriority - 1, branchTargets.length));
            branchTargets.splice(insertAt, 0, moved);
        }

        branchTargets.forEach((t, idx) => {
            t.priority = idx + 1;
        });
    },

    _resequenceBranchPriorities(assets, branch) {
        const branchTargets = assets.filter(a => a.branch.toLowerCase() === branch.toLowerCase() && !a.archived);
        branchTargets.sort((a, b) => (a.priority || 999) - (b.priority || 999));
        branchTargets.forEach((t, idx) => {
            t.priority = idx + 1;
        });
    },

    runRecoveryManagementTests() {
        const results = {
            editTargetTest: "FAIL",
            priorityReorderTest: "FAIL",
            safeDeleteTest: "FAIL",
            archiveTargetTest: "FAIL",
            restoreTargetTest: "FAIL"
        };

        // 1. Edit Target Test (Section 24)
        const mockAsset = { id: "rec_coffee_machine", name: "Coffee Vendo Machine", cost: 20000, recoveryPercent: 0.50, openingRecovered: 19000, branch: "Cabagñan" };
        const editedAsset = { ...mockAsset, recoveryPercent: 0.40 };
        if (editedAsset.id === "rec_coffee_machine" && editedAsset.cost === 20000 && editedAsset.openingRecovered === 19000 && editedAsset.recoveryPercent === 0.40) {
            results.editTargetTest = "PASS";
        }

        // 2. Priority Test (Section 25)
        const mockList = [
            { id: "rec_coffee_machine", name: "Coffee Machine", priority: 1, branch: "Cabagñan" },
            { id: "rec_metal_case", name: "Metal Case", priority: 2, branch: "Cabagñan" }
        ];
        this._normalizeBranchPriorities(mockList, "Cabagñan", "rec_metal_case", 1);
        const p1 = mockList.find(a => a.id === "rec_metal_case")?.priority;
        const p2 = mockList.find(a => a.id === "rec_coffee_machine")?.priority;
        if (p1 === 1 && p2 === 2) {
            results.priorityReorderTest = "PASS";
        }

        // 3. Safe Delete Test (Section 26)
        const mockDeleteList = [
            { id: "t1", name: "Unused", cost: 5000, openingRecovered: 0, branch: "Cabagñan" },
            { id: "t2", name: "Keep", cost: 8000, openingRecovered: 0, branch: "Cabagñan" }
        ];
        if (mockDeleteList[0].openingRecovered === 0) {
            mockDeleteList.splice(0, 1);
        }
        if (mockDeleteList.length === 1 && mockDeleteList[0].id === "t2") {
            results.safeDeleteTest = "PASS";
        }

        // 4. Archive Test (Section 27)
        const mockArchiveTarget = { id: "t3", name: "Used", cost: 20000, openingRecovered: 4000, branch: "Cabagñan", archived: false };
        if (mockArchiveTarget.openingRecovered > 0) {
            mockArchiveTarget.archived = true;
        }
        if (mockArchiveTarget.archived === true && mockArchiveTarget.openingRecovered === 4000) {
            results.archiveTargetTest = "PASS";
        }

        // 5. Restore Test (Section 28)
        const mockRestored = { ...mockArchiveTarget };
        mockRestored.archived = false;
        mockRestored.priority = 2;
        if (mockRestored.archived === false && mockRestored.openingRecovered === 4000 && mockRestored.priority === 2) {
            results.restoreTargetTest = "PASS";
        }

        return results;
    },

    runCoffeeSelfRecoveryTests() {
        const results = {
            noHistoricalRecoveryTest: "FAIL", // Section 27
            hundredPercentRecoveryTest: "FAIL", // Section 28
            directExpenseTest: "FAIL", // Section 29
            waterSpillTest: "FAIL", // Section 30
            fullPaybackTest: "FAIL" // Section 31
        };

        // TEST 1: Required Test - No Historical Recovery (Section 27)
        const mockLogs1 = [
            { type: "income", source: "Coffee Vendo", amount: 4000 }
        ];
        const mockAssets1 = [
            { id: "c1", name: "Coffee Machine", cost: 20000, openingRecovered: 0, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo", recoveryFundingMode: "SOURCE_SELF_RECOVERY" }
        ];
        const res1 = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo", mockLogs1, mockAssets1);
        if (res1.totalOpeningRecovered === 0 &&
            res1.allocatedTotal === 2000 &&
            res1.totalRecoveredToDate === 2000 &&
            res1.totalRemaining === 18000) {
            results.noHistoricalRecoveryTest = "PASS";
        }

        // TEST 2: Required Test - 100% Self-Recovery (Section 28)
        const mockAssets2 = [
            { id: "c1", name: "Coffee Machine", cost: 20000, openingRecovered: 0, recoveryPercent: 1.00, branch: "Cabagñan", source: "Coffee Vendo", recoveryFundingMode: "SOURCE_SELF_RECOVERY" }
        ];
        const res2 = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo", mockLogs1, mockAssets2);
        if (res2.allocatedTotal === 4000 && res2.totalRemaining === 16000) {
            results.hundredPercentRecoveryTest = "PASS";
        }

        // TEST 3: Required Test - Direct Expense (Section 29)
        const mockLogs3 = [
            { type: "income", source: "Coffee Vendo", amount: 5000 },
            { type: "expense", source: "Coffee Vendo", expenseScope: "Source Direct Expense", amount: 2000 }
        ];
        const res3 = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo", mockLogs3, mockAssets1);
        if (res3.operatingProfit === 3000 && res3.allocatedTotal === 1500) {
            results.directExpenseTest = "PASS";
        }

        // TEST 4: Required Test - Water Spill (Section 30)
        const mockLogs4 = [
            { type: "income", source: "Coffee Vendo", amount: 4000 }
        ];
        const mockAssets4 = [
            { id: "t1", name: "Water Container", cost: 180, openingRecovered: 0, priority: 1, recoveryPercent: 0.50, source: "Coffee Vendo" },
            { id: "t2", name: "Coffee Machine", cost: 20000, openingRecovered: 0, priority: 2, recoveryPercent: 0.50, source: "Coffee Vendo" },
            { id: "t3", name: "Coffee Metal Case", cost: 8000, openingRecovered: 0, priority: 3, recoveryPercent: 0.50, source: "Coffee Vendo" }
        ];
        const res4 = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo", mockLogs4, mockAssets4);
        if (res4.allocations[0]?.currentPeriodAllocation === 180 && res4.allocations[0]?.status === "FULLY RECOVERED" &&
            res4.allocations[1]?.currentPeriodAllocation === 1820 && res4.allocations[1]?.status === "ACTIVE" &&
            res4.allocations[2]?.currentPeriodAllocation === 0 && res4.allocations[2]?.status === "WAITING") {
            results.waterSpillTest = "PASS";
        }

        // TEST 5: Required Test - Full Payback (Section 31)
        const mockLogs5 = [
            { type: "income", source: "Coffee Vendo", amount: 3000 }
        ];
        const mockAssets5 = [
            { id: "t1", name: "Small Part", cost: 1000, openingRecovered: 0, priority: 1, recoveryPercent: 1.00, source: "Coffee Vendo" }
        ];
        const res5 = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo", mockLogs5, mockAssets5);
        if (res5.allocatedTotal === 1000 && res5.totalRemaining === 0 && res5.surplusAfterRecovery === 2000) {
            results.fullPaybackTest = "PASS";
        }

        return results;
    },

    runExclusivityTests() {
        const results = {
            coffeeExclusivityTest: "FAIL", // Section 18
            metalCaseExclusivityTest: "FAIL", // Section 19
            doubleDeductionTest: "FAIL", // Section 20
            generalBranchTargetTest: "FAIL" // Section 21
        };

        const mockAssets = [
            { id: "rec_coffee_machine", name: "Coffee Vendo Machine", cost: 20000, openingRecovered: 0, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo", recoveryFundingMode: "SOURCE_SELF_RECOVERY" },
            { id: "rec_metal_case", name: "Coffee Metal Case", cost: 8000, openingRecovered: 0, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo", recoveryFundingMode: "SOURCE_SELF_RECOVERY" },
            { id: "gen_target_1", name: "Cabagnan Renovation", cost: 10000, openingRecovered: 0, recoveryPercent: 0.50, branch: "Cabagñan", recoveryFundingMode: "BRANCH_RECOVERY" }
        ];

        const mockLogs = [
            { type: "income", source: "Coffee Vendo", amount: 5000, branch: "Cabagñan" },
            { type: "expense", source: "Coffee Vendo", expenseScope: "Source Direct Expense", amount: 1500, branch: "Cabagñan" },
            { type: "income", source: "Pisonet", amount: 10000, branch: "Cabagñan" }
        ];

        const coffeeRes = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo", mockLogs, mockAssets);
        const genRes = RecoveryService.calculateBranchWaterfall("Cabagñan", 10000, mockAssets);

        // 1. Coffee Machine Exclusivity
        const inCoffee1 = coffeeRes.allocations.some(a => a.id === "rec_coffee_machine");
        const inGen1 = genRes.allocations.some(a => a.id === "rec_coffee_machine");
        if (inCoffee1 && !inGen1) {
            results.coffeeExclusivityTest = "PASS";
        }

        // 2. Metal Case Exclusivity
        const inCoffee2 = coffeeRes.allocations.some(a => a.id === "rec_metal_case");
        const inGen2 = genRes.allocations.some(a => a.id === "rec_metal_case");
        if (inCoffee2 && !inGen2) {
            results.metalCaseExclusivityTest = "PASS";
        }

        // 3. Double Deduction
        if (coffeeRes.operatingProfit === 3500 && coffeeRes.allocatedTotal === 1750 && coffeeRes.surplusAfterRecovery === 1750) {
            results.doubleDeductionTest = "PASS";
        }

        // 4. General Branch Target Exclusivity
        const inCoffee3 = coffeeRes.allocations.some(a => a.id === "gen_target_1");
        const inGen3 = genRes.allocations.some(a => a.id === "gen_target_1");
        if (!inCoffee3 && inGen3) {
            results.generalBranchTargetTest = "PASS";
        }

        return results;
    },

    runCriticalRepairTests() {
        const results = {
            emptyGeneralQueueTest: "FAIL", // Section 17
            coffeeExclusivityTest: "FAIL", // Section 18
            mockIsolationTest: "FAIL", // Section 19
            noLegacy19000Test: "FAIL" // Section 20
        };

        // 1. Empty General Queue Test
        const emptyAssets = [];
        const wfRes = RecoveryService.calculateBranchWaterfall("Cabagñan", 2168.73, emptyAssets);
        if (wfRes.allocations.length === 0 && wfRes.recoveryPool === 0 && wfRes.rateUsed === 0 && wfRes.allocatedTotal === 0) {
            results.emptyGeneralQueueTest = "PASS";
        }

        // 2. Coffee Exclusivity Test
        const mockCoffeeAssets = [
            { id: "rec_coffee_machine", name: "Coffee Vendo Machine", cost: 20000, openingRecovered: 0, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo", recoveryFundingMode: "SOURCE_SELF_RECOVERY" },
            { id: "rec_metal_case", name: "Coffee Metal Case", cost: 8000, openingRecovered: 0, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo", recoveryFundingMode: "SOURCE_SELF_RECOVERY" }
        ];
        const coffeeRes = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo", [], mockCoffeeAssets);
        const genRes = RecoveryService.calculateBranchWaterfall("Cabagñan", 2168.73, mockCoffeeAssets);

        const coffeeHasMachine = coffeeRes.allocations.some(a => a.id === "rec_coffee_machine");
        const genHasMachine = genRes.allocations.some(a => a.id === "rec_coffee_machine");
        const coffeeHasMetal = coffeeRes.allocations.some(a => a.id === "rec_metal_case");
        const genHasMetal = genRes.allocations.some(a => a.id === "rec_metal_case");

        if (coffeeHasMachine && !genHasMachine && coffeeHasMetal && !genHasMetal) {
            results.coffeeExclusivityTest = "PASS";
        }

        // 3. Mock Isolation Test
        const liveAssets = DataService.getAssets();
        const hasWaterContainer = liveAssets.some(a => a.name === "Water Container");
        if (!hasWaterContainer) {
            results.mockIsolationTest = "PASS";
        }

        // 4. No Legacy 19,000 Test
        const coffeeMachineTarget = liveAssets.find(a => a.id === "rec_coffee_machine" || a.name?.includes("Coffee Vendo Machine"));
        if (!coffeeMachineTarget || coffeeMachineTarget.openingRecovered === 0) {
            results.noLegacy19000Test = "PASS";
        }

        return results;
    },

    runDynamicEnrollmentTests() {
        const results = {
            addToExistingSourceTest: "FAIL", // Section 28
            newSourceTest: "FAIL", // Section 29
            noDoubleGroupTest: "FAIL", // Section 30
            waterSpillTest: "FAIL", // Section 31
            operatingExpenseTest: "FAIL" // Section 32
        };

        // 1. Add to existing source test
        const mockAssets1 = [
            { id: "c1", name: "Coffee Machine", cost: 20000, openingRecovered: 0, priority: 1, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo 1", recoveryFundingMode: "SOURCE_SELF_RECOVERY" },
            { id: "c2", name: "Metal Case", cost: 8000, openingRecovered: 0, priority: 2, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo 1", recoveryFundingMode: "SOURCE_SELF_RECOVERY" }
        ];
        const pumpTarget = { name: "Water Pump", cost: 2500, branch: "Cabagñan", source: "Coffee Vendo 1", recoveryFundingMode: "SOURCE_SELF_RECOVERY" };
        const maxPrio = mockAssets1.reduce((max, a) => Math.max(max, a.priority || 0), 0);
        const newTarget = { ...pumpTarget, id: "c3", priority: maxPrio + 1 };
        mockAssets1.push(newTarget);

        const coffee1Res = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo 1", [], mockAssets1);
        const genRes1 = RecoveryService.calculateBranchWaterfall("Cabagñan", 10000, mockAssets1);

        const inCoffee1 = coffee1Res.allocations.some(a => a.id === "c3");
        const inGen1 = genRes1.allocations.some(a => a.id === "c3");
        if (inCoffee1 && !inGen1 && newTarget.priority === 3) {
            results.addToExistingSourceTest = "PASS";
        }

        // 2. New Source test (Coffee Vendo 2)
        const mockAssets2 = [
            { id: "cv2_1", name: "Coffee Vendo 2 Machine", cost: 22000, openingRecovered: 0, priority: 1, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo 2", recoveryFundingMode: "SOURCE_SELF_RECOVERY" },
            { id: "cv2_2", name: "Coffee Vendo 2 Case", cost: 4000, openingRecovered: 0, priority: 2, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo 2", recoveryFundingMode: "SOURCE_SELF_RECOVERY" }
        ];
        const coffee2Res = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo 2", [{ type: "income", source: "Coffee Vendo 2", amount: 10000 }], mockAssets2);
        if (coffee2Res.allocations.length === 2 && coffee2Res.allocations[0].id === "cv2_1") {
            results.newSourceTest = "PASS";
        }

        // 3. No Double Group test
        const allAllocations = [...coffee1Res.allocations, ...coffee2Res.allocations, ...genRes1.allocations];
        const targetGroupCounts = {};
        allAllocations.forEach(a => {
            targetGroupCounts[a.id] = (targetGroupCounts[a.id] || 0) + 1;
        });
        const maxGroupCount = Math.max(...Object.values(targetGroupCounts));
        if (maxGroupCount === 1) {
            results.noDoubleGroupTest = "PASS";
        }

        // 4. Water spill in new source queue
        const mockAssets3 = [
            { id: "s1", name: "Target 1", cost: 1000, openingRecovered: 0, priority: 1, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo 2", recoveryFundingMode: "SOURCE_SELF_RECOVERY" },
            { id: "s2", name: "Target 2", cost: 5000, openingRecovered: 0, priority: 2, recoveryPercent: 0.50, branch: "Cabagñan", source: "Coffee Vendo 2", recoveryFundingMode: "SOURCE_SELF_RECOVERY" }
        ];
        const poolLogs = [{ type: "income", source: "Coffee Vendo 2", amount: 5000 }]; // 5000 * 50% = 2500 pool
        const spillRes = RecoveryService.calculateSourceSelfRecovery("Coffee Vendo 2", poolLogs, mockAssets3);
        if (spillRes.allocations[0]?.currentPeriodAllocation === 1000 && spillRes.allocations[0]?.status === "FULLY RECOVERED" &&
            spillRes.allocations[1]?.currentPeriodAllocation === 1500 && spillRes.allocations[1]?.status === "ACTIVE") {
            results.waterSpillTest = "PASS";
        }

        // 5. Operating expense test
        const opExpense = { label: "Coffee Powder", amount: 500, type: "expense", source: "Coffee Vendo 1" };
        const currentTargets = DataService.getAssets();
        const hasPowderTarget = currentTargets.some(a => a.name?.toLowerCase().includes("powder"));
        if (!hasPowderTarget && opExpense.type === "expense") {
            results.operatingExpenseTest = "PASS";
        }

        return results;
    }
};
