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
        var iconMap = {
            date:     "calendar",
            time:     "clock",
            location: "map-marker-target",
            visit:    "user"
        };
        if (iconMap[kind]) {
            return kendo.ui.icon({ type: "svg", icon: iconMap[kind] });
        }
        var builtinIcons = {
            expand:   "arrows-out-simple",
            collapse: "min-height"
        };
        if (builtinIcons[kind]) {
            return kendo.ui.icon({ type: "svg", icon: builtinIcons[kind] });
        }
        return "";
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
        }
    });    

    function applyTaskFilters() {
        var searchBox = $("#tasks-search").data("kendoTextBox");
         var q   = $("#tasks-search").val().toLowerCase().trim();
        var filters = [];
        if (q)                    { filters.push({ field: "task",     operator: "contains",  value: q }); }        
        tasksDS.filter(filters.length ? { logic: "and", filters: filters } : {});
    }

    if (!$("#tasks-search").data("kendoTextBox")) {
        $("#tasks-search").kendoTextBox({
            clearButton:   true,
            width: 340,
            placeholder:   "Search daily tasks",
            prefixOptions: { icon: "search", separator: false }            
        });    
        
        $("#tasks-search").on("input", function () {
            applyTaskFilters();
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
            if (!$("#atf-priority-group").data("kendoSegmentedControl")) {
                $("#atf-priority-group").kendoSegmentedControl({
                    selectedValue: "Low",
                    items: [
                        { text: "Low",    value: "Low"    },
                        { text: "Medium", value: "Medium" },
                        { text: "High",   value: "High"   }
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
                    var grp = $("#atf-priority-group").data("kendoSegmentedControl");
                    var priority = grp ? (grp.value() || "Low") : "Low";
                    var description = ($("#atf-description").val() || "").trim();
                    $.ajax({
                        url:         "./api/tasks/create",
                        type:        "POST",
                        contentType: "application/json",
                        data:        JSON.stringify({ task: name, priority: priority, description: description, done: false }),
                        success: function () {                            
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
        var grp = $("#atf-priority-group").data("kendoSegmentedControl");
        if (grp) grp.value("Low");
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
