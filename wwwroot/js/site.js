﻿// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

/* Declared before the eager call so the in-flight XHR reference is
   not overwritten when the var declaration is executed later in the file. */
var patientSearchRequest = null;

/* Start fetching the patient list eagerly — before DOM ready — so
   the autocomplete data is available as soon as the widget initialises. */
ensurePatientSearchData();

/* ═══════════════════════════════════════════════════════
   PAGE HEADERS — toggle persistent headers by page name
═══════════════════════════════════════════════════════ */
function showPageHeader(pageName) {
    $("#page-headers .page-header").each(function () {
        var $h = $(this);
        if ($h.attr("data-page") === pageName) {
            $h.addClass("active");
        } else {
            $h.removeClass("active");
        }
    });
}

/* ═══════════════════════════════════════════════════════
   THEME TOGGLE
═══════════════════════════════════════════════════════ */
$(document).ready(function () {   

    /* Show the correct page header on initial load */
    var activePage = $("#appbar-nav").attr("data-active-page") || "Home";
    showPageHeader(activePage);

    /* Settings button — toggle page dimming (persisted across navigation) */
    if (sessionStorage.getItem("pageDimmed") === "true") {
        $("#page-content").addClass("page-dimmed");
        $("#appbar").addClass("page-dimmed");
    }

    $("#btn-settings").kendoButton({
        click: function () {
            var dimmed = !$("#page-content").hasClass("page-dimmed");
            $("#page-content").toggleClass("page-dimmed", dimmed);
            $("#appbar").toggleClass("page-dimmed", dimmed);
            sessionStorage.setItem("pageDimmed", dimmed ? "true" : "false");
        }
    });

    /* ═══════════════════════════════════════════════
       APP BAR NAV — SegmentedControl
    ═══════════════════════════════════════════════ */

    var navItems = [
        { text: "Home", value: "Home", icon: "home", url: "./" },
        { text: "Schedule", value: "Schedule", icon: "calendar", url: "./schedule" },
        { text: "Patients", value: "Patients", icon: "user-outline", url: "./patients" },
        { text: "Clinical Analytics", value: "Analytics", icon: "chart-bar-stacked", url: "./analytics" }
    ];
    var navRoutes = {};
    var navIconDefs = [];

    navItems.forEach(function (item) {
        navRoutes[item.value] = item.url;
        navIconDefs.push(item.icon);
    });

    $("#appbar-nav").kendoSegmentedControl({
        items: navItems.map(function (item) {
            return {
                text: item.text,
                value: item.value,
                icon: item.icon
            };
        }),
        selectedValue: activePage,
        change: function (e) {
            var url = navRoutes[e.value];
            if (url) {
                window.location.href = url;
            }
        }
    });  

    /* Inject custom SVG icons into each button using kendo.ui.icon */
    $("#appbar-nav .k-button").each(function (i) {
        if (navIconDefs[i]) {
            var customIcon = kendo.ui.icon({ type: 'svg', icon: navIconDefs[i] });
            $(this).find(".k-button-text").before(customIcon);
        }
    });

    /* ═══════════════════════════════════════════════
       MOBILE NAV MENU (< 576px) — Kendo DropDownButton
    ═══════════════════════════════════════════════ */
    $("#hamburger-btn").kendoDropDownButton({
        icon: "menu",
        fillMode: "flat",
        popup: {
            appendTo: "#appbar"
        },
        items: navItems.map(function (item) {
            return {
                text: item.text,
                icon: item.icon,
                attributes: {
                    "data-page": item.value
                },
                click: function () {
                    window.location.href = item.url;
                }
            };
        }),
        open: function () {
            var items = this.items();
            items.removeClass("k-selected");
            items.filter("[data-page='" + activePage + "']").addClass("k-selected");
        }
    });
   

    /* ═══════════════════════════════════════════════
       MOBILE SEARCH ICON — toggle autocomplete
    ═══════════════════════════════════════════════ */
    $("#btn-search-toggle").on("click", function () {
        var $appbar = $("#appbar");
        var isOpen = $appbar.toggleClass("search-open").hasClass("search-open");
        if (isOpen) {
            var ac = $("#appbar-search").data("kendoAutoComplete");
            if (ac) { ac.focus(); }
        }
    });

    /* Close mobile search on click outside */
    $(document).on("click", function (e) {
        if (!$(e.target).closest("#appbar, .k-autocomplete-popup").length) {
            $("#appbar").removeClass("search-open");
        }
    });
});

/* ═══════════════════════════════════════════════════════
   GLOBAL PATIENT HEADER SEARCH
   The app bar search is intentionally consistent across pages:
   it searches patient records and navigates to the patient profile.
═══════════════════════════════════════════════════════ */
function navigateToPatientProfile(patient) {
    if (!patient || !patient.id) return;

    sessionStorage.setItem("openPatientId", patient.id);
   
    var patientsUrl = new URL("patients", document.baseURI).href;
    if (window.location.href.split("#")[0].split("?")[0] === patientsUrl) {
        window.location.hash = patient.id;
        return;
    }

    window.location.href = patientsUrl;
}

function ensurePatientSearchData(forceRefresh) {
    if (!forceRefresh && sharedPatients && sharedPatients.length) {
        return $.Deferred().resolve(sharedPatients).promise();
    }

    if (!forceRefresh && patientSearchRequest) {
        return patientSearchRequest;
    }

    patientSearchRequest = $.getJSON("./api/patients")
        .done(function (patients) {
            sharedPatients = patients || [];
        })
        .always(function () {
            patientSearchRequest = null;
        });

    return patientSearchRequest;
}

function initContextualSearch() {
    var $input = $("#appbar-search");
    if (!$input.length) return;
    if ($input.data("kendoAutoComplete")) return;

    function buildSearchItems(patients) {
        return patients.map(function (p) {
            return {
                text:      p.name + " " + p.id + " " + p.phone,
                name:      p.name,
                sub:       p.id + " · " + p.phone,
                patientId: p.id
            };
        });
    }
    
    ensurePatientSearchData().done(function (patients) {
        if ($input.data("kendoAutoComplete")) return;

        $input.kendoAutoComplete({
            dataSource:    { data: buildSearchItems(patients) },
            dataTextField: "text",
            filter:        "contains",
            minLength:     1,
            rounded:       "full",
            clearButton:   true,
            adaptiveMode:  "auto",
            placeholder:   "Search patients by name, ID or phone…",
            prefixOptions: { icon: "search", separator: false },
            template: ({ name, sub }) => `<div class="search-result-item"><span class="search-result-name">${kendo.htmlEncode(name)}</span><span class="search-result-sub">${kendo.htmlEncode(sub)}</span></div>`,
            select: function (e) {
                e.preventDefault();
                var item = e.dataItem;
                if (!item) {
                    // Fallback: derive item from the highlighted list element
                    var $li = $(e.item);
                    if ($li.length) {
                        var ds = this.dataSource;
                        var idx = $li.index();
                        item = ds.view()[idx] || ds.data()[idx];
                    }
                }
                if (!item || !item.patientId) return;
                var patient = getPatientById(item.patientId) || findPatient(item.patientId) || { id: item.patientId };
                this.value(item.name);
                this.close();
                $input.removeClass("search-no-match");
                navigateToPatientProfile(patient);
            }
        });
    });
}

function applySharedDialogShell(dialog) {
    if (!dialog || !dialog.wrapper) return;
    dialog.wrapper.closest(".k-dialog-wrapper").addClass("app-dialog-shell");
}

$(document).ready(function () {
    initContextualSearch();
});