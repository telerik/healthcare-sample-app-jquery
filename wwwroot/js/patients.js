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
var listAiReady      = false;
var _aiAssistant    = {
        id: "ai-assistant",
        name: "AI Assistant"
};
 var _aiUser         = {
        id: "dr-carter",
        name: "Dr. Carter",
        iconUrl: "/content/patient-images/women/thumb/michael-dam-mEZ3PoFGs_k-unsplash.jpg"
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
    listAiChat.loading(true);
    setTimeout(function () {
        listAiChat.loading(false);
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
        headerItems: [
            {
                type: "contentItem",
                template: function () { return kendo.ui.icon({ icon: "sparkles", size: "medium" }); }
            },
            {
                type: "contentItem",
                template: function () { return "<strong>AI Assistant</strong>"; }
            },
            { type: "spacer" }
        ],
        messages: { placeholder: "Ask AI about patients\u2026" },
        suggestionsBehavior: "insert",
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
    currentPatient = patient;
    renderPatientDetail(patient);
    $("#patients-list-view").hide();
    $("#patients-breadcrumb").show();
    $("#patients-detail-view").show();
    window.scrollTo(0, 0);
}

function closePatientDrilldown() {
    // Save editor content back to patient object
    if (notesEditor && currentPatient) {
        currentPatient.notes = notesEditor.value();
    }
    $("#patients-detail-view").hide();
    $("#patients-breadcrumb").hide();
    $("#patients-list-view").show();
    // Refresh grid only if a status was changed
    //if (grid && grid._statusDirty) {
    //    grid._statusDirty = false;
    //    // Invalidate the shared cache so the grid re-fetches fresh data
    //    sharedPatients = [];
    //    grid.dataSource.read();
    //}
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
        '<div class="k-card profile-info-card">' +
            '<div class="k-card-body">' +
            '<div class="profile-info-header">' +
                '<img src="' + patient.avatar.replace('/thumb/', '/') + '" alt="' + kendo.htmlEncode(patient.name) + '" class="patient-avatar-profile" />' +
                '<div class="profile-name-status">' +
                    '<span class="profile-patient-name">' + kendo.htmlEncode(patient.name) + '</span>' +
                    '<span class="k-chip-status" data-status="' + kendo.htmlEncode(patient.status) + '"></span>' +
                '</div>' +
            '</div>' +
            '<p class="profile-basic-heading">Basic Information</p>' +
            infoRow('Patient ID', '<strong>' + patient.id + '</strong>', false) +
            infoRow('Age/Gender', '<strong>' + patient.age + ' years, ' + patient.gender + '</strong>', false) +
            '</div>' +
        '</div>';

    // ── Card 2: Recent Vitals ─────────────────────────────────────
    var rrVal    = vi.rr || 16;
    var vitalsCardHtml =
        '<div class="k-card profile-section-card">' +
            '<div class="k-card-body">' +
            '<p class="profile-section-heading">Recent Vitals</p>' +
            infoRow('Heart Rate',       vi.hr   + ' bpm',          vi.hr > 100 || vi.hr < 60) +
            infoRow('Blood Pressure',   vi.bp.replace(' mmHg', ''), vi.systolic > 140)         +
            infoRow('Temperature',      vi.temp + '\u00B0F',        vi.temp > 99.5)             +
            infoRow('O2 Saturation',    vi.spo2 + '%',              vi.spo2 < 94)               +
            infoRow('Respiratory Rate', rrVal   + ' breaths/min',   rrVal > 20 || rrVal < 12)  +
            '</div>' +
        '</div>';

    // ── Card 3: Admission Details ─────────────────────────────────
    var admissionCardHtml =
        '<div class="k-card profile-section-card">' +
            '<div class="k-card-body">' +
            '<p class="profile-section-heading">Admission Details</p>' +
            infoRow('Department',     kendo.htmlEncode(adm.department    || patient.ward),      false) +
            infoRow('Ward',           kendo.htmlEncode(adm.wardUnit      || patient.ward),      false) +
            infoRow('Room',           kendo.htmlEncode(adm.room ? String(adm.room) : '\u2014'), false) +
            infoRow('Admission Date', kendo.htmlEncode(adm.admissionDate || patient.lastVisit), false) +
            infoRow('Assigned Nurse', kendo.htmlEncode(adm.assignedNurse || '\u2014'),          false) +
            '</div>' +
        '</div>';

    // ── Patient Note card ─────────────────────────────────────────
    var notesCardHtml =
        '<div class="k-card profile-note-card">' +
            '<div class="k-card-header detail-card-header-row">' +
                '<span class="k-card-title detail-card-header-text">Patient Note</span>' +
                '<button id="btn-save-patient-note" class="detail-save-btn">Save</button>' +
            '</div>' +
            '<div class="k-card-body">' +
                '<textarea id="patient-notes-editor"></textarea>' +
            '</div>' +
        '</div>';

    // ── Labs card ─────────────────────────────────────────────────
    var labsCardHtml =
        '<div class="k-card profile-labs-card">' +
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
        rounded: "large",
        click: function (e) {
            if (notesEditor && currentPatient) {
                var noteVal = notesEditor.value();
                currentPatient.notes = noteVal;
                var $btn = $(e.event.currentTarget);
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
        }
    });

    // Initialize editor
    var existingEditor = $("#patient-notes-editor").data("kendoEditor");
    if (existingEditor) { existingEditor.destroy(); }
    notesEditor = $("#patient-notes-editor").kendoEditor({
        tools: [
            "bold", "italic", "underline", "strikethrough",
            "justifyLeft", "justifyCenter", "justifyRight", "justifyFull",
            "fontName", "formatting", "fontSize"
        ],
        value: patient.notes || ""
    }).data("kendoEditor");
}

/* ═══════════════════════════════════════════════════════
   PATIENT LABS GRID
═══════════════════════════════════════════════════════ */
function initPatientLabsGrid(patient) {
    var existing = $("#patient-labs-grid").data("kendoGrid");
    if (existing) { existing.destroy(); }

    // Labs are already enriched by the server (reference, status, note)
    var labData = patient.labs || [];

    $("#patient-labs-grid").kendoGrid({
        dataSource: new kendo.data.DataSource({
            data: labData,
            pageSize: 10
        }),
        sortable:  true,
        pageable: {
            pageSizes:    [5, 12, 20],
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
                template: ({ status }) => `<span class="k-badge-status" data-status="${kendo.htmlEncode(status)}"></span>`
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

    return '<div class="k-card-header pp-header">' +
            '<h2 class="k-card-title pp-title">Patient Preview</h2>' +
            '<button class="pp-close-btn" id="btn-close-preview" aria-label="Close">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#232A36" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
        '</div>' +
        '<div class="k-card-body pp-body">' +
            '<div class="pp-avatar-row">' +
                '<img src="' + patient.avatar + '" class="pp-avatar" onerror="this.src=\'/content/patient-images/women/thumb/aiony-haust-3TLl_97HNJo-unsplash.jpg\'" />' +
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
            '<div class="k-card pp-info-card">' +
                '<div class="k-card-header"><h3 class="k-card-title">Basic Information</h3></div>' +
                '<div class="k-card-body">' +
                    ppRow('Age / Gender', patient.age + ' / ' + (patient.gender === 'Male' ? 'M' : 'F'), false) +
                    ppRow('Ward',       kendo.htmlEncode(patient.ward),      false) +
                    ppRow('Diagnosis',  kendo.htmlEncode(patient.diagnosis), false) +
                    ppRow('Last Visit', kendo.htmlEncode(patient.lastVisit), false) +
                '</div>' +
            '</div>' +
            '<div class="k-card pp-info-card">' +
                '<div class="k-card-header"><h3 class="k-card-title">Recent Vitals</h3></div>' +
                '<div class="k-card-body">' +
                    ppRow('Heart Rate',     vi.hr + ' bpm',               vi.hr > 100 || vi.hr < 60) +
                    ppRow('Blood Pressure', vi.bp.replace(' mmHg', ''),   vi.systolic > 140) +
                    ppRow('Temperature',    vi.temp + '\u00B0F',           vi.temp > 99.5) +
                    ppRow('O2 Saturation',  vi.spo2 + '%',                vi.spo2 < 94) +
                '</div>' +
            '</div>' +
            '<div class="k-card pp-info-card">' +
                '<div class="k-card-header"><h3 class="k-card-title">Admission Details</h3></div>' +
                '<div class="k-card-body">' +
                    ppRow('Department',     kendo.htmlEncode(adm.department    || patient.ward),      false) +
                    ppRow('Ward',           kendo.htmlEncode(adm.wardUnit      || patient.ward),      false) +
                    ppRow('Room',           kendo.htmlEncode(adm.room ? String(adm.room) : '\u2014'), false) +
                    ppRow('Admission Date', kendo.htmlEncode(adm.admissionDate || patient.lastVisit), false) +
                    ppRow('Assigned Nurse', kendo.htmlEncode(adm.assignedNurse || '\u2014'),          false) +
                '</div>' +
            '</div>' +
        '</div>';
}

function openPatientPreview(patient) {
    previewPatient = patient;
    $("#patient-preview-panel").html(buildPatientPreviewHtml(patient)).css("display", "flex");
    $("#patients-list-body").addClass("preview-panel-open");
    updateGridHeightVar();
    deferGridResize();
}

function closePatientPreview() {
    previewPatient = null;
    $("#patient-preview-panel").css("display", "none").empty();
    $("#patients-list-body").removeClass("preview-panel-open");
    deferGridResize();
}

/* Reads the grid card height once and sets a CSS custom property so
   side panels can size themselves without repeated JS measurement. */
function updateGridHeightVar() {
    var h = $(".patients-grid-card:visible").outerHeight();
    if (h) {
        $("#patients-list-body")[0].style.setProperty("--patients-grid-height", h + "px");
    }
}

/* Defers kendo.resize so it doesn't block the current frame. */
var _resizeTimer = 0;
function deferGridResize() {
    cancelAnimationFrame(_resizeTimer);
    _resizeTimer = requestAnimationFrame(function () {
        if (grid) { kendo.resize($("#patients-grid")); }
    });
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
                                if (grid) { grid._statusDirty = true; }
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
                read: function (options) {
                    // Reuse the shared patient data already fetched by ensurePatientSearchData()
                    // to avoid a duplicate /api/patients round-trip on page load.
                    ensurePatientSearchData().done(function (patients) {
                        var data = Array.isArray(patients) ? patients : (patients[0] || []);
                        options.success(data);
                    }).fail(function () {
                        options.error({});
                    });
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
                template: ({ avatar, name }) => `<div class="patient-name-cell"><img src="${kendo.htmlEncode(avatar)}" loading="lazy" class="patient-avatar-sm" onerror="this.src='/content/patient-images/women/thumb/aiony-haust-3TLl_97HNJo-unsplash.jpg'" /><div><strong>${kendo.htmlEncode(name)}</strong></div></div>`,
                width: 185
            },
            { field: "age",       title: "Age",        width: 110 },
            {
                field: "status",
                title: "Status",
                width: 130,
                template: ({ status }) => `<span class="k-badge-status" data-status="${kendo.htmlEncode(status)}"></span>`
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
                template:   ({ id }) => `<a class="btn-view-patient grid-view-link" data-id="${kendo.htmlEncode(id)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>View Profile</a>`
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
    // View Profile links — use event delegation instead of per-row widget init

    // Bind double-click once on tbody via delegation (survives re-renders)
    if (!widget._dblClickBound) {
        widget._dblClickBound = true;
        widget.tbody.on("dblclick", ".patient-name-cell", function (e) {
            e.stopPropagation();
            var row      = $(this).closest("tr");
            var dataItem = widget.dataItem(row);
            var patient  = getFullPatient(dataItem.id || dataItem.get("id"));
            if (patient) {
                $("#list-ai-panel").hide();
                $("#patients-list-body").removeClass("ai-panel-open");
                openPatientPreview(patient);
            }
        });
    }

    updateGridHeightVar();

    // Reveal page now that all widgets (grid buttons, badges) are styled
    $("#page-content").removeClass("page-loading").addClass("page-ready");
}
/* ═══════════════════════════════════════════════════════
   DOCUMENT READY
═══════════════════════════════════════════════════════ */
$(document).ready(function () {

    // Initialize header buttons FIRST so they are Kendo-styled before the
    // page becomes visible (page-ready is applied after grid dataBound).

    // Breadcrumb back navigation
    $("#breadcrumb-back").kendoButton({
        fillMode: "flat",
        click: function () {
            closePatientDrilldown();
        }
    });

    // Export
    if (!$("#btn-export-patients").data("kendoButton")) {
        $("#btn-export-patients").kendoButton({
            icon:    "download",
            rounded: "large",
            click: function () {
                var g = $("#patients-grid").data("kendoGrid");
                if (g) { g.saveAsExcel(); }
            }
        });
    }

    // AI Assistance toggle
    if (!$("#btn-ai-assistance").data("kendoButton")) {
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
                    $("#list-ai-panel").show();
                    $("#patients-list-body").addClass("ai-panel-open");
                    updateGridHeightVar();
                    deferGridResize();
                } else {
                    $("#list-ai-panel").hide();
                    $("#patients-list-body").removeClass("ai-panel-open");
                    deferGridResize();
                }
            }
        });
    }

    // Grid (data fetch + render happens async; dataBound applies page-ready)
    initGrid();

    // Initialize AI Chat once (hidden until toggled)
    initListAiChat();

    $(window).on("resize.patientsPanels", function () {
        updateGridHeightVar();
    });

    // Close preview & allergy details — delegated since content is dynamic
    $(document).on("click", "#btn-close-preview", function () {
        closePatientPreview();
    });

    $(document).on("click", ".pp-details-link", function (e) {
        e.preventDefault();
        if (!previewPatient) return;
        openAllergyDetailsDialog(previewPatient);
    });

    // View Profile in preview panel — delegated for the dynamically rendered link
    $(document).on("click", ".pp-view-profile-link.btn-view-patient", function (e) {
        e.stopPropagation();
        var id      = $(this).data("id");
        var patient = getFullPatient(id);
        if (patient) { openPatientDrilldown(patient); }
    });

    // View Profile in grid — delegated for dynamically rendered links
    $(document).on("click", ".grid-view-link.btn-view-patient", function (e) {
        e.stopPropagation();
        e.preventDefault();
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

});
