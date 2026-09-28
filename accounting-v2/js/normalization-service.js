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

export const resolveAuthoritativeLogDate = (rawDoc) => {
    if (!rawDoc) {
        return { transactionDate: "AMBIGUOUS LEGACY DATE", dateStr: "Unknown Date", timestampMs: null, isAmbiguous: true, confidence: "Low" };
    }

    const rawTxDate = rawDoc.transactionDate;
    const rawDateStr = rawDoc.dateStr;
    const rawDate = rawDoc.date;

    const candidateStr = (rawTxDate || rawDateStr || rawDate || "").toString().trim();

    // Get reliable historical created timestamp if available
    let createdDate = null;
    if (rawDoc.timestamp) {
        if (typeof rawDoc.timestamp.toDate === 'function') createdDate = rawDoc.timestamp.toDate();
        else if (rawDoc.timestamp.seconds !== undefined) createdDate = new Date(rawDoc.timestamp.seconds * 1000);
        else if (typeof rawDoc.timestamp === 'number') createdDate = new Date(rawDoc.timestamp);
        else if (typeof rawDoc.timestamp === 'string') createdDate = new Date(rawDoc.timestamp);
    } else if (rawDoc.createdAt) {
        if (typeof rawDoc.createdAt.toDate === 'function') createdDate = rawDoc.createdAt.toDate();
        else if (rawDoc.createdAt.seconds !== undefined) createdDate = new Date(rawDoc.createdAt.seconds * 1000);
        else if (typeof rawDoc.createdAt === 'number') createdDate = new Date(rawDoc.createdAt);
        else if (typeof rawDoc.createdAt === 'string') createdDate = new Date(rawDoc.createdAt);
    }

    // 1. Match full explicit ISO year format YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = candidateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        const y = parseInt(isoMatch[1], 10);
        const m = parseInt(isoMatch[2], 10);
        const d = parseInt(isoMatch[3], 10);
        if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            const formattedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const timestampMs = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
            return {
                transactionDate: formattedDate,
                dateStr: formattedDate,
                timestampMs,
                isAmbiguous: false,
                confidence: "High"
            };
        }
    }

    // 2. Match full explicit year format MM/DD/YYYY or DD/MM/YYYY
    const slashMatch = candidateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (slashMatch) {
        const n1 = parseInt(slashMatch[1], 10);
        const n2 = parseInt(slashMatch[2], 10);
        const y = parseInt(slashMatch[3], 10);
        if (y >= 2000 && y <= 2100) {
            let m = null;
            let d = null;

            if (n1 > 12 && n2 <= 12) {
                // Must be DD/MM/YYYY
                d = n1;
                m = n2;
            } else if (n2 > 12 && n1 <= 12) {
                // Must be MM/DD/YYYY
                m = n1;
                d = n2;
            } else if (n1 <= 12 && n2 <= 12) {
                // Disambiguate MM/DD vs DD/MM using createdDate if available
                if (createdDate && !isNaN(createdDate.getTime()) && createdDate.getFullYear() === y) {
                    const cM = createdDate.getMonth() + 1;
                    const cD = createdDate.getDate();
                    if (cM === n2 && cD === n1) {
                        // Matches DD/MM/YYYY
                        d = n1;
                        m = n2;
                    } else if (cM === n1 && cD === n2) {
                        // Matches MM/DD/YYYY
                        m = n1;
                        d = n2;
                    } else {
                        // Default to MM/DD/YYYY
                        m = n1;
                        d = n2;
                    }
                } else {
                    // Default to US MM/DD/YYYY
                    m = n1;
                    d = n2;
                }
            }

            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                const formattedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const timestampMs = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
                return {
                    transactionDate: formattedDate,
                    dateStr: formattedDate,
                    timestampMs,
                    isAmbiguous: false,
                    confidence: "High"
                };
            }
        }
    }

    // 3. Check for year-less date string e.g. "10/1" or "09/28"
    const yearlessMatch = candidateStr.match(/^(\d{1,2})[-/](\d{1,2})$/);

    if (yearlessMatch) {
        const num1 = parseInt(yearlessMatch[1], 10);
        const num2 = parseInt(yearlessMatch[2], 10);

        if (createdDate && !isNaN(createdDate.getTime())) {
            const createdYear = createdDate.getFullYear();
            const createdMonth = createdDate.getMonth() + 1;

            let m = null;
            let d = null;

            if (num1 > 12) {
                d = num1;
                m = num2;
            } else if (num2 > 12) {
                m = num1;
                d = num2;
            } else {
                if (createdMonth === num1) {
                    m = num1;
                    d = num2;
                } else if (createdMonth === num2) {
                    m = num2;
                    d = num1;
                }
            }

            if (m !== null && d !== null) {
                const isSameMonth = (createdMonth === m);
                const isNearMonthBoundary = Math.abs(createdMonth - m) === 1 || Math.abs(createdMonth - m) === 11;

                if (isSameMonth || isNearMonthBoundary) {
                    const formattedDate = `${createdYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const timestampMs = new Date(createdYear, m - 1, d, 12, 0, 0, 0).getTime();
                    return {
                        transactionDate: formattedDate,
                        dateStr: formattedDate,
                        timestampMs,
                        isAmbiguous: false,
                        confidence: "Medium (Legacy Year Recovered)"
                    };
                } else {
                    return {
                        transactionDate: "AMBIGUOUS LEGACY DATE",
                        dateStr: candidateStr,
                        timestampMs: createdDate.getTime(),
                        isAmbiguous: true,
                        confidence: "Ambiguous Legacy Conflict"
                    };
                }
            } else {
                return {
                    transactionDate: "AMBIGUOUS LEGACY DATE",
                    dateStr: candidateStr,
                    timestampMs: createdDate.getTime(),
                    isAmbiguous: true,
                    confidence: "Ambiguous Legacy Conflict"
                };
            }
        } else {
            // DO NOT ASSIGN CURRENT SYSTEM YEAR TO YEAR-LESS STRING!
            return {
                transactionDate: "AMBIGUOUS LEGACY DATE",
                dateStr: candidateStr,
                timestampMs: null,
                isAmbiguous: true,
                confidence: "Ambiguous (No Year)"
            };
        }
    }

    // 4. Fallback to createdDate if candidateStr was missing
    if (createdDate && !isNaN(createdDate.getTime())) {
        const y = createdDate.getFullYear();
        const m = createdDate.getMonth() + 1;
        const d = createdDate.getDate();
        const formattedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return {
            transactionDate: formattedDate,
            dateStr: formattedDate,
            timestampMs: createdDate.getTime(),
            isAmbiguous: false,
            confidence: "Medium (Timestamp Fallback)"
        };
    }

    return {
        transactionDate: "AMBIGUOUS LEGACY DATE",
        dateStr: candidateStr || "Unknown Date",
        timestampMs: null,
        isAmbiguous: true,
        confidence: "Low"
    };
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

    // --- 1. AUTHORITATIVE DATE NORMALIZATION ---
    const dateRes = resolveAuthoritativeLogDate(rawDoc);
    const timestampMs = dateRes.timestampMs;
    const dateStrStr = dateRes.dateStr;
    const transactionDate = dateRes.transactionDate;

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
        transactionDate: transactionDate,
        isAmbiguousDate: dateRes.isAmbiguous,
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
