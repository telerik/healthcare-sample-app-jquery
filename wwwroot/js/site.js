﻿/* Declared before the eager call so the in-flight XHR reference is
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
    var navTransitionTimer = 0;
    showPageHeader(activePage);

    /* Settings button — toggle page dimming (persisted across navigation) */
    function updateLogo(dimmed) {
        $(".appbar-logo").toggleClass("show-dark", dimmed);
    }

    if (sessionStorage.getItem("pageDimmed") === "true") {
        $("#page-content").addClass("page-dimmed");
        $("#appbar").addClass("page-dimmed");
        updateLogo(true);
    } else {
        updateLogo(false);
    }

    $("#btn-settings").kendoButton({
        rounded: "full", 
        click: function () {
            var dimmed = !$("#page-content").hasClass("page-dimmed");
            $("#page-content").toggleClass("page-dimmed", dimmed);
            $("#appbar").toggleClass("page-dimmed", dimmed);
            updateLogo(dimmed);
            sessionStorage.setItem("pageDimmed", dimmed ? "true" : "false");
        }
    });

    /* ═══════════════════════════════════════════════
       APP BAR NAV — SegmentedControl
    ═══════════════════════════════════════════════ */

    var navItems = [
        { text: "Home", value: "Home", icon: "home", url: "./" },
        { text: "Schedule", value: "Schedule", icon: "calendar", url: "./schedule" },
        { text: "Patients", value: "Patients", icon: "user", url: "./patients" },
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
            if (!url || e.value === activePage) {
                return;
            }

            activePage = e.value;
            showPageHeader(activePage);

            clearTimeout(navTransitionTimer);
            navTransitionTimer = window.setTimeout(function () {
                window.location.href = url;
            }, 140);
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

     $("#btn-search-toggle").kendoButton({
        icon: 'search',
        rounded: "full",
        click: function (e) {
            var $appbar = $("#appbar");
            var isOpen = $appbar.toggleClass("search-open").hasClass("search-open");
            if (isOpen) {
                var ac = $("#appbar-search").data("kendoAutoComplete");
                if (ac) { ac.focus(); }
            }
        }
    });

    /* Close mobile search on click outside */
    $(document).on("click", function (e) {
        if (!$(e.target).closest("#appbar, .k-autocomplete-popup").length) {
            $("#appbar").removeClass("search-open");
        }
    });

    /* ═══════════════════════════════════════════════
       GITHUB SOURCE CODE BUTTON
    ═══════════════════════════════════════════════ */
    initGithubPopup();
});

/* ═══════════════════════════════════════════════════════
   GITHUB SOURCE CODE POPUP
═══════════════════════════════════════════════════════ */
function initGithubPopup() {
    var currentYear = new Date().getFullYear();

    $("#github-popup").kendoWindow({
        title: false,
        width: 260,
        modal: false,
        visible: false,
        draggable: false,
        resizable: false,
        actions: [],
        appendTo: ".github-wrap",
        animation: { open: { duration: 150 }, close: { duration: 100 } },
        open: function () {
            this.wrapper.addClass("github-popup");
            this.wrapper.css({
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                left: "auto"
            });
        }
    });

    var win = $("#github-popup").data("kendoWindow");
    win.content(
        '<div class="gh-popup-content">' +
            '<a href="https://github.com/telerik/healthcare-sample-app-jquery" target="_blank" rel="noopener noreferrer" class="gh-link">' +
                '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                    '<path fill-rule="evenodd" clip-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>' +
                '</svg>' +
                ' Get the Source Code' +
            '</a>' +
            '<p class="gh-copyright">Copyright \u00A9 ' + currentYear + ' Progress Software. All rights reserved.</p>' +
        '</div>'
    );   

     $("#btn-github").kendoButton({       
        rounded: "full",  
        click: function (e) {
            e.stopPropagation();
            var w = $("#github-popup").data("kendoWindow");
            if (w.wrapper && w.wrapper.is(":visible")) {
                w.close();
            } else {
                w.open();
            }
        }
    });

    $(document).on("click", function (e) {
        if (!$(e.target).closest(".github-wrap").length) {
            var w = $("#github-popup").data("kendoWindow");
            if (w) w.close();
        }
    });
}

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