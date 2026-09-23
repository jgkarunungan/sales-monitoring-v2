/**
 * NORMALIZATION SERVICE - STAGE 2 (FIXED + CORRECTIONS + DUPLICATE PREVENTION)
 * Handles robust log parsing, improved branch/source classification, case-insensitive partner matching,
 * authoritative owner share semantics, and detailed validation diagnostics.
 */

export const OWNER_OPERATED_BRANCHES = ["Cabagñan", "Iraya"];

export const normalizePartnerType = (value) => {
    if (!value) return "Unknown";
    const v = value.toLowerCase();
    if (v.includes("pisonet")) return "Pisonet";
    if (v.includes("pisowifi") || v.includes("wifi")) return "PisoWiFi";
    return "Unknown";
};

/**
 * CANONICAL EXPENSE CATEGORY MAPPER
 * Recognizing aliases for monthly bills.
 */
export const normalizeExpenseCategory = (label) => {
    if (!label) return null;
    const l = label.toLowerCase();

    // ELECTRICITY ALIASES
    if (l.includes("aleco") || l.includes("electricity") || l.includes("electric bill")) {
        return "ALECO";
    }

    // INTERNET ALIASES
    if (l.includes("dctv") || l.includes("internet") || l.includes("internet bill") || (l.includes("wifi") && l.includes("bill"))) {
        return "DCTV";
    }

    if (l.includes("water bill")) return "Water Bill";
    if (l.includes("powder")) return "Powder";
    if (l.includes("cup")) return "Vendo Cups";
    if (l.includes("paper")) return "Paper Expense";
    if (l.includes("ink") || l.includes("toner")) return "Ink / Toner";

    return null;
};

export const normalizeLog = (rawDoc, configuredPartners = []) => {
    const labelRaw = rawDoc.label || "No Label";
    const labelLower = labelRaw.toLowerCase();
    const partnerField = rawDoc.partner || null;
    const type = rawDoc.type || "Unknown";
    const amount = parseFloat(rawDoc.amount || 0);
    const pendingBalance = parseFloat(rawDoc.pendingBalance || 0);

    let branch = "Unclassified";
    let source = "Unclassified";
    let partnerName = partnerField;
    let ownerShare = null;
    let partnerShare = null;
    let expenseScope = "Unclassified";

    // Check canonical category first
    let expenseCategory = normalizeExpenseCategory(labelRaw) || rawDoc.category || null;

    let confidence = "Low";
    let notes = [];

    // --- 1. DATE & TIMESTAMP NORMALIZATION ---
    let timestampMs = null;
    let dateStrStr = "Unknown Date";

    if (rawDoc.timestamp) {
        if (typeof rawDoc.timestamp.toDate === 'function') {
            const d = rawDoc.timestamp.toDate();
            timestampMs = d.getTime();
            dateStrStr = d.toLocaleDateString();
        } else if (rawDoc.timestamp.seconds !== undefined) {
            timestampMs = rawDoc.timestamp.seconds * 1000;
            const d = new Date(timestampMs);
            dateStrStr = d.toLocaleDateString();
        } else {
            const d = new Date(rawDoc.timestamp);
            if (!isNaN(d.getTime())) {
                timestampMs = d.getTime();
                dateStrStr = d.toLocaleDateString();
            }
        }
    }

    // Attempt to parse dateStr if timestamp is missing
    if (!timestampMs && rawDoc.dateStr) {
        const d = new Date(rawDoc.dateStr);
        if (!isNaN(d.getTime())) {
            timestampMs = d.getTime();
            dateStrStr = d.toLocaleDateString();
        } else {
            dateStrStr = rawDoc.dateStr;
        }
    }

    // --- 2. SOURCE INFERENCE ---
    if (labelLower.includes("coffee") || labelLower.includes("vendo") || labelLower.includes("powder") || labelLower.includes("cup") || labelLower.includes("water machine")) {
        source = "Coffee Vendo";
    } else if (labelLower.includes("printing") || labelLower.includes("photocopy") || labelLower.includes("paper") || labelLower.includes("ink") || labelLower.includes("toner")) {
        source = "Printing / Photocopy";
    } else if (labelLower.includes("pisonet")) {
        source = "Pisonet";
    } else if (labelLower.includes("pisowifi") || labelLower.includes("wifi")) {
        source = "PisoWiFi";
    }

    // Extract best partner / location candidate
    let partnerCandidate = rawDoc.partnerName || rawDoc.partner || rawDoc.location || rawDoc.sourceName || rawDoc.sourceInstanceName || null;
    if (!partnerCandidate && labelRaw && labelRaw !== "No Label") {
        partnerCandidate = labelRaw;
    }
    partnerName = partnerCandidate || partnerField;

    // --- 3. BRANCH CLASSIFICATION HIERARCHY ---
    const isCabagnanMatch = (l) => l.includes("cabagnan") || l.includes("cabagñan");
    const isIrayaMatch = (l) => l.includes("iraya");
    const partnerMatchLower = partnerName ? partnerName.toLowerCase() : (partnerField ? partnerField.toLowerCase() : "");

    // A. Explicit field check
    if (rawDoc.branch && OWNER_OPERATED_BRANCHES.includes(rawDoc.branch)) {
        branch = rawDoc.branch;
        confidence = "High";
    } else {
        // B. Exact historical patterns for PisoWiFi
        if (source === "PisoWiFi" || (rawDoc.branch && (rawDoc.branch.includes("Partner") || rawDoc.branch.includes("PisoWiFi")))) {
            if (isCabagnanMatch(labelLower) || isCabagnanMatch(partnerMatchLower)) {
                branch = "Cabagñan";
                confidence = "High";
            } else if (isIrayaMatch(labelLower) || isIrayaMatch(partnerMatchLower)) {
                branch = "Iraya";
                confidence = "High";
            } else {
                branch = "Partner PisoWiFi";
                confidence = "High";
            }
        }
        else if (source === "Coffee Vendo" || source === "Printing / Photocopy") {
            branch = "Cabagñan";
            confidence = "High";
        } else if (source === "Pisonet") {
            if (isIrayaMatch(labelLower) || isIrayaMatch(partnerMatchLower)) {
                branch = "Iraya";
                confidence = "High";
            } else if (isCabagnanMatch(labelLower) || isCabagnanMatch(partnerMatchLower)) {
                branch = "Cabagñan";
                confidence = "High";
            }
        }

        if (branch === "Unclassified") {
            if (isCabagnanMatch(labelLower)) branch = "Cabagñan";
            else if (isIrayaMatch(labelLower)) branch = "Iraya";
            else if (isCabagnanMatch(partnerMatchLower)) branch = "Cabagñan";
            else if (isIrayaMatch(partnerMatchLower)) branch = "Iraya";
        }
    }

    // --- 4. AUTHORITATIVE OWNERSHIP SEMANTICS ---
    if (rawDoc.sharePercent !== undefined && rawDoc.sharePercent !== null) {
        let rawPct = parseFloat(rawDoc.sharePercent);
        if (rawPct > 1.0) rawPct = rawPct / 100.0;
        ownerShare = rawPct;
        partnerShare = 1.0 - ownerShare;
    } else if (rawDoc.ownerShare !== undefined && rawDoc.ownerShare !== null) {
        let rawPct = parseFloat(rawDoc.ownerShare);
        if (rawPct > 1.0) rawPct = rawPct / 100.0;
        ownerShare = rawPct;
        partnerShare = 1.0 - ownerShare;
    } else {
        const matchedPartner = partnerMatchLower ? configuredPartners.find(p => p.name && p.name.toLowerCase() === partnerMatchLower) : null;
        if (matchedPartner) {
            ownerShare = parseFloat(matchedPartner.share || 0);
            if (ownerShare > 1.0) ownerShare /= 100.0;
            partnerShare = 1.0 - ownerShare;
        } else if (branch === "Cabagñan") {
            ownerShare = 1.0;
            partnerShare = 0.0;
        } else if (branch === "Iraya" && source === "PisoWiFi") {
            ownerShare = 1.0;
            partnerShare = 0.0;
        } else if (branch === "Iraya" && source === "Pisonet") {
            ownerShare = 0.50;
            partnerShare = 0.50;
        } else {
            ownerShare = null;
            partnerShare = null;
        }
    }

    // --- 5. EXPENSE SCOPE CLASSIFICATION ---
    if (type.toLowerCase() === "expense" || type.toLowerCase() === "outflow") {
        if (branch === "Cabagñan") {
            if (expenseCategory === "ALECO" || expenseCategory === "DCTV" || expenseCategory === "Water Bill") {
                expenseScope = "Branch Operating Expense";
            } else if (source !== "Unclassified") {
                expenseScope = "Source Direct Expense";
            } else {
                expenseScope = "Branch Operating Expense";
            }
        } else if (branch === "Iraya") {
            if (expenseCategory === "ALECO" || expenseCategory === "DCTV" || expenseCategory === "Water Bill" || labelLower.includes("shared bill")) {
                expenseScope = "Shared Branch Expense";
            } else if (source === "PisoWiFi") {
                expenseScope = "Source Direct Expense";
            } else if (source === "Pisonet") {
                expenseScope = "Source Direct Expense";
            } else {
                expenseScope = "Unclassified";
            }
        } else if (branch === "Partner PisoWiFi") {
            expenseScope = "Source Direct Expense";
        }
    }

    return {
        id: rawDoc.id,
        timestamp: timestampMs,
        date: dateStrStr,
        label: labelRaw,
        type: type,
        amount: amount,
        branch: branch,
        source: rawDoc.source || source, // Use stored source if present (V2), otherwise inferred
        sourceId: rawDoc.sourceId || null,
        partnerName: partnerName,
        ownerShare: ownerShare,
        partnerShare: partnerShare,
        expenseScope: expenseScope,
        expenseCategory: expenseCategory,
        pendingBalance: pendingBalance,
        classificationConfidence: confidence,
        classificationNotes: notes.join(" | "),
        raw: rawDoc
    };
};
