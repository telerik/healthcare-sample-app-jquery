/* ═══════════════════════════════════════════════════════
   PROFILE MANAGEMENT WINDOW — shared across all pages
   Opens from the AppBar avatar (#profile-trigger).
   Uses kendoWindow with injected content.
═══════════════════════════════════════════════════════ */

/* ── Doctor data ──────────────────────────────────── */
var doctorProfile = {
    fullName: "Emily Carter",
    email:    "drcarter@email.com",
    phone:    "+(555) 776-90-84",
    avatar:   "./content/profile.jpg"
};

function applyDoctorProfile(profile) {
    if (!profile) {
        return;
    }

    doctorProfile.fullName = profile.fullName || doctorProfile.fullName;
    doctorProfile.email    = profile.email || doctorProfile.email;
    doctorProfile.phone    = profile.phone || doctorProfile.phone;
    doctorProfile.avatar   = profile.avatar || doctorProfile.avatar;

    $(".avatar, #profile-trigger").attr("src", doctorProfile.avatar);
    $("#pm-avatar").attr("src", doctorProfile.avatar);
}

function loadDoctorProfile() {
    return $.getJSON("./api/profile")
        .done(function (profile) {
            applyDoctorProfile(profile);
            populateProfileForm();
        });
}

/* ── Build & inject window HTML ──────────────────── */
function buildProfileWindow() {
    if ($("#profile-window").length) return;

    var markup =
        '<div id="profile-window">' +

            /* Profile Image section */
            '<div class="pm-section">' +
                '<label class="pm-label">Profile Image</label>' +
                '<div class="pm-photo-wrap">' +
                    '<img id="pm-avatar" class="pm-photo" ' +
                        'src="' + doctorProfile.avatar + '" alt="Profile" />' +
                '</div>' +
                '<input id="pm-file-input" name="photo" type="file" />' +
                '<button id="pm-btn-upload" type="button">Upload Image</button>' +
            '</div>' +

            /* Password Policy callout */
            '<div class="pm-callout">' +
                '<strong>Password Policy</strong>' +
                '<ul><li>Please change your password every two weeks</li></ul>' +
            '</div>' +

            /* Personal Information */
            '<div class="pm-section">' +
                '<div class="pm-section-title">Personal Information</div>' +
                '<div class="pm-field">' +
                    '<label for="pm-fullname">Full Name</label>' +
                    '<input id="pm-fullname" />' +
                '</div>' +
                '<div class="pm-field">' +
                    '<label for="pm-email">Email Address</label>' +
                    '<input id="pm-email" />' +
                '</div>' +
                '<div class="pm-field">' +
                    '<label for="pm-phone">Phone Number</label>' +
                    '<input id="pm-phone" />' +
                '</div>' +
            '</div>' +

            /* Footer */
            '<div class="pm-footer">' +
                '<button id="pm-btn-clear" type="button">Clear</button>' +
                '<button id="pm-btn-submit" type="button">Submit</button>' +
            '</div>' +

        '</div>';

    $("body").append(markup);
}

/* ── Notification widget ─────────────────────────── */
function initProfileNotification() {
    if (!$("#pm-notif").length) {
        $("body").append('<span id="pm-notif"></span>');
    }
    $("#pm-notif").kendoNotification({
        position:      { pinned: true, top: 30, right: 30 },
        autoHideAfter: 3000,
        stacking:      "down"
    });
}

/* ── Init the window ─────────────────────────────── */
function initProfileWindow() {
    $("#profile-window").kendoWindow({
        title:     "Profile Management",
        width:     420,
        resizable: true,
        draggable: { dragHandle: ".k-window-titlebar" },
        modal:     true,
        visible:   false,
        actions:   ["Close"],
        open: function () {
            populateProfileForm();
            var win = this;
            setTimeout(function () {
                var maxH = Math.floor(window.innerHeight * 0.98);
                win.setOptions({ height: "", maxHeight: maxH });
                win.center();
            });
        }
    });
}

/* ── Init form widgets ───────────────────────────── */
function initProfileWidgets() {
    $("#pm-file-input").kendoUpload({
        multiple: false,
        showFileList: false,
        validation: {
            allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"]
        },
        select: function (e) {
            var file = e.files && e.files[0];
            if (!file || !file.rawFile) {
                return;
            }

            var reader = new FileReader();
            reader.onload = function (ev) {
                $.ajax({
                    url:         "./api/profile/avatar",
                    type:        "POST",
                    contentType: "application/json",
                    data:        JSON.stringify({ avatar: ev.target.result }),
                    success: function (profile) {
                        applyDoctorProfile(profile);
                    },
                    error: function () {
                        showProfileNotif("Could not save the profile image. Please try again.", "error");
                    }
                });
            };
            reader.readAsDataURL(file.rawFile);

            e.preventDefault();
        }
    });

    $("#pm-file-input").closest(".k-upload").hide();

    /* Upload button */
    $("#pm-btn-upload").kendoButton({
        icon:       "upload",
        themeColor: "primary",
        rounded:    "large",
        click: function () {
            $("#pm-file-input").closest(".k-upload").find("input[type=file]").trigger("click");
        }
    });

    /* Text fields */
    $("#pm-fullname").kendoTextBox({ placeholder: "Full Name" });
    $("#pm-email").kendoTextBox({ placeholder: "Email Address" });
    $("#pm-phone").kendoMaskedTextBox({
        mask: "+(000) 000-00-00"
    });

    /* Footer buttons */
    $("#pm-btn-clear").kendoButton({
        fillMode: "flat",
        rounded:  "large",
        click: function () {
            $("#pm-fullname").data("kendoTextBox").value("");
            $("#pm-email").data("kendoTextBox").value("");
            $("#pm-phone").data("kendoMaskedTextBox").value("");
        }
    });

    $("#pm-btn-submit").kendoButton({
        themeColor: "primary",
        rounded:    "large",
        click: function () {
            var name  = $("#pm-fullname").data("kendoTextBox").value().trim();
            var email = $("#pm-email").data("kendoTextBox").value().trim();
            var phone = $("#pm-phone").data("kendoMaskedTextBox").value().trim();

            if (!name) {
                showProfileNotif("Full Name is required.", "error");
                return;
            }
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showProfileNotif("Please enter a valid email address.", "error");
                return;
            }

            $.ajax({
                url:         "./api/profile/update",
                type:        "POST",
                contentType: "application/json",
                data:        JSON.stringify({ fullName: name, email: email, phone: phone }),
                success: function (profile) {
                    applyDoctorProfile(profile);
                    showProfileNotif("Profile saved successfully.", "success");

                    var win = $("#profile-window").data("kendoWindow");
                    if (win) {
                        win.close();
                    }
                },
                error: function () {
                    showProfileNotif("Could not save the profile. Please try again.", "error");
                }
            });
        }
    });
}

/* ── Populate form from doctorProfile ────────────── */
function populateProfileForm() {
    var tb = $("#pm-fullname").data("kendoTextBox");
    if (tb) tb.value(doctorProfile.fullName);

    var em = $("#pm-email").data("kendoTextBox");
    if (em) em.value(doctorProfile.email);

    var ph = $("#pm-phone").data("kendoMaskedTextBox");
    if (ph) ph.value(doctorProfile.phone);

    $("#pm-avatar").attr("src", doctorProfile.avatar);
}

/* ── Show notification ───────────────────────────── */
function showProfileNotif(msg, type) {
    var n = $("#pm-notif").data("kendoNotification");
    if (n) n.show(msg, type);
}

/* ── Open trigger ────────────────────────────────── */
function initProfileTrigger() {
    $("#profile-trigger").kendoButton({
        click: function () {
            var win = $("#profile-window").data("kendoWindow");
            if (win) {
                win.center().open();
            }
        }
    });
}

/* ═══════════════════════════════════════════════════════
   NOTIFICATIONS DROPDOWN
═══════════════════════════════════════════════════════ */

var notificationsData = (function () {
    var p = sharedPatients;
    var n0 = p[0] || { name: "Unknown", id: null };
    var n1 = p[1] || n0;
    var n2 = p[2] || n0;
    var n3 = p.length > 4 ? p[4] : n0;
    var n4 = p.length > 3 ? p[3] : n0;
    return [
        { id: 1, read: false,  severity: "critical", icon: "\uD83D\uDD34", title: "Critical Lab Alert",     desc: "CRP elevated \u2013 " + n1.name,                          time: "2 min ago",  action: "View Patient",   patientId: n1.id },
        { id: 2, read: false,  severity: "warning",  icon: "\uD83D\uDFE0", title: "Vitals Warning",          desc: "Blood pressure abnormal \u2013 " + n2.name,               time: "8 min ago",  action: "View Patient",   patientId: n2.id },
        { id: 3, read: false,  severity: "critical", icon: "\uD83D\uDD34", title: "ICU Monitoring Alert",    desc: "Oxygen saturation low \u2013 " + n0.name,                 time: "15 min ago", action: "View Patient",   patientId: n0.id },
        { id: 4, read: false,  severity: "info",     icon: "\uD83D\uDD35", title: "New Lab Results",         desc: "CBC results posted \u2013 " + n1.name,                    time: "22 min ago", action: "View Results",   patientId: n1.id },
        { id: 5, read: true,   severity: "info",     icon: "\uD83D\uDFE1", title: "Appointment Update",      desc: "Appointment rescheduled \u2013 " + n4.name + " now at 09:30", time: "1 hr ago",  action: "View Schedule", patientId: null },
        { id: 6, read: true,   severity: "info",     icon: "\uD83D\uDCAC", title: "New Message",             desc: "Nurse Amanda Reed sent an update for " + n3.name,         time: "1 hr ago",   action: "View Message",   patientId: n3.id },
        { id: 7, read: true,   severity: "system",   icon: "\u2705",       title: "System Info",             desc: "Daily schedule synced successfully",                       time: "2 hr ago",   action: null,             patientId: null }
    ];
})();

function getUnreadCount() {
    return notificationsData.filter(function (n) { return !n.read; }).length;
}

function updateBadge() {
    var count = getUnreadCount();
    var badge = $("#notif-btn").find(".k-badge").data("kendoBadge");
    if (badge) {
        badge.text("");
        if (count === 0) { badge.element.hide(); } else { badge.element.show(); }
    }
}

function renderNotifPanel() {
    var items = notificationsData;
    var unread = getUnreadCount();

    var html =
        '<div class="np-header">' +
            '<span class="np-title">Notifications</span>' +
            (unread > 0
                ? '<button class="np-mark-all" id="np-mark-all">Mark all read</button>'
                : '<span class="np-all-read">All caught up ✓</span>') +
        '</div>' +
        '<div class="np-list">';

    $.each(items, function (_, n) {
        html +=
            '<div class="k-card k-card-horizontal np-card' + (n.read ? ' np-card-read' : '') + '" data-id="' + n.id + '">' +
                '<div class="k-card-image np-card-icon">' +
                    '<img src="./content/notification-bell.png" alt="" class="np-bell-img" />' +
                '</div>' +
                '<div class="k-card-body np-card-body">' +
                    '<h6 class="k-card-title np-card-title">' + kendo.htmlEncode(n.title) + '</h6>' +
                    '<p class="k-card-subtitle np-card-subtitle">' + kendo.htmlEncode(n.desc) + '</p>' +
                '</div>' +
                '<div class="np-card-time">' + n.time + '</div>' +
            '</div>';
    });

    html += '</div>'; /* end np-list */
    return html;
}

function _refreshNotifDialogContent() {
    var win = $("#np-dropdown").data("kendoWindow");
    if (win) {
        win.content(renderNotifPanel());
        _bindNotifDialogEvents();
    }
}

function _bindNotifDialogEvents() {
    var $el = $("#np-dropdown");

    $el.off("click.np");

    /* Mark all read */
    $el.on("click.np", "#np-mark-all", function (e) {
        e.stopPropagation();
        $.each(notificationsData, function (_, n) { n.read = true; });
        _refreshNotifDialogContent();
        updateBadge();
    });

    /* Dismiss individual */
    $el.on("click.np", ".np-dismiss", function (e) {
        e.stopPropagation();
        var id = parseInt($(this).data("id"), 10);
        notificationsData = notificationsData.filter(function (n) { return n.id !== id; });
        _refreshNotifDialogContent();
        updateBadge();
    });

    /* Action link — mark read and navigate */
    $el.on("click.np", ".np-action", function (e) {
        e.preventDefault();
        var id = parseInt($(this).data("id"), 10);
        var patientId = $(this).data("patient");
        $.each(notificationsData, function (_, n) { if (n.id === id) n.read = true; });
        updateBadge();

        var notif = notificationsData.filter(function (n) { return n.id === id; })[0];
        if (notif && notif.severity !== "system") {
            if (patientId) {
                window.location.href = "./patients";
            } else if (notif.title.indexOf("Schedule") >= 0 || notif.title.indexOf("Appointment") >= 0) {
                window.location.href = "./schedule";
            }
        }
        var dlg = $("#np-dropdown").data("kendoWindow");
        if (dlg) dlg.close();
    });
}

function openNotifPanel() {
    var win = $("#np-dropdown").data("kendoWindow");
    if (!win) return;

    if (win.wrapper && win.wrapper.is(":visible")) {
        win.close();
        return;
    }

    win.content(renderNotifPanel());
    win.open();
    _bindNotifDialogEvents();
}

function closeNotifPanel() {
    var win = $("#np-dropdown").data("kendoWindow");
    if (win) win.close();
}

function initNotifDropdown() {
    /* Inject dropdown container after the notif-wrap */
    if (!$("#np-dropdown").length) {
        $(".notif-wrap").append('<div id="np-dropdown"></div>');
    }

    /* Initialize as Kendo Window (non-modal positioned panel) */
    $("#np-dropdown").kendoWindow({
        title: false,
        width: 380,
        modal: false,
        visible: false,
        draggable: false,
        resizable: false,
        actions: ["Close"],
        appendTo: ".notif-wrap",
        animation: { open: { duration: 150 }, close: { duration: 100 } },
        open: function () {
            this.wrapper.addClass("np-dropdown");
            var btn = $("#notif-btn")[0].getBoundingClientRect();
            if (window.innerWidth <= 768) {
                /* On small screens the panel is appended inside notif-wrap which
                   sits mid-row, so position: absolute relative to it overflows.
                   Switch to fixed so coordinates are viewport-relative. */
                this.wrapper.css({
                    position: "fixed",
                    top:      Math.round(btn.bottom) + 8,
                    right:    8,
                    left:     "auto"
                });
            } else {
                this.wrapper.css({
                    position: "absolute",
                    top:      "calc(100% + 8px)",
                    right:    0,
                    left:     "auto"
                });
            }

            /* Close on outside click */
            setTimeout(function () {
                $(document).on("click.npoutside", function (e) {
                    if (!$(e.target).closest("#np-dropdown, #notif-btn").length) {
                        closeNotifPanel();
                    }
                });
            }, 0);
        },
        close: function () {
            $("#np-dropdown").off("click.np");
            $(document).off("click.npoutside");
        }
    });

    var count = getUnreadCount();
    $("#notif-btn").kendoButton({
        icon: "bell",
        text: '',
        badge: {
            text:       "",
            themeColor: "primary",
            rounded: "full",
            size:       "large",
            position:   "edge",
            align:      "top end",
            visible:    count > 0
        },     
        rounded: "full",
        click: function (e) {
            openNotifPanel();
        }
    });
}

$(document).ready(function () {
    buildProfileWindow();
    initProfileNotification();
    initProfileWindow();
    initProfileWidgets();
    initProfileTrigger();
    loadDoctorProfile();
    initNotifDropdown();
});
