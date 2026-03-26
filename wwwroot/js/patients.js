/* ═══════════════════════════════════════════════════════
   PATIENTS PAGE — DATA loaded remotely from /api
═══════════════════════════════════════════════════════ */
var patientsData = []; // populated after the grid's first read

/* ═══════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════ */
var grid             = null;
var currentPatient   = null;
var previewPatient   = null;
var listAiChat       = null;
var notesEditor      = null;
var notesAiPrompt    = null;
var listAiReady      = false;
var _aiAssistant    = {
        id: "ai-assistant",
        name: "AI Assistant"
};
 var _aiUser         = {
        id: "dr-carter",
        name: "Dr. Carter",
        iconUrl: "/content/patient-images/women/michael-dam-mEZ3PoFGs_k-unsplash.jpg"
    };

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
function getFullPatient(id) {
    // patientsData is populated after the first grid read
    var cached = patientsData.find(function (p) { return p.id === id; });
    return cached || null;
}

function formatVital(key, val) {
    switch (key) {
        case "bp":     return val;                       // already "148/92 mmHg"
        case "hr":     return val + " bpm";
        case "temp":   return val + "°F";
        case "spo2":   return val + "%";
        case "weight": return val + " lbs";
        default:       return String(val);
    }
}

function formatMed(m) {
    if (typeof m === "string") return m;
    return m.drug + " " + m.dose + (m.frequency !== "PRN" ? " " + m.frequency : " PRN");
}

function isVitalCritical(field, value) {
    var num = parseFloat(value);
    if (isNaN(num)) return false;
    switch (field) {
        case "bp":   return parseInt(value, 10) > 140;
        case "hr":   return num > 100 || num < 60;
        case "temp": return num > 99.5;
        case "spo2": return num < 94;
        default:     return false;
    }
}

function flagClass(flag) {
    var map = { "High": "flag-high", "Low": "flag-low", "Abnormal": "flag-abnormal", "Normal": "flag-normal" };
    return map[flag] || "flag-normal";
}

var _listAiResponses = {
    "What are common patient risk factors?":
        "Common risk factors across patients include hypertension, diabetes, obesity, smoking, and sedentary lifestyle. Patients with complex medication regimens or known allergies require additional monitoring.",
    "What follow-up protocols should I apply?":
        "Standard follow-up protocols: schedule a review within 2\u20134 weeks post-discharge, confirm medication adherence, repeat any abnormal lab tests within 30 days, and coordinate with specialists where a referral was made.",
    "How do I interpret abnormal lab results?":
        "Abnormal results should be compared against the patient\u2019s historical baseline and clinical context. Elevated CRP or WBC may indicate infection or inflammation. Out-of-range electrolytes (sodium, potassium) carry cardiac risk. Always cross-reference with current medications before acting.",
    "What are today\u2019s critical care priorities?":
        "Critical priorities include: monitoring patients with oxygen saturation below 92%, reviewing all flagged lab results before the next round, confirming allergy documentation for any new prescriptions, and ensuring high-risk patients have an updated care plan."
};

function _replyToListAiMsg(text) {
    if (!listAiChat) return;
    var reply = _listAiResponses[text] || "I\u2019m sorry, I don\u2019t have information on that right now.";
    setTimeout(function () {
        listAiChat.postMessage({
            authorId:   _aiAssistant.id,
            authorName: _aiAssistant.name,
            type:       "text",
            text:       reply
        });
        listAiChat.scrollToBottom();
    }, 1000);
}

function initListAiChat() {
    if (listAiReady) return;
    listAiReady = true;
    listAiChat = $("#list-ai-chat").kendoChat({
        authorId: _aiUser.id,
        user: {
            name:    _aiUser.name,
            iconUrl: _aiUser.iconUrl
        },
        messages: { placeholder: "Ask AI about patients\u2026" },
        suggestions: [
            { text: "What are today\u2019s critical care priorities?" },
            { text: "What are common patient risk factors?" },
            { text: "What follow-up protocols should I apply?" },
            { text: "How do I interpret abnormal lab results?" }            
        ],
        sendMessage: function (e) {
            if (!e.generating) {
                _replyToListAiMsg(e.message.text);
                e.sender.scrollToBottom();
            }
        }
    }).data("kendoChat");

    listAiChat.postMessage({
            authorId:   _aiAssistant.id,
            authorName: _aiAssistant.name,
            type:       "text",
            timestamp:  new Date(),
            text: "\uD83D\uDC4B Hello! I\u2019m your AI Assistant.\n\nI can help you with your daily clinical tasks, patient information, and quick actions. Try one of the suggestions below!"
        });
    listAiChat.scrollToBottom();
}

/* ═══════════════════════════════════════════════════════
   FILTER HELPERS
═══════════════════════════════════════════════════════ */
function applyFilters(searchVal) {
    if (!grid) return;
    var val = (searchVal !== undefined) ? searchVal : "";
    if (!val) {
        grid.dataSource.filter({});
        return;
    }
    grid.dataSource.filter({
        logic: "or",
        filters: [
            { field: "name",      operator: "contains", value: val },
            { field: "id",        operator: "contains", value: val },
            { field: "diagnosis", operator: "contains", value: val }
        ]
    });
}

/* ═══════════════════════════════════════════════════════
   DRILLDOWN OPEN / CLOSE
═══════════════════════════════════════════════════════ */
function openPatientDrilldown(patient) {
    hideNotesAiPrompt();
    currentPatient = patient;
    renderPatientDetail(patient);
    $("#patients-list-view").hide();
    $("#patients-breadcrumb").show();
    $("#patients-detail-view").show();
    window.scrollTo(0, 0);
}

function hideNotesAiPrompt() {
    $("#notes-ai-prompt-container").hide();
}

function closePatientDrilldown() {
    // Save editor content back to patient object
    if (notesEditor && currentPatient) {
        currentPatient.notes = notesEditor.value();
    }
    hideNotesAiPrompt();
    $("#patients-detail-view").hide();
    $("#patients-breadcrumb").hide();
    $("#patients-list-view").show();
    // Refresh grid to reflect any status changes
    if (grid) { grid.dataSource.read(); }
}

/* ═══════════════════════════════════════════════════════
   DETAIL VIEW RENDERING
═══════════════════════════════════════════════════════ */
function renderPatientDetail(patient) {
    var vi  = patient.vitals;
    var adm = patient.admissionDetails || {};

    // Inline helper: one label/value row
    function infoRow(label, value, critical) {
        return '<div class="profile-info-row">' +
            '<span class="profile-info-label">' + label + '</span>' +
            '<span class="profile-info-value' + (critical ? ' critical' : '') + '">' + value + '</span>' +
        '</div>';
    }

    // ── Card 1: Patient Info ──────────────────────────────────────
    var infoCardHtml =
        '<div class="card profile-info-card">' +
            '<div class="profile-info-header">' +
                '<img src="' + patient.avatar + '" alt="' + kendo.htmlEncode(patient.name) + '" class="patient-avatar-profile" />' +
                '<div class="profile-name-status">' +
                    '<span class="profile-patient-name">' + kendo.htmlEncode(patient.name) + '</span>' +
                    '<span class="k-chip-status" data-status="' + kendo.htmlEncode(patient.status) + '"></span>' +
                '</div>' +
            '</div>' +
            '<p class="profile-basic-heading">Basic Information</p>' +
            infoRow('Patient ID', '<strong>' + patient.id + '</strong>', false) +
            infoRow('Age/Gender', '<strong>' + patient.age + ' years, ' + patient.gender + '</strong>', false) +
        '</div>';

    // ── Card 2: Recent Vitals ─────────────────────────────────────
    var rrVal    = vi.rr || 16;
    var vitalsCardHtml =
        '<div class="card profile-section-card">' +
            '<p class="profile-section-heading">Recent Vitals</p>' +
            infoRow('Heart Rate',       vi.hr   + ' bpm',          vi.hr > 100 || vi.hr < 60) +
            infoRow('Blood Pressure',   vi.bp.replace(' mmHg', ''), vi.systolic > 140)         +
            infoRow('Temperature',      vi.temp + '\u00B0F',        vi.temp > 99.5)             +
            infoRow('O2 Saturation',    vi.spo2 + '%',              vi.spo2 < 94)               +
            infoRow('Respiratory Rate', rrVal   + ' breaths/min',   rrVal > 20 || rrVal < 12)  +
        '</div>';

    // ── Card 3: Admission Details ─────────────────────────────────
    var admissionCardHtml =
        '<div class="card profile-section-card">' +
            '<p class="profile-section-heading">Admission Details</p>' +
            infoRow('Department',     kendo.htmlEncode(adm.department    || patient.ward),      false) +
            infoRow('Ward',           kendo.htmlEncode(adm.wardUnit      || patient.ward),      false) +
            infoRow('Room',           kendo.htmlEncode(adm.room ? String(adm.room) : '\u2014'), false) +
            infoRow('Admission Date', kendo.htmlEncode(adm.admissionDate || patient.lastVisit), false) +
            infoRow('Assigned Nurse', kendo.htmlEncode(adm.assignedNurse || '\u2014'),          false) +
        '</div>';

    // ── Patient Note card ─────────────────────────────────────────
    var notesCardHtml =
        '<div class="card profile-note-card">' +
            '<div class="detail-card-header-row">' +
                '<span class="detail-card-header-text">Patient Note</span>' +
                '<button id="btn-save-patient-note" class="detail-save-btn">Save</button>' +
            '</div>' +
            '<textarea id="patient-notes-editor"></textarea>' +
        '</div>';

    // ── Labs card ─────────────────────────────────────────────────
    var labsCardHtml =
        '<div class="card profile-labs-card">' +
            '<div id="patient-labs-grid"></div>' +
        '</div>';

    // ── Inject ────────────────────────────────────────────────────
    $("#detail-main").html(
        '<div class="profile-top-cards">' + infoCardHtml + vitalsCardHtml + admissionCardHtml + '</div>' +
        notesCardHtml +
        labsCardHtml
    );

    // Initialize labs grid
    initPatientLabsGrid(patient);

    // Initialize Kendo Chips in the detail view
    initKendoChips($("#detail-main"));

    $("#btn-save-patient-note").kendoButton({
        icon:    "save",
        rounded: "large"
    });

    // Save note button
    $("#btn-save-patient-note").on("click", function () {
        if (notesEditor && currentPatient) {
            var noteVal = notesEditor.value();
            currentPatient.notes = noteVal;
            var $btn = $(this);
            var saveBtn = $btn.data("kendoButton");
            $.ajax({
                url:         "/api/patients/" + currentPatient.id + "/notes",
                type:        "POST",
                contentType: "application/json",
                data:        JSON.stringify({ notes: noteVal }),
                success: function () {
                    if (saveBtn) {
                        saveBtn.setOptions({ icon: "check", text: "Saved" });
                    }
                    $btn.addClass("detail-save-btn--saved");
                    setTimeout(function () {
                        if (saveBtn) {
                            saveBtn.setOptions({ icon: "save", text: "Save" });
                        }
                        $btn.removeClass("detail-save-btn--saved");
                    }, 1500);
                },
                error: function () {
                    alert("Failed to save note. Please try again.");
                }
            });
        }
    });

    // Initialize editor
    var existingEditor = $("#patient-notes-editor").data("kendoEditor");
    if (existingEditor) { existingEditor.destroy(); }
    notesEditor = $("#patient-notes-editor").kendoEditor({
        tools: [
            "bold", "italic", "underline", "strikethrough",
            "justifyLeft", "justifyCenter", "justifyRight", "justifyFull",
            "fontName", "formatting", "fontSize",
            {
                name:  "ask-ai",
                icon:  "sparkles",
                text:  "Ask AI",
                showText: "always",
                attributes: { "class": "k-button-ask-ai" },
                exec: function () {
                    var $container = $("#notes-ai-prompt-container");
                    if ($container.is(":visible")) {
                        $container.hide();
                        return;
                    }
                    var $btn = $(".k-button-ask-ai").first();
                    var offset = $btn.offset();
                    $container.css({
                        top:  offset.top + $btn.outerHeight() + 4,
                        left: offset.left
                    }).show();
                }
            }
        ],
        value: patient.notes || ""
    }).data("kendoEditor");

    // ── Standalone AIPrompt anchored below the Ask AI toolbar button ──
    if ($("#notes-ai-prompt-container").length === 0) {
        $("body").append(
            '<div id="notes-ai-prompt-container" style="position:absolute;z-index:10001;display:none;width:480px;">' +
                '<div id="notes-ai-prompt"></div>' +
            '</div>'
        );
    } else {
        $("#notes-ai-prompt-container").hide();
    }
    var existingAiPr = $("#notes-ai-prompt").data("kendoAIPrompt");
    if (existingAiPr) { existingAiPr.destroy(); }
    notesAiPrompt = $("#notes-ai-prompt").kendoAIPrompt({
        promptRequest: function (e) {
            e.preventDefault();

            var patientContext =
                "\n\n---PATIENT CONTEXT---" +
                "\nName: "         + (patient.name       || "") +
                "\nAge: "          + (patient.age        || "") +
                "\nGender: "       + (patient.gender     || "") +
                "\nDiagnosis: "    + (patient.diagnosis  || "") +
                "\nBlood Type: "   + (patient.bloodType  || "") +
                "\nWard: "         + (patient.ward       || "") +
                "\nDoctor: "       + (patient.doctor     || "") +
                "\nStatus: "       + (patient.status     || "") +
                "\nRisk Score: "   + (patient.riskScore  || "") +
                "\nAllergies: "    + ((patient.allergies || []).join(", ")) +
                "\nVitals: BP "    + (patient.vitals && patient.vitals.bp   || "") +
                          ", HR "  + (patient.vitals && patient.vitals.hr   || "") +
                         ", SpO2 " + (patient.vitals && patient.vitals.spo2 || "") + "%" +
                "\nMedications: "  + ((patient.medications || []).map(function (m) {
                                         return m.drug + " " + m.dose + " " + m.frequency;
                                     }).join("; ")) +
                "\nCurrent Notes: " + (notesEditor ? notesEditor.value() : "") +
                "\n---END PATIENT CONTEXT---";

            $.ajax({
                url: "https://demos.telerik.com/service/v2/ai/completion",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify(
                    [{
                        role: "user",
                        contents: [{ $type: "text", text: e.prompt + patientContext }]
                    }]
                ),
                success: function (response) {
                    var text = response.messages[0].contents[0].text || "";
                    if (text && notesEditor) {
                        notesEditor.exec("insertHtml", { value: "<p>" + kendo.htmlEncode(text) + "</p>" });
                        $("#notes-ai-prompt-container").hide();
                    } else {
                        e.sender.addPromptOutput({ output: text, prompt: e.prompt });
                    }
                },
                error: function () {
                    e.sender.addPromptOutput({ output: "AI service unavailable.", prompt: e.prompt });
                }
            });
        },
        promptResponse: function (e) {
            var text = e.output || "";
            if (text && notesEditor) {
                notesEditor.exec("insertHtml", { value: "<p>" + kendo.htmlEncode(text) + "</p>" });
                $("#notes-ai-prompt-container").hide();
            }
        },
        promptTextArea: {
            rows: 3
        }
    }).data("kendoAIPrompt");
}

/* ═══════════════════════════════════════════════════════
   PATIENT LABS GRID
═══════════════════════════════════════════════════════ */
var _labMeta = {
    "CBC":           { ref: "4.5–11.0 ×10³/µL",  notes: { High: "Leukocytosis — monitor for infection", Low: "Leukopenia — monitor closely", Normal: "Complete blood count within normal range" } },
    "CRP":           { ref: "<5.0 mg/L",           notes: { High: "Significant inflammatory elevation", Normal: "No significant inflammation detected" } },
    "Lipid Panel":   { ref: "<100 mg/dL (LDL)",   notes: { High: "Above target for cardiac risk patients", Normal: "Lipid levels within target range" } },
    "HbA1c":         { ref: "<5.7%",               notes: { High: "Above target — review glycaemic management", Normal: "Glycaemic control within target" } },
    "BNP":           { ref: "<100 pg/mL",          notes: { High: "Elevated — consider cardiac assessment", Normal: "BNP within normal limits" } },
    "Troponin I":    { ref: "<0.004 ng/mL",        notes: { High: "Borderline — serial monitoring ordered", Normal: "No evidence of myocardial injury" } },
    "Ferritin":      { ref: "12–300 ng/mL",        notes: { High: "Elevated — check for inflammatory cause", Low: "Iron deficiency — supplement and monitor", Normal: "Iron stores adequate" } },
    "Vitamin D":     { ref: ">20 ng/mL",           notes: { Low: "Deficiency — supplementation recommended", Normal: "Vitamin D levels adequate" } },
    "TSH":           { ref: "0.5–4.5 µIU/mL",     notes: { High: "Elevated — consider hypothyroidism workup", Low: "Suppressed — consider hyperthyroidism", Normal: "Thyroid function normal" } },
    "eGFR":          { ref: ">60 mL/min/1.73m²",  notes: { Low: "Reduced — monitor renal function closely", Normal: "Adequate renal function" } },
    "Creatinine":    { ref: "0.6–1.2 mg/dL",      notes: { High: "Elevated — assess hydration and kidney function", Normal: "Creatinine within normal range" } },
    "Potassium":     { ref: "3.5–5.0 mEq/L",      notes: { High: "Hyperkalaemia — review medications and diet", Low: "Hypokalaemia — supplement as indicated", Normal: "Within normal limits" } },
    "LFT":           { ref: "ALT <40 U/L",         notes: { High: "Liver enzymes elevated — assess hepatic function", Normal: "Liver function within normal range" } },
    "ESR":           { ref: "<20 mm/hr",           notes: { High: "Elevated — consider inflammation or infection", Normal: "Erythrocyte sedimentation rate normal" } }
};

function _labStatus(flag) {
    if (flag === "High" || flag === "Abnormal") return "Critical";
    if (flag === "Low")  return "Monitoring";
    return "Stable";
}

function enrichLabData(labs) {
    return labs.map(function (l) {
        var meta  = _labMeta[l.test] || {};
        var flag  = l.flag || "Normal";
        var status = _labStatus(flag);
        var note  = (meta.notes && (meta.notes[flag] || meta.notes["Normal"])) || (flag === "Normal" ? "Within normal limits" : "Requires clinical review");
        return {
            test:      l.test,
            result:    l.result,
            reference: meta.ref || "See report",
            status:    status,
            note:      note
        };
    });
}

function initPatientLabsGrid(patient) {
    var existing = $("#patient-labs-grid").data("kendoGrid");
    if (existing) { existing.destroy(); }

    var labData = enrichLabData(patient.labs);

    $("#patient-labs-grid").kendoGrid({
        dataSource: new kendo.data.DataSource({
            transport: {
                read: function (options) {
                    // Re-fetch the latest patient record so labs are always current
                    $.getJSON("/api/patients", function (patients) {
                        var p = patients.find(function (x) { return x.id === patient.id; });
                        var rows = p ? enrichLabData(p.labs) : enrichLabData(patient.labs);
                        options.success(rows);
                    }).fail(function () {
                        options.success(labData); // fall back to already-loaded data
                    });
                }
            },
            pageSize: 10
        }),
        sortable:  true,
        pageable: {
            pageSizes:    [5, 10, 20],
            buttonCount:  5,
            messages:     { itemsPerPage: "Items per page", display: "{0} - {1} of {2} items" }
        },
        columnMenu: false, 
        columns: [
            { field: "test",      title: "Test",      width: 220 },
            { field: "result",    title: "Result",    width: 160 },
            { field: "reference", title: "Reference", width: 150 },
            {
                field: "status", title: "Status", width: 140,
                template: function (d) {
                    return '<span class="k-badge-status" data-status="' + kendo.htmlEncode(d.status) + '"></span>';
                }
            },
            { field: "note",  title: "Note", width: 300 }
        ],
        dataBound: function () {
            initKendoStatusBadges(this.tbody);
        }
    });
}

/* ═══════════════════════════════════════════════════════
   PATIENT PREVIEW PANEL
═══════════════════════════════════════════════════════ */
function buildPatientPreviewHtml(patient) {
    var vi  = patient.vitals;
    var adm = patient.admissionDetails || {};

    function ppRow(label, value, critical) {
        return '<div class="pp-info-row">' +
            '<span class="pp-info-label">' + kendo.htmlEncode(label) + '</span>' +
            '<span class="pp-info-value' + (critical ? ' pp-critical' : '') + '">' + value + '</span>' +
        '</div>';
    }

    var allergyHtml = '';
    if (patient.allergies && patient.allergies.length) {
        allergyHtml =
            '<div class="pp-allergy-card">' +
                '<div class="pp-allergy-icon">' +
                    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFD760" stroke-width="2">' +
                        '<path d="M9 3H4a1 1 0 0 0-1 1v5l10 10 6-6L9 3z"/>' +
                        '<circle cx="15" cy="9" r="1.5" fill="#FFD760" stroke="none"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="pp-allergy-text">' +
                    '<span class="pp-allergy-title">Allergy Alert</span>' +
                    '<span class="pp-allergy-desc">' + kendo.htmlEncode(patient.allergies.join(', ')) + '</span>' +
                '</div>' +
                '<a class="pp-details-link">Details ' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
                '</a>' +
            '</div>';
    }

    var rrVal = vi.rr || 16;

    return '<div class="pp-header">' +
            '<span class="pp-title">Patient Preview</span>' +
            '<button class="pp-close-btn" id="btn-close-preview" aria-label="Close">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#232A36" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
        '</div>' +
        '<div class="pp-body">' +
            '<div class="pp-avatar-row">' +
                '<img src="' + patient.avatar + '" class="pp-avatar" onerror="this.src=\'/content/patient-images/women/aiony-haust-3TLl_97HNJo-unsplash.jpg\'" />' +
                '<div class="pp-name-block">' +
                    '<div class="pp-name-row">' +
                        '<span class="pp-name">' + kendo.htmlEncode(patient.name) + '</span>' +
                        '<a class="pp-view-profile-link btn-view-patient" data-id="' + patient.id + '">' +
                            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
                            ' View profile' +
                        '</a>' +
                    '</div>' +
                    '<span class="pp-age-gender">' + patient.age + ' years, ' + kendo.htmlEncode(patient.gender) + '</span>' +
                '</div>' +
            '</div>' +
            allergyHtml +
            '<div class="pp-info-card">' +
                '<span class="pp-card-title">Basic Information</span>' +
                ppRow('Age / Gender', patient.age + ' / ' + (patient.gender === 'Male' ? 'M' : 'F'), false) +
                ppRow('Ward',       kendo.htmlEncode(patient.ward),      false) +
                ppRow('Diagnosis',  kendo.htmlEncode(patient.diagnosis), false) +
                ppRow('Last Visit', kendo.htmlEncode(patient.lastVisit), false) +
            '</div>' +
            '<div class="pp-info-card">' +
                '<span class="pp-card-title">Recent Vitals</span>' +
                ppRow('Heart Rate',     vi.hr + ' bpm',               vi.hr > 100 || vi.hr < 60) +
                ppRow('Blood Pressure', vi.bp.replace(' mmHg', ''),   vi.systolic > 140) +
                ppRow('Temperature',    vi.temp + '\u00B0F',           vi.temp > 99.5) +
                ppRow('O2 Saturation',  vi.spo2 + '%',                vi.spo2 < 94) +
            '</div>' +
            '<div class="pp-info-card">' +
                '<span class="pp-card-title">Admission Details</span>' +
                ppRow('Department',     kendo.htmlEncode(adm.department    || patient.ward),      false) +
                ppRow('Ward',           kendo.htmlEncode(adm.wardUnit      || patient.ward),      false) +
                ppRow('Room',           kendo.htmlEncode(adm.room ? String(adm.room) : '\u2014'), false) +
                ppRow('Admission Date', kendo.htmlEncode(adm.admissionDate || patient.lastVisit), false) +
                ppRow('Assigned Nurse', kendo.htmlEncode(adm.assignedNurse || '\u2014'),          false) +
            '</div>' +
        '</div>';
}

function openPatientPreview(patient) {
    previewPatient = patient;
    $("#patient-preview-panel").html(buildPatientPreviewHtml(patient)).css("display", "flex");
    $("#patients-list-body").addClass("preview-panel-open");
    syncPatientsSidePanelHeights();
    if (grid) { kendo.resize($("#patients-grid")); }
}

function closePatientPreview() {
    previewPatient = null;
    $("#patient-preview-panel").css("display", "none").empty();
    $("#patients-list-body").removeClass("preview-panel-open");
    clearPatientsSidePanelHeights();
    if (grid) { kendo.resize($("#patients-grid")); }
}

function syncPatientsSidePanelHeights() {
    window.requestAnimationFrame(function () {
        var gridHeight = $(".patients-grid-card:visible").outerHeight();

        if (!gridHeight) {
            return;
        }

        $("#list-ai-panel:visible, #patient-preview-panel:visible").css("height", gridHeight + "px");
    });
}

function clearPatientsSidePanelHeights() {
    $("#list-ai-panel, #patient-preview-panel").css("height", "");
}

function openAllergyDetailsDialog(patient) {
    var chipsHtml = (patient.allergies || []).map(function (a) {
        return '<span class="k-chip-allergy" data-label="' +
               kendo.htmlEncode(a) + '"></span>';
    }).join("");

    var dlgId = "pp-allergy-dialog";
    if ($("#" + dlgId).length === 0) {
        $("body").append('<div id="' + dlgId + '"></div>');
    }
    var $dlg = $("#" + dlgId);
    var existing = $dlg.data("kendoDialog");
    if (existing) { existing.destroy(); }

    $dlg.kendoDialog({
        title:   "Allergy Alert \u2014 Details",
        width:   420,
        modal:   true,
        visible: false,
        content: '<div class="info-dialog">' +
                 '  <div class="info-dialog-section">' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Patient</span><span>' + kendo.htmlEncode(patient.name) + '</span></div>' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Blood Type</span><span>' + kendo.htmlEncode(patient.bloodType || '\u2014') + '</span></div>' +
                 '  </div>' +
                 '  <div class="info-dialog-section">' +
                 '    <div class="info-dialog-section-title">Known Allergens</div>' +
                 chipsHtml +
                 '    <div class="info-dialog-note">Please review before prescribing any medication.</div>' +
                 '  </div>' +
                 '</div>',
        actions: [{ text: "Close" }]
    });
    var dlgWidget = $dlg.data("kendoDialog");
    initKendoChips(dlgWidget.element);
    dlgWidget.open();
}

/* ═══════════════════════════════════════════════════════
   CHANGE STATUS DIALOG
═══════════════════════════════════════════════════════ */
var _statusPatient = null;

function openChangeStatusDialog(patient) {
    _statusPatient = patient;

    if (!$("#change-status-dialog").data("kendoDialog")) {
        $("#change-status-dialog").kendoDialog({
            title:   "Change Status",
            width:   360,
            modal:   true,
            visible: false,
            open: function () {
                if (!_statusPatient) return;
                var $sel = $("#new-status-ddl");
                var ddl  = $sel.data("kendoDropDownList");
                if (ddl) { ddl.destroy(); }
                $sel.kendoDropDownList({
                    dataSource: ["Critical", "Monitoring", "Stable"],
                    value:      _statusPatient.status,
                    rounded:    "large"
                });
            },
            actions: [
                {
                    text:    "Save",
                    primary: true,
                    action:  function () {
                        if (!_statusPatient) return true;
                        var val = $("#new-status-ddl").data("kendoDropDownList").value();
                        $.ajax({
                            url:         "/api/patients/" + _statusPatient.id + "/status",
                            type:        "POST",
                            contentType: "application/json",
                            data:        JSON.stringify({ status: val }),
                            success: function (r) {
                                _statusPatient.status = r.status;
                                if (grid) { grid.dataSource.read(); }
                            }
                        });
                    }
                },
                { text: "Cancel" }
            ]
        });
    }

    var dlg = $("#change-status-dialog").data("kendoDialog");
    dlg.title("Change Status — " + kendo.htmlEncode(patient.name));
    dlg.content(
        '<div class="dialog-field" style="padding:0">' +
            '<p style="color:#555;font-size:14px;margin-bottom:16px">Select new status for <strong>' +
                kendo.htmlEncode(patient.name) +
            '</strong>:</p>' +
            '<label class="dialog-label">Status</label>' +
            '<select id="new-status-ddl" style="width:100%"></select>' +
        '</div>'
    );
    dlg.open();
}

/* ═══════════════════════════════════════════════════════
   GRID INIT
═══════════════════════════════════════════════════════ */
function initGrid() {
    grid = $("#patients-grid").kendoGrid({
        dataSource: new kendo.data.DataSource({
            pageSize: 10,
            transport: {
                read: {
                    url:      "/api/patients",
                    dataType: "json"
                }
            },
            schema: {
                model: {
                    id: "id",
                    fields: {
                        id:        { type: "string",  editable: false },
                        name:      { type: "string",  editable: false },
                        age:       { type: "number",  editable: false },
                        gender:    { type: "string",  editable: false },
                        bloodType: { type: "string",  editable: false },
                        ward:      { type: "string",  editable: false },
                        diagnosis: { type: "string",  editable: false },
                        status:    { type: "string",  editable: false },
                        doctor:    { type: "string",  editable: false }
                    }
                }
            },
            requestEnd: function (e) {
                if (e.type === "read" && e.response) {
                    patientsData = e.response;

                    $("#page-content").removeClass("page-loading").addClass("page-ready");

                    // Handle cross-page navigation — e.g. arriving from Home page
                    var pendingId = sessionStorage.getItem("openPatientId");
                    if (pendingId) {
                        sessionStorage.removeItem("openPatientId");
                        var target = patientsData.find(function (p) { return p.id === pendingId; });
                        if (target) { openPatientDrilldown(target); }
                    }
                }
            }
        }),
        columns: [
            {
                field: "name",
                title: "Patient Name",
                template: '<div class="patient-name-cell">' +
                    '<img src="#: avatar #" loading="lazy" class="patient-avatar-sm" onerror="this.src=\'/content/patient-images/women/aiony-haust-3TLl_97HNJo-unsplash.jpg\'" />' +
                    '<div><strong>#: name #</strong></div></div>',
                width: 185
            },
            { field: "age",       title: "Age",        width: 110 },
            {
                field: "status",
                title: "Status",
                width: 130,
                template: '<span class="k-badge-status" data-status="#: status #"></span>'
            },
            { field: "gender",    title: "Gender",     width: 90 },
            { field: "bloodType", title: "Blood Type", width: 105 },
            { field: "ward",      title: "Ward",       width: 160 },
            { field: "diagnosis", title: "Diagnosis",  width: 200 },
            {
                title:      "Actions",
                width:      130,
                filterable: false,
                sortable:   false,
                groupable:  false,
                template:   '<button class="btn-view-patient" data-id="#: id #">View Profile</button>'
            }
        ],
        sortable:    true,
        filterable:  { mode: "row" },
        reorderable: true,
        resizable:   true,
        columnMenu:  false,
        pageable: {
            pageSize:  13,
            pageSizes: [10, 13, 20, 50],
            refresh:   true
        },
        excel: {
            fileName: "Patients.xlsx",
            allPages: true
        },
        dataBound: onGridDataBound
    }).data("kendoGrid");
}

function onGridDataBound() {
    var widget = this;
    initKendoStatusBadges(widget.tbody);
    // Init View Profile buttons
    widget.tbody.find(".btn-view-patient:not(.k-button)").each(function () {
        $(this).kendoButton({
            icon:     "eye",
            text:     "View Profile",
            fillMode: "flat",
            rounded:  "large",
            size:     "small"
        });
    });
    // Remove any previous row-level double-click
    widget.tbody.find("tr[role='row']").off("dblclick.drill");
    // Double-click the patient name cell → open preview panel
    widget.tbody.find(".patient-name-cell").off("dblclick.preview").on("dblclick.preview", function (e) {
        e.stopPropagation();
        var row     = $(this).closest("tr");
        var dataItem = widget.dataItem(row);
        var patient  = getFullPatient(dataItem.id || dataItem.get("id"));
        if (patient) {
            $("#list-ai-panel").hide();
            $("#patients-list-body").removeClass("ai-panel-open");
            openPatientPreview(patient);
        }
    });

    syncPatientsSidePanelHeights();
}
/* ═══════════════════════════════════════════════════════
   DOCUMENT READY
═══════════════════════════════════════════════════════ */
$(document).ready(function () {

    // Grid
    initGrid();

    // Breadcrumb back navigation
    $(document).on("click", "#breadcrumb-back", function () {
        closePatientDrilldown();
    });

    // Export
    $("#btn-export").kendoButton({
        icon:    "download",
        rounded: "large",
        click: function () { grid.saveAsExcel(); }
    });

    // AI Assistance toggle
    $("#btn-ai-assistance").kendoButton({
        icon:    "sparkles",
        rounded: "large",
        click: function () {
            var aiPanelOpen;

            // If the user is on the patient detail view, navigate back to the grid first
            if ($("#patients-detail-view").is(":visible")) {
                closePatientDrilldown();
                aiPanelOpen = false;
            } else {
                aiPanelOpen = $("#list-ai-panel").is(":visible");
            }

            aiPanelOpen = !aiPanelOpen;

            if (aiPanelOpen) {
                closePatientPreview();
                initListAiChat();
                $("#list-ai-date").text(kendo.toString(new Date(), "dddd, MMMM dd, yyyy"));
                $("#list-ai-panel").show();
                $("#patients-list-body").addClass("ai-panel-open");
                syncPatientsSidePanelHeights();
                if (grid) { kendo.resize($("#patients-grid")); }
            } else {
                $("#list-ai-panel").hide();
                $("#patients-list-body").removeClass("ai-panel-open");
                clearPatientsSidePanelHeights();
                if (grid) { kendo.resize($("#patients-grid")); }
            }
        }
    });

    $(window).on("resize.patientsPanels", syncPatientsSidePanelHeights);

    // Close patient preview panel
    $(document).on("click", "#btn-close-preview", function () {
        closePatientPreview();
    });

    // Allergy details link in patient preview panel
    $(document).on("click", ".pp-details-link", function (e) {
        e.preventDefault();
        if (!previewPatient) return;
        openAllergyDetailsDialog(previewPatient);
    });

    // View Profile link in grid (delegated)
    $(document).on("click", ".btn-view-patient", function (e) {
        e.stopPropagation();
        var id      = $(this).data("id");
        var patient = getFullPatient(id);
        if (patient) { openPatientDrilldown(patient); }
    });

    // Hash-based deep link: patients.html#P-1003 opens that patient directly
    function handleLocationHash() {
        var hash = window.location.hash.replace("#", "").trim();
        if (!hash) return;
        var patient = getFullPatient(hash) || findPatient(hash);
        if (patient) {
            window.location.hash = "";
            openPatientDrilldown(patient);
        }
    }

    handleLocationHash();
    $(window).on("hashchange", handleLocationHash);
    $(window).on("pagehide beforeunload", hideNotesAiPrompt);

});
