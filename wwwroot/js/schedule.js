$(document).ready(function () {

    /* ═══════════════════════════════════════════════
       DATA — static lookups (no patient fetch needed)
    ═══════════════════════════════════════════════ */
    var eventTypesData = sharedEventTypes;
    var roomOptions    = sharedRoomOptions;

    var patientsData = [];
    var _pendingHighlightUid = null;

    /* ═══════════════════════════════════════════════
       REMOTE DATA SOURCE — Kendo SchedulerDataSource
    ═══════════════════════════════════════════════ */
    var schedulerDS = new kendo.data.SchedulerDataSource({
        transport: {
            read: {
                url:      "./api/appointments",
                dataType: "json"
            }
        },
        schema: {
            model: {
                id: "id",
                fields: {
                    id:          { from: "id",          type: "number" },
                    title:       { from: "title",       type: "string" },
                    patientName: { from: "patientName", type: "string" },
                    reason:      { from: "reason",      type: "string" },
                    room:        { from: "room",        type: "string" },
                    eventType:   { from: "eventType",   type: "string" },
                    start:       { from: "start",       type: "date"   },
                    end:         { from: "end",         type: "date"   }
                }
            }
        }
    });

    /* Notification badge is managed by profile.js initNotifDropdown() */

    /* ═══════════════════════════════════════════════
       SCHEDULER — reads from remote SchedulerDataSource
    ═══════════════════════════════════════════════ */
    var today     = new Date();
    var startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0, 0);
    var endTime   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 0, 0);

    var scheduler = $("#scheduler").kendoScheduler({
        date:      new Date(),
        startTime: startTime,
        endTime:   endTime,
        height:    760,
        views: [
            { type: "day", selected: true, dateHeaderTemplate: ({ date }) => `<strong>${kendo.toString(date, 'D')}</strong>`, },
            { type: "week", dateHeaderTemplate: ({ date }) => `<strong>${kendo.toString(date, 'ddd, dd/MM')}</strong>`, },
            {
              type: "month",
              eventHeight: 90
            },
            "agenda"
        ],
        editable: {
            create:  false,
            move:    false,
            resize:  false,
            destroy: false
        },
        dataSource: schedulerDS,
        resources: [{
            field:          "eventType",
            title:          "Event Type",
            dataTextField:  "text",
            dataValueField: "value",
            dataSource:     eventTypesData
        }],
        dataBound: function () {
            var appts = schedulerDS.data().slice();
            if (!appts.length) return;
            if (_pendingHighlightUid) {
                var uid = _pendingHighlightUid;
                _pendingHighlightUid = null;
                setTimeout(function () { highlightSchedulerEvent(uid); }, 100);
            }
        },
        eventTemplate: ({ eventType, patientName, start, end, room }) =>
            `<div class="sched-ev ${eventType === 'Follow-up' ? 'sched-ev-followup' : ''}">`+
            `<div class="sched-ev-title">${kendo.htmlEncode(eventType)} &ndash; ${kendo.htmlEncode(patientName)}</div>`+
            `<div class="sched-ev-meta">${kendo.toString(start, "hh:mm")}&ndash;${kendo.toString(end, "hh:mm tt")} &middot; ${kendo.htmlEncode(room)}</div>`+
            `</div>`,
        edit: function (e) {
            e.preventDefault();
            openAppointmentDialog(e.event);
        }
    }).data("kendoScheduler");

    /* ═══════════════════════════════════════════════
       APPOINTMENT DETAIL DIALOG
    ═══════════════════════════════════════════════ */
    var _currentApptEvt = null;
    var _apptExpanded   = false;

    function appointmentDialogIcon(kind) {
        var icons = {
            date: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3.25" y="4.75" width="13.5" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 3.5V6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13.5 3.5V6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3.25 8.25H16.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
            time: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6.75" stroke="currentColor" stroke-width="1.8"/><path d="M10 6.75V10.25L12.5 11.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            location: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 17C12.8 13.7 15 11.15 15 8.75C15 6.13 12.76 4 10 4C7.24 4 5 6.13 5 8.75C5 11.15 7.2 13.7 10 17Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="10" cy="8.75" r="1.9" stroke="currentColor" stroke-width="1.8"/></svg>',
            visit: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6.75 11.25C8.68 11.25 10.25 9.68 10.25 7.75C10.25 5.82 8.68 4.25 6.75 4.25C4.82 4.25 3.25 5.82 3.25 7.75C3.25 9.68 4.82 11.25 6.75 11.25Z" stroke="currentColor" stroke-width="1.8"/><path d="M11.25 15.75C11.25 13.4 9.23 11.5 6.75 11.5C4.27 11.5 2.25 13.4 2.25 15.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12.75 6L17 10.25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17 6V10.25H12.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            expand: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M11.75 4.5H15.5V8.25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 4.5L10.75 9.25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.25 15.5H4.5V11.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 15.5L9.25 10.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
            collapse: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.33301 6.66667L13.9997 2" stroke="#232A36" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.333 6.66663H9.33301V2.66663" stroke="#232A36" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 14L6.66667 9.33337" stroke="#232A36" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.66699 9.33337H6.66699V13.3334" stroke="#232A36" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        };

        return icons[kind] || "";
    }

    function highlightSchedulerEvent(uid) {
        var $el = scheduler.element.find('[data-uid="' + uid + '"]');
        if (!$el.length) return;
        $el.addClass("context-search-hit");
        $el[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
        setTimeout(function () { $el.removeClass("context-search-hit"); }, 2200);
    }

    function getAppointmentPatient(name) {
        var query = (name || "").toLowerCase().trim();
        for (var i = 0; i < patientsData.length; i++) {
            if ((patientsData[i].name || "").toLowerCase() === query) {
                return patientsData[i];
            }
        }
        return null;
    }

    function renderAppointmentDialogContent(evt) {
        var patient = getAppointmentPatient(evt.patientName || evt.title);
        var roomText = evt.room ? evt.room : "Clinic room pending";
        var visitText = evt.reason ? evt.reason : "In-person visit";
        var infoHtml = "";

        if (_apptExpanded && patient) {
            infoHtml =
                '<div class="appt-review-divider"></div>' +
                '<section class="appt-review-section appt-review-patient">' +
                    '<h3 class="appt-review-heading">Patient Information</h3>' +
                    '<div class="appt-patient-row"><strong>Name:</strong> <span>' + kendo.htmlEncode(patient.name || "") + '</span></div>' +
                    '<div class="appt-patient-row"><strong>Age:</strong> <span>' + kendo.htmlEncode(String(patient.age || "")) + '</span></div>' +
                    '<div class="appt-patient-row"><strong>Gender:</strong> <span>' + kendo.htmlEncode(patient.gender || "") + '</span></div>' +
                '</section>';
        }

        return (
            '<div class="appt-review' + (_apptExpanded ? ' is-expanded' : '') + '">' +
                '<section class="appt-review-section">' +
                    '<h3 class="appt-review-heading">Appointment time</h3>' +
                    '<div class="appt-review-line">' +
                        '<span class="appt-review-icon">' + appointmentDialogIcon("date") + '</span>' +
                        '<span>' + kendo.toString(evt.start, "ddd, MMMM d, yyyy") + '</span>' +
                    '</div>' +
                    '<div class="appt-review-line">' +
                        '<span class="appt-review-icon">' + appointmentDialogIcon("time") + '</span>' +
                        '<span>' + kendo.toString(evt.start, "h tt") + ' - ' + kendo.toString(evt.end, "h:mm tt") + '</span>' +
                    '</div>' +
                    '<div class="appt-review-line">' +
                        '<span class="appt-review-icon">' + appointmentDialogIcon("location") + '</span>' +
                        '<span>' + kendo.htmlEncode(roomText) + '</span>' +
                    '</div>' +
                    '<div class="appt-review-line">' +
                        '<span class="appt-review-icon">' + appointmentDialogIcon("visit") + '</span>' +
                        '<span>' + kendo.htmlEncode(visitText) + '</span>' +
                    '</div>' +
                '</section>' +
                infoHtml +
            '</div>'
        );
    }

    function syncAppointmentDialogState() {
        var dlg = $("#appointment-dialog").data("kendoDialog");
        if (!dlg) return;

        var wrapper = dlg.wrapper;
        wrapper.toggleClass("appt-dialog-expanded", _apptExpanded);
        wrapper.toggleClass("appt-dialog-collapsed", !_apptExpanded);
        wrapper.find(".appt-expand-btn")
            .attr("aria-label", _apptExpanded ? "Collapse appointment" : "Expand appointment")
            .attr("title", _apptExpanded ? "Collapse" : "Expand")
            .html(appointmentDialogIcon(_apptExpanded ? "collapse" : "expand"));
    }

    function ensureAppointmentDialogToggle() {
        var dlg = $("#appointment-dialog").data("kendoDialog");
        if (!dlg) return;

        var titlebar = dlg.wrapper.find(".k-window-titlebar");
        if (!titlebar.find(".appt-expand-btn").length) {
            $(
                '<button type="button" class="appt-expand-btn" aria-label="Expand appointment" title="Expand"></button>'
            ).insertBefore(titlebar.find(".k-window-titlebar-actions, .k-window-actions").first());

            titlebar.on("click", ".appt-expand-btn", function () {
                _apptExpanded = !_apptExpanded;
                if (_currentApptEvt) {
                    dlg.content(renderAppointmentDialogContent(_currentApptEvt));
                }
                syncAppointmentDialogState();
            });
        }

        syncAppointmentDialogState();
    }

    $("#appointment-dialog").kendoDialog({
        title:    "",
        width:    320,
        modal:    true,
        closable: false,
        visible:  false,
        draggable: { dragHandle: ".k-dialog-titlebar" },
        buttonLayout: "normal",
        resizable: true,
        close: function () {
            _apptExpanded = false;
        },
        actions: [
            {
                text: "Close",
                action: function () {
                    _apptExpanded = false;
                    return true;
                }
            }
        ]
    });

    function openAppointmentDialog(evt) {
        _currentApptEvt = evt;
        _apptExpanded   = false;

        var dlg = $("#appointment-dialog").data("kendoDialog");
        dlg.title(kendo.htmlEncode((evt.eventType || "Appointment") + " - " + (evt.patientName || evt.title || "")));
        dlg.content(renderAppointmentDialogContent(evt));
        ensureAppointmentDialogToggle();
        syncAppointmentDialogState();
        dlg.open();
    }

    /* ═══════════════════════════════════════════════
       DAILY TASKS LIST VIEW — remote CRUD
    ═══════════════════════════════════════════════ */
    var tasksDS = new kendo.data.DataSource({
        transport: {
            read: {
                url:      "./api/tasks",
                dataType: "json"
            },
            update: {
                url:         "./api/tasks/update",
                type:        "POST",
                dataType:    "json",
                contentType: "application/json"
            },
            parameterMap: function (data, operation) {
                if (operation === "update") {
                    return JSON.stringify(data);
                }
                return data;
            }
        },
        schema: {
            model: {
                id: "id",
                fields: {
                    description: { type: "string" }
                }
            }
        }
    });

    var priorityColorMap = { high: "error", medium: "warning", low: "success" };

    window.priorityTheme = function (p) {
        return priorityColorMap[(p || "").toLowerCase()] || "info";
    };

    $("#tasks-list").kendoListView({
        dataSource: tasksDS,
        template: ({ done, id, task, priority }) =>
            `<div class="task-item ${done ? 'task-done' : ''}" data-id="${kendo.htmlEncode(id)}">`+
            `<input type="checkbox" class="task-checkbox" data-id="${kendo.htmlEncode(id)}" ${done ? 'checked="checked"' : ''} />`+
            `<span class="task-text">${kendo.htmlEncode(task)}</span>`+
            `<span class="k-badge-priority" data-priority="${priorityTheme(priority)}">${kendo.htmlEncode(priority)}</span>`+
            `</div>`,
        selectable: false,
        dataBound: function () {
            var el = this.element;
            setTimeout(function () {
                el.find(".task-checkbox").each(function () {
                    if (!$(this).data("kendoCheckBox")) {
                        $(this).kendoCheckBox({
                            rounded: "full",
                            size:    "medium",
                            change:  function (e) {
                                var id      = parseInt(e.sender.element.data("id"), 10);
                                var checked = e.checked;
                                var item    = tasksDS.get(id);
                                if (item) {
                                    item.set("done", checked);
                                    tasksDS.sync();
                                }
                            }
                        });
                    }
                });
                el.find(".k-badge-priority").each(function () {
                    var p = $(this).attr("data-priority");
                    if (!$(this).data("kendoBadge")) {
                        $(this).kendoBadge({
                            themeColor: p || "info",
                            fillMode:   "solid",
                            rounded:    "full",
                            size:       "large"
                        });
                    }
                });
            }, 0);
        }
    });

    /* priority filter ButtonGroup */
    var activePriorityFilter = null;

    $("#tasks-priority-filter").kendoButtonGroup({
        selection: "single",
        index: 0,
        buttons: [
            { text: "All"    },
            { text: "Low"    },
            { text: "Medium" },
            { text: "High"   }
        ],
        select: function (e) {
            var label = e.indices[0] === 0 ? null : ["All", "Low", "Medium", "High"][e.indices[0]];
            activePriorityFilter = label;
            applyTaskFilters();
        }
    });

    function applyTaskFilters() {
        var searchBox = $("#tasks-search").data("kendoTextBox");
        var q   = ((searchBox ? searchBox.value() : $("#tasks-search").val()) || "").toLowerCase().trim();
        var filters = [];
        if (q)                    { filters.push({ field: "task",     operator: "contains",  value: q }); }
        if (activePriorityFilter) { filters.push({ field: "priority", operator: "eq",        value: activePriorityFilter }); }
        tasksDS.filter(filters.length ? { logic: "and", filters: filters } : {});
    }

    if (!$("#tasks-search").data("kendoTextBox")) {
        $("#tasks-search").kendoTextBox({
            clearButton:   true,
            width: 340,
            placeholder:   "Search daily tasks",
            prefixOptions: { icon: "search", separator: false },
            input: function () {
                applyTaskFilters();
            },
            change: function () {
                applyTaskFilters();
            }
        });
    }

    $("#tasks-search").closest(".k-input").on("click", ".k-clear-value", function () {
        var searchBox = $("#tasks-search").data("kendoTextBox");
        if (searchBox) {
            setTimeout(function () {
                searchBox.value("");
                applyTaskFilters();
            }, 0);
        }
    });

    /* ═══════════════════════════════════════════════
       ADD TASK DIALOG
    ═══════════════════════════════════════════════ */
    $("#add-task-dialog").kendoDialog({
        width:    690,
        title:    "Add Task",
        closable: true,
        modal:    true,
        visible:  false,
        draggable: { dragHandle: ".k-dialog-titlebar" },
        buttonLayout: "normal",
        resizable: true,
        open: function () {
            applySharedDialogShell(this);
            this.center();
            if (!$("#atf-name").data("kendoTextBox")) {
                $("#atf-name").kendoTextBox({ placeholder: "Enter task name" });
            }
            if (!$("#atf-priority-group").data("kendoButtonGroup")) {
                $("#atf-priority-group").kendoButtonGroup({
                    selection: "single",
                    items: [
                        { text: "Low",    selected: true, attributes: { id: "atf-pri-low" } },
                        { text: "Medium", attributes: { id: "atf-pri-medium" } },
                        { text: "High",   attributes: { id: "atf-pri-high" } }
                    ]
                });
            }
            if (!$("#atf-description").data("kendoTextArea")) {
                $("#atf-description").kendoTextArea({
                    placeholder: "Enter task description...",
                    rows: 4
                });
            }
        },
        close: function () {
            resetAddTaskForm();
        },
        actions: [
            {
                text: "Cancel",
                action: function () {
                    resetAddTaskForm();
                    return true;
                }
            },
            {
                text: "Save",
                primary: true,
                action: function () {
                    var name = ($("#atf-name").val() || "").trim();
                    $("#atf-name").val(name);
                    if (!name) {
                        showTaskNameError("Task name is required.");
                        return false;
                    }
                    clearTaskNameError();
                    var priorities = ["Low", "Medium", "High"];
                    var grp = $("#atf-priority-group").data("kendoButtonGroup");
                    var idx = grp ? grp.current().index() : 0;
                    var priority = priorities[idx !== undefined ? idx : 0];
                    var description = ($("#atf-description").val() || "").trim();
                    $.ajax({
                        url:         "./api/tasks/create",
                        type:        "POST",
                        contentType: "application/json",
                        data:        JSON.stringify({ task: name, priority: priority, description: description, done: false }),
                        success: function () {
                            // Reset filter to "All" so the new task is visible,
                            // then re-read the DataSource to refresh the ListView.
                            activePriorityFilter = null;
                            var bg = $("#tasks-priority-filter").data("kendoButtonGroup");
                            if (bg) { bg.select(0); }
                            tasksDS.filter({});
                            tasksDS.read();
                        },
                        error: function (xhr) {
                            showTaskNameError(xhr.responseText || "Task name is required.");
                        }
                    });
                    resetAddTaskForm();
                    return true;
                }
            }
        ]
    });

    $("#btn-add-task").kendoButton({
        icon: "plus",
        themeColor: "primary",
        fillMode: "solid",
        rounded: "full",
        click: function () {
            $("#add-task-dialog").data("kendoDialog").open();
        }
    });

    function resetAddTaskForm() {
        $("#atf-name").val("");
        var grp = $("#atf-priority-group").data("kendoButtonGroup");
        if (grp) grp.select(0);
        $("#atf-description").val("");
        clearTaskNameError();
    }

    $("#add-task-dialog").on("input", "#atf-name", function () {
        if (($(this).val() || "").trim()) {
            clearTaskNameError();
        }
    });

    function showTaskNameError(message) {
        $("#atf-name").closest(".k-input").addClass("k-invalid");
        $("#add-task-dialog .atf-error").text(message).addClass("is-visible");
    }

    function clearTaskNameError() {
        $("#atf-name").closest(".k-input").removeClass("k-invalid");
        $("#add-task-dialog .atf-error").text("").removeClass("is-visible");
    }

    /* ═══════════════════════════════════════════════
       VIEW TASK DIALOG — opened by clicking a task row
    ═══════════════════════════════════════════════ */
    var _taskViewData = null;

    $("#view-task-dialog").kendoDialog({
        width:    550,
        title:    "Task Details",
        closable: true,
        modal:    true,
        visible:  false,
        draggable: { dragHandle: ".k-dialog-titlebar" },
        resizable: true,
        buttonLayout: "normal",
        open: function () {
            applySharedDialogShell(this);
            if (!_taskViewData) { return; }
            $("#vtf-name").text(_taskViewData.task || "");
            $("#vtf-description").text(_taskViewData.description || "No description provided.");

            var priorityEl = $("#vtf-priority-badge");
            priorityEl.empty();
            var p    = _taskViewData.priority || "Medium";
            var badge = $('<span class="k-badge-priority"></span>')
                .attr("data-priority", priorityTheme(p))
                .text(p);
            priorityEl.append(badge);
            badge.kendoBadge({
                themeColor: priorityTheme(p),
                fillMode:   "solid",
                rounded:    "full",
                size:       "large"
            });
        },
        actions: [
            {
                text:    "Close",
                primary: true,
                action:  function () { return true; }
            }
        ]
    });

    $("#tasks-list").on("click", ".task-item", function (e) {
        // Ignore clicks on the checkbox itself
        if ($(e.target).closest(".k-checkbox-wrap, .k-checkbox").length) { return; }
        var id   = parseInt($(this).data("id"), 10);
        var item = tasksDS.get(id);
        if (!item) { return; }
        _taskViewData = item.toJSON ? item.toJSON() : item;
        $("#view-task-dialog").data("kendoDialog").open();
    });

    /* ═══════════════════════════════════════════════
       PATIENTS FETCH — populates dialog dropdowns
    ═══════════════════════════════════════════════ */
    ensurePatientSearchData().done(function (patients) {
        patientsData = Array.isArray(patients) ? patients : (patients[0] || []);
        $("#page-content").removeClass("page-loading").addClass("page-ready");
    });

});
