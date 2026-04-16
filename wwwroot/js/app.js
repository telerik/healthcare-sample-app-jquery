$(document).ready(function () {

    /* ═══════════════════════════════════════════════
       DATA  — loaded remotely from /api
    ═════════════════════════════════════════════ */
    var patientsData     = [];
    var appointmentsData = [];
    var alertsData       = [];
    var labTests         = sharedLabCatalogue;
    var _currentAlertIdx = null;

    /* ═══════════════════════════════════════════════
       GREETING DATE
    ═══════════════════════════════════════════════ */
    $("#today-date").text(kendo.toString(new Date(), "dddd, MMMM dd, yyyy"));
    kendo.ui.icon($(".open-link"), { icon: 'hyperlink-open-sm' });
    kendo.ui.icon($(".appt-time-icon"), { icon: 'clock' });
    

    $("#appointments-grid").kendoGrid({
        dataSource: new kendo.data.DataSource({
            transport: {
                read: {
                    url:      "/api/today-appointments",
                    dataType: "json"
                }
            },
            requestEnd: function (e) {
                if (e.type === "read" && e.response) {
                    appointmentsData = e.response;
                    $("#page-content").removeClass("page-loading").addClass("page-ready");
                    _initAiPanel();
                }
            },
            schema: {
                model: {
                    fields: {
                        time:        { type: "string" },
                        patientName: { type: "string" },
                        reason:      { type: "string" },
                        status:      { type: "string" },
                        room:        { type: "string" }
                    }
                }
            }
        }),
        columns: [
            { field: "time",        title: "Time",         width: 105 },
            { field: "patientName", title: "Patient Name", width: 165 },
            { field: "reason",      title: "Reason" },
            {
                field: "status", title: "Status", width: 130,
                template: ({ status }) => `<span class="k-badge-status" data-status="${kendo.htmlEncode(status)}"></span>`
            },
            { field: "room",  title: "Room", width: 125 }
        ],
        sortable: true,
        pageable: false,
        scrollable: true,
        height: 600,
        dataBound: function () {
            initKendoStatusBadges(this.tbody);
        }
    });

    /* ═══════════════════════════════════════════════
       DAILY ALERTS + PATIENTS — loaded together
    ═════════════════════════════════════════════ */
    function renderAlertsList() {
        var chevron = kendo.ui.icon({ type: "svg", icon: "chevron-right" });
        var html = alertsData.map(function (a, idx) {
            return '<div class="k-card alert-card" data-alert-idx="' + idx + '">' +
                   '  <div class="k-card-body alert-card-body">' +
                   '    <div class="k-card-title alert-card-title">' + kendo.htmlEncode(a.title) + '</div>' +
                   '    <div class="alert-card-meta">' +
                   '      <span class="alert-card-time">' + kendo.htmlEncode(a.time) + '</span>' +
                   '      <span class="alert-review" data-alert-idx="' + idx + '">Review ' + chevron + '</span>' +
                   '    </div>' +
                   '  </div>' +
                   '</div>';
        }).join('');
        $("#alerts-list").html(html || '<div class="k-card alert-card"><div class="k-card-body alert-card-body" style="color:#888">No active alerts.</div></div>');
    }

    $.when(
        $.getJSON("/api/alerts"),
        ensurePatientSearchData()
    ).done(function (alertsResp, patients) {
        alertsData   = alertsResp[0];
        patientsData = Array.isArray(patients[0]) ? patients[0] : (Array.isArray(patients) ? patients : []);
        renderAlertsList();
        _initAiPanel();
    });

    /* ═══════════════════════════════════════════════
       ALERT METADATA (descriptions & types)
    ═══════════════════════════════════════════════ */
    var _alertMeta = {
        "CRP elevated":             { type: "Lab Result",  desc: "C-Reactive Protein (CRP) levels are significantly elevated at 45 mg/L (normal: <10 mg/L), indicating acute inflammation or infection." },
        "Blood pressure high":      { type: "Vital Sign",  desc: "Systolic blood pressure has exceeded the safe threshold, indicating hypertensive urgency requiring immediate evaluation." },
        "Glucose levels elevated":  { type: "Lab Result",  desc: "Fasting blood glucose levels are elevated above the normal range (70\u2013100 mg/dL), suggesting poor glycaemic control requiring review." },
        "High cholesterol detected":{ type: "Lab Result",  desc: "LDL cholesterol levels are significantly elevated above the optimal range (<100 mg/dL), increasing cardiovascular risk." },
        "Oxygen saturation low":    { type: "Vital Sign",  desc: "SpO\u2082 has dropped below 92%, indicating potential respiratory compromise. Supplemental oxygen and monitoring recommended." },
        "Potassium level abnormal": { type: "Lab Result",  desc: "Serum potassium levels are outside the normal range (3.5\u20135.0 mEq/L), presenting risk of cardiac arrhythmia." },
        "Heart rate irregular":     { type: "Vital Sign",  desc: "Irregular heart rhythm detected with significant rate fluctuations. ECG monitoring and cardiology consultation recommended." },
        "Creatinine elevated":      { type: "Lab Result",  desc: "Serum creatinine levels are elevated above the normal range (0.6\u20131.2 mg/dL), indicating potential renal function decline." },
        "Temperature spike noted":  { type: "Vital Sign",  desc: "Core temperature has risen above normal, indicating a possible infectious process. Further evaluation advised." },
        "HbA1c above target":       { type: "Lab Result",  desc: "HbA1c measured above target (<7%), indicating suboptimal long-term glucose control. Therapy adjustment recommended." },
        "Sodium level low":         { type: "Lab Result",  desc: "Serum sodium is below the normal range (135\u2013145 mEq/L), indicating hyponatraemia. Fluid balance review and electrolyte replacement may be required." },
        "INR out of range":         { type: "Lab Result",  desc: "InternationalNormalised Ratio is outside the therapeutic range, increasing the risk of bleeding or thromboembolic events. Anticoagulation review required." },
        "Respiratory rate elevated":{ type: "Vital Sign",  desc: "Respiratory rate exceeds the normal range (12\u201320 breaths/min). Possible respiratory distress; further clinical assessment recommended." },
        "Hemoglobin low":           { type: "Lab Result",  desc: "Haemoglobin levels are below the normal threshold, indicating anaemia. Iron studies and further workup are advised." },
        "White cell count elevated":{ type: "Lab Result",  desc: "White blood cell count is elevated above normal (4.5\u201311.0 \u00d710\u00b3/\u00b5L), suggesting infection, inflammation, or haematological disorder." },
        "BMI critical range":       { type: "Vital Sign",  desc: "Body Mass Index has reached a critical threshold associated with increased cardiovascular and metabolic risk. Dietary and lifestyle review advised." },
        "Uric acid elevated":       { type: "Lab Result",  desc: "Serum uric acid is elevated above the normal range, increasing the risk of gout and uric acid nephropathy. Dietary modification and medication review recommended." }
    };

    function _alertInfo(title) {
        var base = (title || "").split(" \u2013 ")[0].split(" — ")[0].split(" - ")[0].trim();
        return _alertMeta[base] || { type: "Clinical", desc: kendo.htmlEncode(title) };
    }

    /* ═══════════════════════════════════════════════
       DIALOG — ALERT REVIEW
    ═══════════════════════════════════════════════ */
    $("#dialog-alert-review").kendoDialog({
        title:   " ",
        width:   560,
        modal:   true,
        visible: false,
        closable: true,
        draggable: { dragHandle: ".k-dialog-titlebar" },
        resizable: true,
        open: function () {
            applySharedDialogShell(this);
        },
        actions: [
            { text: "Close" },
            {
                text: "Mark as Resolved",
                primary: true,
                cssClass: "ar-resolve-btn",
                action: function () {
                    if (_currentAlertIdx !== null) {
                        alertsData.splice(_currentAlertIdx, 1);
                        _currentAlertIdx = null;
                        renderAlertsList();
                    }
                    return true;
                }
            }
        ]
    });

    $(document).on("click", ".alert-review", function () {
        var idx = parseInt($(this).data("alert-idx"), 10);
        var a   = alertsData[idx];
        if (!a) return;
        _currentAlertIdx = idx;
        var patient = patientsData.find(function (p) { return p.id === a.patientId; });
        var meta    = _alertInfo(a.title);
        var sevLabel = a.severity === "critical" ? "High" : "Medium";
        var sevClass = a.severity === "critical" ? "ar-badge-high" : "ar-badge-medium";

        var content =
            '<div class="ar-content">' +
            /* ── Header ── */
            '  <div class="ar-header">' +
            '    <span class="ar-icon">' +
            '      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">' +
            '        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' +
            '      </svg>' +
            '    </span>' +
            '    <div>' +
            '      <div class="ar-title">Alert Review</div>' +
            '      <div class="ar-time">' + kendo.htmlEncode(a.time) + '</div>' +
            '    </div>' +
            '  </div>' +
            /* ── Badges ── */
            '  <div class="ar-badges">' +
            '    <span class="ar-badge ' + sevClass + '">' + sevLabel + '</span>' +
            '    <span class="ar-badge ar-badge-type">' + kendo.htmlEncode(meta.type) + '</span>' +
            '  </div>' +
            /* ── Alert Details ── */
            '  <div class="ar-details">' +
            '    <div class="ar-details-title">Alert Details</div>' +
            '    <p class="ar-details-text">' + kendo.htmlEncode(meta.desc) + '</p>' +
            '  </div>' +
            '  <hr class="ar-divider"/>' +
            /* ── Patient Information ── */
            (patient ? (
            '  <div class="ar-patient-header">' +
            '    <svg class="ar-patient-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>' +
            '    </svg>' +
            '    <span class="ar-patient-heading">Patient Information</span>' +
            '    <a class="ar-profile-link" href="#" data-patient-id="' + kendo.htmlEncode(patient.id) + '">View Full Profile \u2192</a>' +
            '  </div>' +
            '  <div class="ar-patient-card">' +
            '    <div class="ar-patient-name">' + kendo.htmlEncode(patient.name) + '</div>' +
            '    <div class="ar-patient-id">Patient ID: ' + kendo.htmlEncode(patient.id) + '</div>' +
            '    <div class="ar-vitals-label">Current Vitals</div>' +
            '    <div class="ar-vitals-grid">' +
            '      <div class="ar-vital"><span class="ar-vital-icon ar-vital-icon-bp">' +
            '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' +
            '      </span><div><div class="ar-vital-label">Blood Pressure</div><div class="ar-vital-value">' + kendo.htmlEncode(patient.vitals.bp.replace(" mmHg","")) + '</div></div></div>' +
            '      <div class="ar-vital"><span class="ar-vital-icon ar-vital-icon-hr">' +
            '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>' +
            '      </span><div><div class="ar-vital-label">Heart Rate</div><div class="ar-vital-value">' + patient.vitals.hr + ' bpm</div></div></div>' +
            '      <div class="ar-vital"><span class="ar-vital-icon ar-vital-icon-temp">' +
            '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></svg>' +
            '      </span><div><div class="ar-vital-label">Temperature</div><div class="ar-vital-value">' + patient.vitals.temp + '\u00b0F</div></div></div>' +
            '      <div class="ar-vital"><span class="ar-vital-icon ar-vital-icon-spo2">' +
            '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16.5A5.5 5.5 0 0112.5 11h0A5.5 5.5 0 0118 16.5c0 3-2.5 5.5-5.5 5.5S7 19.5 7 16.5z"/><path d="M12.5 2v9"/></svg>' +
            '      </span><div><div class="ar-vital-label">Oxygen Sat.</div><div class="ar-vital-value">' + patient.vitals.spo2 + '%</div></div></div>' +
            '    </div>' +
            '  </div>'
            ) : '') +
            '</div>';

        var dlg = $("#dialog-alert-review").data("kendoDialog");
        dlg.content(content);
        dlg.open();
    });

    $(document).on("click", ".ar-profile-link", function (e) {
        e.preventDefault();
        var patientId = $(this).data("patient-id");
        if (patientId) {
            sessionStorage.setItem("openPatientId", patientId);
            window.location.href = "/patients";
        }
    });

    /* ═══════════════════════════════════════════════
       DIALOG — REASON FOR VISIT
    ═══════════════════════════════════════════════ */
    $("#dialog-reason-visit").kendoDialog({
        title:   "Reason for Visit — Details",
        width:   460,
        modal:   true,
        visible: false,
        draggable: { dragHandle: ".k-dialog-titlebar" },
        resizable: true,
        open: function () {
            applySharedDialogShell(this);
        },
        content: '<div class="info-dialog">' +
                 '  <div class="info-dialog-section">' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Patient</span><span>Lucas Brown</span></div>' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Age / Gender</span><span>32 years, Male</span></div>' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Chief Complaint</span><span>Post-operative pain management</span></div>' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Duration</span><span>Following surgery on Mar 18, 2026</span></div>' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Appointment</span><span>Today at 10:00 AM</span></div>' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Doctor</span><span>Dr. Lee</span></div>' +
                 '  </div>' +
                 '  <div class="info-dialog-section">' +
                 '    <div class="info-dialog-section-title">Visit History</div>' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Mar 18, 2026</span><span>Surgical procedure — Anesthesiology</span></div>' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Jan 10, 2026</span><span>Pre-operative assessment</span></div>' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Oct 05, 2025</span><span>Annual physical exam</span></div>' +
                 '  </div>' +
                 '</div>',
        actions: [{ text: "Close" }]
    });

    $("#link-reason-details").kendoButton({
        fillMode: "link",
        click: function () {
            $("#dialog-reason-visit").data("kendoDialog").open();
        }
    });
    $("#link-reason-details .detail-link-icon").html(kendo.ui.icon({ type: "svg", icon: "chevron-right" }));

    /* ═══════════════════════════════════════════════
       DIALOG — ALLERGY DETAILS
    ═══════════════════════════════════════════════ */
    $("#dialog-allergy-details").kendoDialog({
        title:   "Allergy Alert — Details",
        width:   420,
        modal:   true,
        visible: false,
        draggable: { dragHandle: ".k-dialog-titlebar" },
        resizable: true,
        open: function () {
            applySharedDialogShell(this);
            initKendoChips(this.element);
        },
        content: '<div class="info-dialog">' +
                 '  <div class="info-dialog-section">' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Patient</span><span>Emma Johnson</span></div>' +
                 '    <div class="info-dialog-row"><span class="info-dialog-label">Blood Type</span><span>A+</span></div>' +
                 '  </div>' +
                 '  <div class="info-dialog-section">' +
                 '    <div class="info-dialog-section-title">Known Allergens</div>' +
                 '    <span class="k-chip-allergy" data-label="Penicillin"></span>' +
                 '    <span class="k-chip-allergy" data-label="NSAIDs"></span>' +
                 '    <div class="info-dialog-note">Please review before prescribing any medication.</div>' +
                 '  </div>' +
                 '</div>',
        actions: [{ text: "Close" }]
    });

    $("#link-allergy-details").kendoButton({
        fillMode: "link",
        click: function () {
            $("#dialog-allergy-details").data("kendoDialog").open();
        }
    });
    $("#link-allergy-details .detail-link-icon").html(kendo.ui.icon({ type: "svg", icon: "chevron-right" }));

    /* ═══════════════════════════════════════════════
       DIALOG — NEW NOTE
    ═══════════════════════════════════════════════ */
    $("#dialog-new-note").kendoDialog({
        title: "New Clinical Note",
        visible: false,
        width: 690,
        modal: true,
        closable: true,
        draggable: { dragHandle: ".k-dialog-titlebar" },
        resizable: true,
        buttonLayout: "normal",
        actions: [
            {
                text: "Discard",
                action: function () {
                    var ta = $("#note-textarea").data("kendoTextArea");
                    if (ta) ta.value("");
                    var ddl = $("#note-patient-ddl").data("kendoDropDownList");
                    if (ddl) ddl.select(0);
                    return true;
                }
            },
            {
                text: "Save note",
                primary: true,
                action: function () {
                    var ddl  = $("#note-patient-ddl").data("kendoDropDownList");
                    var ta   = $("#note-textarea").data("kendoTextArea");
                    var text = (ta ? ta.value() : "").trim();
                    if (!ddl || !ddl.value()) {
                        kendo.alert("Please select a patient.");
                        return false;
                    }
                    if (!text) {
                        kendo.alert("Please enter a clinical note.");
                        return false;
                    }
                    var patientId = ddl.value();
                    $.ajax({
                        url:         "/api/patients/" + patientId + "/add-note",
                        type:        "POST",
                        contentType: "application/json",
                        data:        JSON.stringify({ text: text }),
                        success: function () {
                            var cached = getPatientById(patientId);
                            if (cached) {
                                cached.notes = !cached.notes ? text : text + "\n" + cached.notes;
                            }
                        },
                        error: function () {
                            kendo.alert("Could not save the note. Please try again.");
                        }
                    });
                    kendo.alert("Clinical note for <strong>" + kendo.htmlEncode(ddl.text()) + "</strong> has been saved.");
                    if (ta) ta.value("");
                    return true;
                }
            }
        ],
        open: function () {
            applySharedDialogShell(this);
            this.center();
            if (!$("#note-patient-ddl").data("kendoDropDownList")) {
                $("#note-patient-ddl").kendoDropDownList({
                    dataSource: patientsData.map(function (p) { return { text: p.name + " (" + p.id + ")", value: p.id }; }),
                    dataTextField:  "text",
                    dataValueField: "value",
                    optionLabel: "Select patient...",
                    filter:   "contains",
                    rounded:  "large"
                });
                $("#note-patient-ddl").closest(".k-dropdownlist").css("width", "250px");
            }
            if (!$("#note-textarea").data("kendoTextArea")) {
                $("#note-textarea").kendoTextArea({
                    placeholder: "Add clinical notes, observations, treatment plans, etc.",
                    rows: 6,
                    resize: "both"
                });
            }
            setTimeout(function () {
                var ta = $("#note-textarea").data("kendoTextArea");
                if (ta) ta.focus();
            }, 100);
        }
    });

    $("#btn-new-note").kendoButton({
        rounded:    "full",
        fillMode:   "solid",
        themeColor: "dark",
        icon:       "plus",
        size: 'large',
        click: function () {
            $("#dialog-new-note").data("kendoDialog").open();
        }
    });

    /* ═══════════════════════════════════════════════
       DIALOG — REQUEST LAB TEST
    ═══════════════════════════════════════════════ */
    var selectedLabTests = [];

    var labTestDataSource = new kendo.data.DataSource({
        data: labTests.map(function (name) { return { name: name }; })
    });

    function labTestTemplate(dataItem) {
        var name = dataItem.name;
        var checked = selectedLabTests.indexOf(name) !== -1;
        return '<div class="k-card k-card-horizontal lab-test-item' + (checked ? ' selected' : '') + '" data-test="' + kendo.htmlEncode(name) + '">' +
                   '<input type="checkbox" class="lab-test-checkbox"' + (checked ? ' checked="checked"' : '') + ' />' +
                   '<span class="lab-test-name">' + kendo.htmlEncode(name) + '</span>' +
               '</div>';
    }

    function filterLabListView(query) {
        var q = (query || "").trim();
        if (q) {
            labTestDataSource.filter({ field: "name", operator: "contains", value: q });
        } else {
            labTestDataSource.filter({});
        }
    }

    $(document).on("input", "#lab-test-search", function () {
        var q = $(this).val();        
        filterLabListView(q);
    });

    $("#dialog-lab-test").kendoDialog({
        title: "Request Lab Tests",
        visible: false,
        width: 690,
        height: 560,
        modal: true,
        closable: true,
        draggable: { dragHandle: ".k-dialog-titlebar" },
        resizable: true,
        buttonLayout: "normal",
        actions: [
            {
                text: "Discard",
                action: function () {
                    selectedLabTests = [];
                    var tb = $("#lab-test-search").data("kendoTextBox");
                    if (tb) tb.value("");                    
                    var ddl = $("#lab-patient-ddl").data("kendoDropDownList");
                    if (ddl) ddl.select(0);
                    filterLabListView("");
                    return true;
                }
            },
            {
                text: "Send request",
                primary: true,
                action: function () {
                    var ddl = $("#lab-patient-ddl").data("kendoDropDownList");
                    if (!ddl || !ddl.value()) {
                        kendo.alert("Please select a patient.");
                        return false;
                    }
                    if (selectedLabTests.length === 0) {
                        kendo.alert("Please select at least one lab test.");
                        return false;
                    }
                    kendo.alert("Lab test request for <strong>" + kendo.htmlEncode(ddl.text()) + "</strong> has been sent.<br><br>Tests: " + kendo.htmlEncode(selectedLabTests.join(", ")));
                    selectedLabTests = [];
                    var tb = $("#lab-test-search").data("kendoTextBox");
                    if (tb) tb.value("");                    
                    filterLabListView("");
                    return true;
                }
            }
        ],
        open: function () {
            applySharedDialogShell(this);
            this.center();
            this.wrapper.closest(".k-dialog-wrapper").addClass("lab-request-dialog");
            if (!$("#lab-patient-ddl").data("kendoDropDownList")) {
                $("#lab-patient-ddl").kendoDropDownList({
                    dataSource: patientsData.map(function (p) { return { text: p.name + " (" + p.id + ")", value: p.id }; }),
                    dataTextField:  "text",
                    dataValueField: "value",
                    optionLabel: "Select patient...",
                    filter:   "contains",
                    rounded:  "large"
                });
            }
            if (!$("#lab-test-list").data("kendoListView")) {
                $("#lab-test-list").kendoListView({
                    dataSource: labTestDataSource,
                    template: labTestTemplate,
                    dataBound: function () {
                        this.element.find(".lab-test-checkbox").each(function () {
                            if (!$(this).data("kendoCheckBox")) {
                                $(this).kendoCheckBox({ rounded: "full" });
                            }
                        });
                    }
                });

                $("#lab-test-list").on("change", ".lab-test-checkbox", function () {
                    var $item = $(this).closest(".lab-test-item");
                    var name = $item.data("test");
                    var idx = selectedLabTests.indexOf(name);
                    if (this.checked && idx === -1) {
                        selectedLabTests.push(name);
                    } else if (!this.checked && idx !== -1) {
                        selectedLabTests.splice(idx, 1);
                    }
                    var isNowSelected = selectedLabTests.indexOf(name) !== -1;
                    $item.toggleClass("selected", isNowSelected);
                    var kendoCb = $(this).data("kendoCheckBox");
                    if (kendoCb) kendoCb.check(isNowSelected);
                });

                $("#lab-test-list").on("click", ".lab-test-item", function (e) {
                    if ($(e.target).is(".lab-test-checkbox, .k-checkbox")) return;
                    var chk = $(this).find(".lab-test-checkbox");
                    chk.prop("checked", !chk.prop("checked")).trigger("change");
                });
            }
            if (!$("#lab-test-search").data("kendoTextBox")) {
                $("#lab-test-search").kendoTextBox({
                    placeholder: "Search Lab Tests",
                    clearButton: true
                });
            }            
            
            var tb = $("#lab-test-search").data("kendoTextBox");
            if (tb) {
                tb.value("");
                tb.element.off("input.labfilter").on("input.labfilter", function () {
                    var q = $(this).val() || "";
                    filterLabListView(q);
                });
                tb.wrapper.off("click.labclear", ".k-clear-value").on("click.labclear", ".k-clear-value", function () {
                    setTimeout(function () {
                        filterLabListView("");
                    }, 0);
                });
            }
            selectedLabTests = [];
            filterLabListView("");
        }
    });

    $("#btn-lab-test").kendoButton({
        rounded:    "full",
        fillMode:   "solid",
        themeColor: "dark",
        icon:       "plus",
         size: 'large',
        click: function () {
            $("#dialog-lab-test").data("kendoDialog").open();
        }
    });

    /* ═══════════════════════════════════════════════
       DIALOG — MESSAGE NURSE (Chat)
    ═══════════════════════════════════════════════ */
    $("#dialog-nurse-chat").kendoDialog({
        title: "Message Nurse",
        visible: false,
        width: 690,
        height: 650,
        modal: true,
        closable: true,
        draggable: { dragHandle: ".k-dialog-titlebar" },
        resizable: true,
        buttonLayout: "normal",
        content:
            '<div class="nurse-msg-form">' +
                '<div class="nurse-msg-field">' +
                    '<label class="nurse-msg-label">To</label>' +
                    '<input id="nurse-msg-to" />' +
                '</div>' +
                '<div class="nurse-msg-field">' +
                    '<label class="nurse-msg-label">Subject</label>' +
                    '<input id="nurse-msg-subject" class="nurse-msg-input" />' +
                '</div>' +
                '<div class="nurse-msg-field">' +
                    '<label class="nurse-msg-label">Description</label>' +
                    '<textarea id="nurse-msg-body"></textarea>' +
                '</div>' +
            '</div>',
        actions: [
            {
                text: "Discard",
                action: function () {
                    var cb = $("#nurse-msg-to").data("kendoComboBox");
                    if (cb) cb.value("");
                    var subjectTb = $("#nurse-msg-subject").data("kendoTextBox");
                    if (subjectTb) subjectTb.value("");
                    var bodyTa = $("#nurse-msg-body").data("kendoTextArea");
                    if (bodyTa) bodyTa.value("");
                    return true;
                }
            },
            {
                text: "Send message",
                primary: true,
                action: function () {
                    var cb      = $("#nurse-msg-to").data("kendoComboBox");
                    var to      = cb ? cb.value().trim() : $("#nurse-msg-to").val().trim();
                    var subjectTb = $("#nurse-msg-subject").data("kendoTextBox");
                    var subject = subjectTb ? subjectTb.value().trim() : $("#nurse-msg-subject").val().trim();
                    var bodyTa = $("#nurse-msg-body").data("kendoTextArea");
                    var body    = bodyTa ? bodyTa.value().trim() : $("#nurse-msg-body").val().trim();
                    if (!to) { kendo.alert("Please specify a recipient."); return false; }
                    if (!subject) { kendo.alert("Please enter a subject."); return false; }
                    if (!body) { kendo.alert("Please enter a message."); return false; }
                    kendo.alert("Message to <strong>" + kendo.htmlEncode(to) + "</strong> has been sent.<br><br>Subject: " + kendo.htmlEncode(subject));
                    return true;
                }
            }
        ],
        open: function () {
            applySharedDialogShell(this);
            this.center();
            if (!$("#nurse-msg-to").data("kendoComboBox")) {
                $("#nurse-msg-to").kendoComboBox({
                    dataSource: [
                        { name: "Olivia Parker",  email: "oliviaparker@email.com" },
                        { name: "Amanda Reed",    email: "amandareed@email.com" },
                        { name: "Samuel Brooks",  email: "samuelbrooks@email.com" },
                        { name: "Nurse Station",  email: "nursestation@hospital.com" }
                    ],
                    dataTextField:  "email",
                    dataValueField: "email",
                    placeholder: "Recipient email",
                    filter:   "contains",
                    rounded:  "large"
                });
            }
            if (!$("#nurse-msg-subject").data("kendoTextBox")) {
                $("#nurse-msg-subject").kendoTextBox({
                    placeholder: "Subject"
                });
            }
            if (!$("#nurse-msg-body").data("kendoTextArea")) {
                $("#nurse-msg-body").kendoTextArea({
                    placeholder: "Write your message here...",
                    rows: 10,
                    resize: "both"
                });
            }
        }
    });

    $("#btn-nurse-chat").kendoButton({
        rounded:    "full",
        fillMode:   "solid",
        themeColor: "dark",
        icon:       "plus",
         size: 'large',
        click: function () {
            $("#dialog-nurse-chat").data("kendoDialog").open();
        }
    });

    /* ═══════════════════════════════════════════════
       NEXT PATIENT — ACTION BUTTONS
    ═══════════════════════════════════════════════ */
    $("#btn-view-schedule").kendoButton({
        rounded:    "full",
        fillMode:   "solid",
        themeColor: "dark",
        icon:       "plus",
         size: 'large',
    });

    $(".view-profile-link").kendoButton({
        fillMode: "link",
        click: function (e) {
            var pid = $(e.event.currentTarget).data("patient-id") || (_nextPt && _nextPt.id);
            if (pid) sessionStorage.setItem("openPatientId", pid);
            window.location.href = "/patients";
        }
    });

    /* ═══════════════════════════════════════════════
       AI ASSISTANT — DIALOG + FLOATING BUTTON
    ═══════════════════════════════════════════════ */
    var _aiInitialised  = false;
    var _aiDialogReady  = false;
    var _aiChatReady    = false;
    var _aiResponses    = {};
    var _nextPt         = null;
    var _fab            = null;
    var _aiUser         = {
        id: "dr-carter",
        name: "Dr. Carter",
        iconUrl: "/content/patient-images/women/thumb/michael-dam-mEZ3PoFGs_k-unsplash.jpg"
    };
    var _aiAssistant    = {
        id: "ai-assistant",
        name: "AI Assistant"
    };

    function _initAiPanel() {
        if (_aiInitialised || !patientsData.length || !appointmentsData.length) return;
        _aiInitialised = true;
        if (_fab) { $("#ai-float-btn").show(); }

        _nextPt = patientsData.find(function (p) { return p.id === "P-1001"; }) ||
                  (patientsData.length > 1 ? patientsData[1] : patientsData[0]);
        var _allergyPts = patientsData.filter(function (p) { return p.allergies && p.allergies.length > 0; });
        var _allergyText = _allergyPts.length > 0
            ? "Yes. " + _allergyPts.slice(0, 2).map(function (p) { return p.name + " (" + p.allergies.join(", ") + ")"; }).join(" and ") + " have documented allergies. Please review before prescribing."
            : "No patients with documented allergies are on today\u2019s schedule.";

        _aiResponses = {
            "Provide lab results for next patient":
                _nextPt.name + "'s latest labs: " + (_nextPt.labs.length > 0 ? _nextPt.labs.map(function (l) { return l.test + " " + l.result + " (" + l.flag + ")"; }).join(", ") : "No lab results on file") + ".",
            "Summary for next patient":
                _nextPt.name + ", " + _nextPt.age + "-year-old " + _nextPt.gender.toLowerCase() + ". Ward: " + _nextPt.ward + ". Diagnosis: " + _nextPt.diagnosis + ". Status: " + _nextPt.status + ". " + (_nextPt.allergies.length > 0 ? "Known allergies: " + _nextPt.allergies.join(", ") + "." : "No known allergies."),
            "How many patients do I have today?":
                "You have " + appointmentsData.length + " appointments scheduled today.",
            "Are there any allergic patients today?":
                _allergyText
        };
    }

    function _replyToAiMsg(text) {
        var chat = $("#ai-chat").data("kendoChat");
        if (!chat) return;     

        chat.loading(true);

        if (text === "Summary for next patient" && _nextPt) {
            setTimeout(function () {
                chat.loading(false);
                chat.postMessage({
                    authorId:   _aiAssistant.id,
                    authorName: _aiAssistant.name,
                    text:       "@@PATIENT_SUMMARY@@",
                    timestamp:  new Date()
                });
            }, 500);
            return;
        }

        var reply = _aiResponses[text] || "I\u2019m sorry, I don\u2019t have information on that right now.";
        setTimeout(function () {
            chat.loading(false);
            chat.postMessage({
                authorId:   _aiAssistant.id,
                authorName: _aiAssistant.name,
                type:       "text",
                text:       reply
            });
        }, 500);
    }

    function _initAiChatIfNeeded() {
        if (_aiChatReady) return;
        _aiChatReady = true;

        var aiChat = $("#ai-chat").kendoChat({
            height: 600,
            authorId: _aiUser.id,
            suggestions: [
                { text: "Summary for next patient" },
                { text: "Provide lab results for next patient" },
                { text: "How many patients do I have today?" },
                { text: "Are there any allergic patients today?" }
            ],
            headerItems: [
                {
                    type: "contentItem",
                    template: () => `${kendo.ui.icon({ icon: 'sparkles', size: 'medium' })}`,
                },
                {
                    type: "contentItem",
                    template: () => "<strong>AI Assistant</strong>",
                },
                { type: "spacer", name: "spacer" },
                {
                    type: "contentItem",
                    template: () =>
                        `<span class="close-chat">${kendo.ui.icon("x")}</span>`,
                },
            ],
            user: _aiUser,
            suggestionsBehavior: "insert",
            messageTemplate: function (message) {
                if (message.text === "@@PATIENT_SUMMARY@@" && _nextPt) {
                    var pt   = _nextPt;
                    var html = '<div class="ai-summary-msg">';
                    html += '<p class="ai-pt-intro">Hi there! I will give you important information regarding your next patient:</p>';
                    html += '<div class="ai-patient-card">';
                    html += '<p><strong>Name:</strong> '   + kendo.htmlEncode(pt.name)         + '</p>';
                    html += '<p><strong>Age:</strong> '    + kendo.htmlEncode(String(pt.age))   + ' years</p>';
                    html += '<p><strong>Gender:</strong> ' + kendo.htmlEncode(pt.gender)        + '</p>';
                    if (pt.allergies && pt.allergies.length) {
                        html += '<p><strong>Allergy:</strong> ' + kendo.htmlEncode(pt.allergies.join(", ")) + '</p>';
                    }
                    if (pt.visits && pt.visits.length) {
                        html += '<p class="ai-pt-section"><strong>Medical History:</strong></p><ul class="ai-pt-history">';
                        var maxV = Math.min(pt.visits.length, 3);
                        for (var i = 0; i < maxV; i++) {
                            html += '<li>' + kendo.htmlEncode(pt.visits[i].reason) + '</li>';
                        }
                        html += '</ul>';
                    }
                    if (pt.medications && pt.medications.length) {
                        html += '<p class="ai-pt-section"><strong>Current Medications:</strong></p><ul class="ai-pt-history">';
                        var maxM = Math.min(pt.medications.length, 3);
                        for (var j = 0; j < maxM; j++) {
                            var med = pt.medications[j];
                            html += '<li>' + kendo.htmlEncode(med.drug + ' ' + med.dose + ' ' + med.frequency) + '</li>';
                        }
                        html += '</ul>';
                    }
                    html += '</div>';
                    html += '<div class="ai-feedback-actions">' +
                        '<button class="ai-feedback-btn" title="Helpful">' +
                            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>' +
                        '</button>' +
                        '<button class="ai-feedback-btn" title="Not helpful">' +
                            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>' +
                        '</button>' +
                        '<button class="ai-feedback-btn" title="Regenerate">' +
                            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>' +
                        '</button>' +
                    '</div>';
                    html += '</div>';
                    return html;
                }
                // Bot messages → flat text (styled via CSS on .k-message-group-receiver)
                // User messages → bubble
                var encodedText = kendo.htmlEncode(message.text || "").replace(/\n/g, "<br>");
                return '<div class="ai-msg-content">' + encodedText + '</div>';
            },
            sendMessage: function (e) {
                if (!e.generating) {
                    _replyToAiMsg(e.message.text);
                    e.sender.scrollToBottom();
                }
            }
        }).data("kendoChat");

        aiChat.postMessage({
            authorId:   _aiAssistant.id,
            authorName: _aiAssistant.name,
            type:       "text",
            timestamp:  new Date(),
            text: "\uD83D\uDC4B Hello! I\u2019m your AI Assistant.\n\nI can help you with your daily clinical tasks, patient information, and quick actions. Try one of the suggestions below!"
        });
        aiChat.scrollToBottom();

        $("#ai-chat").on("click", ".close-chat", function () {
            var dlg = $("#dialog-ai-assistant").data("kendoDialog");
            if (dlg) dlg.close();
        });
    }

    // Initialize Kendo FloatingActionButton — dialog toggled via its click event
    _fab = $("#ai-float-btn").kendoFloatingActionButton({
        align: "bottom end",
        alignOffset: { x: -28, y: 10 },
        positionMode: "absolute",
        icon: "comment",
        size: "large",
        themeColor: "primary",
        click: function () {
            if (!_aiDialogReady) {
                _aiDialogReady = true;
                var dlg = $("#dialog-ai-assistant").kendoDialog({
                    title:    false,
                    width:    390,
                    height:   600,
                    modal:    false,
                    visible:  false,
                    resizable: true,
                    draggable: { dragHandle: ".k-dialog-titlebar" },
                    closable: false,
                    actions:  [],
                    open: function () {
                        this.wrapper.addClass("ai-dialog-wrapper");
                        _initAiChatIfNeeded();
                    }
                }).data("kendoDialog");
                if (dlg) dlg.open();
                return;
            }
            var dlg = $("#dialog-ai-assistant").data("kendoDialog");
            if (!dlg) return;
            if (dlg.wrapper && dlg.wrapper.is(":visible")) {
                dlg.close();
            } else {
                dlg.open();
            }
        }
    }).data("kendoFloatingActionButton");

    function updateFabOffset() {
        if (!_fab) return;
        _fab.setOptions({
            alignOffset: window.innerWidth < 1440 ? { x: 10, y: 10 } : { x: -28, y: 10 }
        });
    }

    updateFabOffset();
    $(window).on("resize", updateFabOffset);
});
