(function () {
    "use strict";

    var $page = $(".workspace-page");
    var page = String($page.data("workspace-page") || "");
    if (!page) return;

    function button(id, text, icon, click) {
        var $button = $("<button>", { id: id, type: "button", text: text });
        $("#workspace-actions").append($button);
        $button.kendoButton({ icon: icon, themeColor: "primary", click: click });
        return $button;
    }

    function notify(message, type) {
        var notification = $("#workspace-notification").data("kendoNotification");
        if (notification) notification.show(message, type || "success");
    }

    function addNotification() {
        if (!$("#workspace-notification").length) {
            $("body").append('<span id="workspace-notification"></span>');
            $("#workspace-notification").kendoNotification({
                position: { pinned: true, top: 88, right: 24 },
                autoHideAfter: 5000,
                stacking: "down",
                templates: [{ type: "success", template: '<div class="workspace-toast">#= message #</div>' }]
            });
        }
    }

    function addTitle(text) {
        $("#workspace-subtitle").text(text);
    }

    function initLabs() {
        addTitle("Review pending orders, acknowledge critical values, and release reviewed results.");
        $("#workspace-critical-alert").prop("hidden", false);
        $("#workspace-alert-dismiss").on("click", function () {
            $("#workspace-critical-alert").prop("hidden", true);
            notify("Critical result acknowledged.");
        });
        button("new-lab-order", "New lab order", "plus", function () { notify("Lab order form is ready for patient selection."); });
        $("#workspace-content").html('<div class="workspace-toolbar"><input id="labs-search" placeholder="Search patient or test" /><div id="labs-priority"></div></div><div class="k-card workspace-card"><div id="labs-grid"></div></div>');
        $("#labs-search").kendoTextBox({ prefixOptions: { icon: "search" } });
        $("#labs-priority").kendoDropDownList({ dataSource: ["All priorities", "STAT", "Urgent", "Routine"], value: "All priorities" });
        $("#labs-grid").kendoGrid({
            dataSource: { data: [
                { date: "Aug 26, 2026", patient: "Emma Johnson", test: "Basic Metabolic Panel", priority: "STAT", status: "Resulted" },
                { date: "Aug 26, 2026", patient: "Noah Williams", test: "Complete Blood Count", priority: "Urgent", status: "In process" },
                { date: "Aug 25, 2026", patient: "Mia Rodriguez", test: "Hemoglobin A1c", priority: "Routine", status: "Reviewed" }
            ]},
            sortable: true,
            pageable: false,
            columns: [
                { field: "date", title: "Ordered" }, { field: "patient", title: "Patient" },
                { field: "test", title: "Test" }, { field: "priority", title: "Priority" },
                { field: "status", title: "Status" },
                { title: "Actions", template: '<button class="k-button k-button-flat k-button-md review-lab">Review</button>', width: 100 }
            ]
        });
        $("#labs-grid").on("click", ".review-lab", function () { notify("Result opened for clinical review."); });
    }

    function initMessages() {
        addTitle("Secure, patient-contextual communication for your care team.");
        button("new-message", "New message", "plus", function () { notify("New secure message started."); });
        $("#workspace-content").html('<div class="workspace-two-column"><section class="k-card workspace-card workspace-inbox"><div class="k-card-header"><h2 class="k-card-title">Inbox</h2></div><div id="message-list"></div></section><section class="k-card workspace-card"><div id="message-chat"></div></section></div>');
        $("#message-list").kendoListView({
            dataSource: { data: [
                { name: "Emma Johnson", text: "I have a question about my new medication.", time: "10 min ago", unread: "Unread" },
                { name: "Nurse Patel", text: "Lab follow-up completed for Noah Williams.", time: "42 min ago", unread: "" },
                { name: "Mia Rodriguez", text: "Thank you for the visit summary.", time: "Yesterday", unread: "" }
            ]},
            template: '<button type="button" class="workspace-message-item"><strong>#: name #</strong><span>#: text #</span><small>#: time # #= unread ? " · Unread" : "" #</small></button>'
        });
        $("#message-chat").kendoChat({
            messages: [
                { author: { id: "emma", name: "Emma Johnson" }, text: "I have a question about my new medication.", timestamp: new Date() },
                { author: { id: "doctor", name: "Dr. Carter" }, text: "I can help. What would you like to know?", timestamp: new Date() }
            ],
            user: { id: "doctor", name: "Dr. Carter" },
            sendMessage: function () { notify("Secure message sent."); }
        });
    }

    function initProviders() {
        addTitle("Find clinicians by specialty, department, and availability.");
        $("#workspace-content").html('<div class="workspace-toolbar"><input id="provider-search" placeholder="Search providers" /><div id="provider-specialty"></div></div><div id="provider-list" class="workspace-provider-list"></div>');
        $("#provider-search").kendoTextBox({ prefixOptions: { icon: "search" } });
        $("#provider-specialty").kendoDropDownList({ dataSource: ["All specialties", "Cardiology", "Family medicine", "Pulmonology"], value: "All specialties" });
        $("#provider-list").kendoListView({
            dataSource: { data: [
                { name: "Dr. Maya Patel", specialty: "Cardiology", location: "Heart & Vascular Center", availability: "Accepting new patients" },
                { name: "Dr. James Carter", specialty: "Internal medicine", location: "CarePoint Clinic", availability: "Available today" },
                { name: "Dr. Olivia Kim", specialty: "Pulmonology", location: "North Campus", availability: "Next opening: Aug 29" }
            ]},
            template: '<article class="k-card workspace-provider-card"><div class="workspace-provider-avatar" aria-hidden="true">#: name.charAt(4) #</div><div><h2>#: name #</h2><p>#: specialty # · #: location #</p><span class="workspace-status">#: availability #</span></div><button type="button" class="k-button k-button-outline k-button-md provider-profile">View profile</button></article>'
        });
        $("#provider-list").on("click", ".provider-profile", function () { notify("Provider profile opened."); });
    }

    function initSettings() {
        addTitle("Manage clinical workspace preferences and notification delivery.");
        $("#workspace-content").html('<div class="workspace-settings"><section class="k-card workspace-card"><div class="k-card-header"><h2 class="k-card-title">Notifications</h2></div><div class="k-card-body workspace-settings-row"><span><strong>Critical lab results</strong><small>Send an in-app and email alert immediately.</small></span><input id="critical-alerts" /></div><div class="k-card-body workspace-settings-row"><span><strong>Appointment changes</strong><small>Receive updates when a patient reschedules.</small></span><input id="appointment-alerts" /></div></section><section class="k-card workspace-card"><div class="k-card-header"><h2 class="k-card-title">Display preferences</h2></div><div class="k-card-body workspace-settings-select"><label for="settings-language">Language</label><select id="settings-language"></select></div></section></div>');
        $("#critical-alerts, #appointment-alerts").kendoSwitch({ checked: true, change: function () { notify("Settings saved."); } });
        $("#settings-language").kendoDropDownList({ dataSource: ["English (US)", "Spanish", "French"], value: "English (US)", change: function () { notify("Language preference saved."); } });
    }

    function initNotifications() {
        addTitle("Review critical results, appointment changes, and message updates.");
        $("#workspace-content").html('<div class="k-card workspace-card"><div class="k-card-header workspace-notification-header"><h2 class="k-card-title">Today</h2><button id="mark-all-read">Mark all as read</button></div><div id="notification-list"></div></div>');
        $("#mark-all-read").kendoButton({ fillMode: "flat", click: function () { $("#notification-list .workspace-status").text("Read"); notify("All notifications marked as read."); } });
        $("#notification-list").kendoListView({
            dataSource: { data: [
                { title: "Critical potassium result", detail: "Emma Johnson's result needs acknowledgement.", status: "Critical" },
                { title: "Appointment rescheduled", detail: "Noah Williams moved to 2:30 PM today.", status: "New" },
                { title: "New secure message", detail: "Mia Rodriguez replied to your care team.", status: "New" }
            ]},
            template: '<article class="workspace-notification-item"><div><h2>#: title #</h2><p>#: detail #</p></div><span class="workspace-status">#: status #</span></article>'
        });
    }

    function initHelp() {
        addTitle("Find clinical workspace guidance or contact CarePoint support.");
        $("#workspace-content").html('<div class="workspace-help"><input id="help-search" placeholder="Search help topics" /><section class="k-card workspace-card"><ul id="help-panel"><li>How do I review a critical lab?<div>Open Labs, select Review, then acknowledge the result after clinical assessment.</div></li><li>How do I update a patient record?<div>Open Patients, select a record, and use the relevant clinical tab.</div></li><li>Where can I manage my notifications?<div>Open Settings &amp; Preferences to choose how each alert reaches you.</div></li></ul></section><section class="k-card workspace-card workspace-contact"><h2>Need more help?</h2><p>Contact the CarePoint clinical support team. Typical response time is under one business day.</p><button id="contact-support">Contact support</button></section></div>');
        $("#help-search").kendoAutoComplete({ dataSource: ["Reviewing critical lab results", "Scheduling an appointment", "Updating patient demographics"], placeholder: "Search help topics", prefixOptions: { icon: "search" } });
        $("#help-panel").kendoPanelBar({ expandMode: "multiple" });
        $("#contact-support").kendoButton({ themeColor: "primary", click: function () { notify("Support request started."); } });
    }

    function initIntake() {
        addTitle("Create a complete patient record before the first visit.");
        var currentStep = 0;
        var steps = ["Demographics", "Insurance", "Medical history", "Review"];
        var state = {
            fullName: "", dateOfBirth: "", phone: "",
            carrier: "", memberId: "", policyNumber: "",
            conditions: "", medications: ""
        };
        var stepContent = [
            '<p>Enter the information required to identify and contact the patient.</p><label for="intake-name">Full name <span aria-hidden="true">*</span></label><input id="intake-name" /><label for="intake-dob">Date of birth <span aria-hidden="true">*</span></label><input id="intake-dob" /><label for="intake-phone">Mobile phone <span aria-hidden="true">*</span></label><input id="intake-phone" />',
            '<p>Record the primary insurance information before the first visit.</p><label for="intake-carrier">Insurance carrier <span aria-hidden="true">*</span></label><select id="intake-carrier"></select><label for="intake-member-id">Member ID <span aria-hidden="true">*</span></label><input id="intake-member-id" /><label for="intake-policy">Group or policy number <span aria-hidden="true">*</span></label><input id="intake-policy" />',
            '<p>Document the information the care team should review at check-in.</p><label for="intake-conditions">Current conditions <span aria-hidden="true">*</span></label><textarea id="intake-conditions"></textarea><label for="intake-medications">Current medications <span aria-hidden="true">*</span></label><textarea id="intake-medications"></textarea>',
            '<p>Confirm the collected information before the patient record is created.</p><dl class="workspace-review-list"><dt>Patient</dt><dd></dd><dt>Date of birth</dt><dd></dd><dt>Phone</dt><dd></dd><dt>Insurance</dt><dd></dd><dt>Medical history</dt><dd></dd></dl>'
        ];
        var stepper;

        function escapeText(value) {
            return kendo.htmlEncode(value || "Not provided");
        }

        function saveStep() {
            if (currentStep === 0) {
                state.fullName = $("#intake-name").data("kendoTextBox").value().trim();
                state.dateOfBirth = $("#intake-dob").data("kendoDatePicker").value();
                state.phone = $("#intake-phone").data("kendoTextBox").value().trim();
                return state.fullName && state.dateOfBirth && state.phone;
            }
            if (currentStep === 1) {
                state.carrier = $("#intake-carrier").data("kendoDropDownList").value();
                state.memberId = $("#intake-member-id").data("kendoTextBox").value().trim();
                state.policyNumber = $("#intake-policy").data("kendoTextBox").value().trim();
                return state.carrier && state.memberId && state.policyNumber;
            }
            if (currentStep === 2) {
                state.conditions = $("#intake-conditions").data("kendoTextArea").value().trim();
                state.medications = $("#intake-medications").data("kendoTextArea").value().trim();
                return state.conditions && state.medications;
            }
            return true;
        }

        function renderStep() {
            $("#workspace-content").html('<section class="workspace-intake"><div id="intake-stepper"></div><form id="intake-form" class="k-card workspace-card workspace-form"><h2>' + steps[currentStep] + '</h2><div id="intake-fields">' + stepContent[currentStep] + '</div><p id="intake-error" class="workspace-form-error" role="alert" hidden>Please complete all required fields before continuing.</p><div class="workspace-form-actions"><button type="button" id="intake-back">Back</button><button type="submit" id="intake-next">' + (currentStep === steps.length - 1 ? "Create patient" : "Continue") + '</button></div></form></section>');
            stepper = $("#intake-stepper").kendoStepper({
                steps: steps.map(function (label) { return { label: label }; }),
                value: currentStep,
                select: function (event) {
                    event.preventDefault();
                    if (!saveStep()) {
                        $("#intake-error").prop("hidden", false);
                    }
                }
            }).data("kendoStepper");

            if (currentStep === 0) {
                $("#intake-name").kendoTextBox({ value: state.fullName });
                $("#intake-dob").kendoDatePicker({ value: state.dateOfBirth });
                $("#intake-phone").kendoTextBox({ value: state.phone });
            } else if (currentStep === 1) {
                $("#intake-carrier").kendoDropDownList({ dataSource: ["Aetna", "Blue Cross Blue Shield", "Cigna", "Medicare"], optionLabel: "Select a carrier", value: state.carrier });
                $("#intake-member-id").kendoTextBox({ value: state.memberId });
                $("#intake-policy").kendoTextBox({ value: state.policyNumber });
            } else if (currentStep === 2) {
                $("#intake-conditions").kendoTextArea({ value: state.conditions, rows: 3 });
                $("#intake-medications").kendoTextArea({ value: state.medications, rows: 3 });
            } else {
                var values = [
                    escapeText(state.fullName),
                    kendo.toString(state.dateOfBirth, "D"),
                    escapeText(state.phone),
                    escapeText(state.carrier + " · " + state.memberId),
                    escapeText(state.conditions + " Medications: " + state.medications)
                ];
                $("#intake-fields dd").each(function (index) { $(this).html(values[index]); });
            }

            $("#intake-back").kendoButton({
                enable: currentStep > 0,
                click: function () {
                    saveStep();
                    currentStep -= 1;
                    renderStep();
                }
            });
            $("#intake-next").kendoButton({ themeColor: "primary" });
            $("#intake-form").on("submit", function (event) {
                event.preventDefault();
                if (!saveStep()) {
                    $("#intake-error").prop("hidden", false);
                    return;
                }
                if (currentStep === steps.length - 1) {
                    $("#intake-form").replaceWith('<section class="workspace-empty-state workspace-intake-success" aria-live="polite"><h2>Patient record created</h2><p>' + escapeText(state.fullName) + ' is ready for scheduling and clinical documentation.</p><a class="workspace-primary-link" href="./patients">View patient directory</a></section>');
                    notify("Patient record created.");
                    return;
                }
                currentStep += 1;
                renderStep();
            });
        }

        renderStep();
    }

    function initLogin() {
        $("#login-email, #login-password").kendoTextBox();
        $("#login-submit").kendoButton({ themeColor: "primary" });
        $("#login-form").on("submit", function (event) { event.preventDefault(); window.location.href = "./"; });
    }

    addNotification();
    switch (page) {
        case "Labs": initLabs(); break;
        case "Messages": initMessages(); break;
        case "Providers": initProviders(); break;
        case "Settings": initSettings(); break;
        case "Notifications": initNotifications(); break;
        case "Help": initHelp(); break;
        case "Intake": initIntake(); break;
        case "Login": initLogin(); break;
    }
}());
