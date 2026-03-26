// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

/* Declared before the eager call so the in-flight XHR reference is
   not overwritten when the var declaration is executed later in the file. */
var patientSearchRequest = null;

/* Start fetching the patient list eagerly — before DOM ready — so
   the autocomplete data is available as soon as the widget initialises. */
ensurePatientSearchData();

/* ═══════════════════════════════════════════════════════
   PJAX — keep the appbar alive, swap only #page-content
═══════════════════════════════════════════════════════ */
var _pjaxBusy = false;
var _currentPageScript = null;   // <script> element of the active page

function pjaxNavigate(url, pushState) {
    if (_pjaxBusy) return;
    _pjaxBusy = true;

    var $content = $("#page-content");
    $content.removeClass("page-ready").addClass("page-loading");

    $.ajax({
        url: url,
        dataType: "html",
        cache: false
    }).done(function (html) {
        var parsed = $($.parseHTML(html, document, true));

        /* Extract the new page content */
        var newContent = parsed.filter("#page-content").add(parsed.find("#page-content"));
        if (!newContent.length) {
            /* Fallback: if the response is unusual, do a full reload */
            window.location.href = url;
            return;
        }

        /* Find page-specific script(s) from the response body */
        var pageScripts = [];
        parsed.filter("script[src]").each(function () {
            var src = $(this).attr("src") || "";
            if (src.indexOf("/js/app.js")       !== -1 ||
                src.indexOf("/js/schedule.js")   !== -1 ||
                src.indexOf("/js/patients.js")   !== -1 ||
                src.indexOf("/js/analytics.js")  !== -1) {
                pageScripts.push(src);
            }
        });

        /* Destroy all Kendo widgets in the old content to free memory */
        $content.find("[data-role]").each(function () {
            var w = kendo.widgetInstance($(this));
            if (w && typeof w.destroy === "function") { w.destroy(); }
        });
        /* Also destroy widgets attached by class (Charts, Grids, etc.) */
        kendo.destroy($content);

        /* Remove any floating popups / animation containers owned by old widgets,
           but keep the ones belonging to the appbar search autocomplete. */
        var searchPopup = $("#appbar-search").data("kendoAutoComplete");
        var searchAnimC = searchPopup && searchPopup.popup ? searchPopup.popup.wrapper.closest(".k-animation-container")[0] : null;
        $("body > .k-animation-container, body > .k-popup, body > .k-overlay").filter(function () {
            return this !== searchAnimC;
        }).remove();

        /* Remove previously injected page script */
        if (_currentPageScript) {
            $(_currentPageScript).remove();
            _currentPageScript = null;
        }

        /* Swap content */
        $content.html(newContent.html());

        /* Update history */
        if (pushState !== false) {
            history.pushState({ pjax: true, url: url }, "", url);
        }

        /* Load and execute the new page script */
        if (pageScripts.length) {
            /* Strip cache-busting query and re-add a timestamp to force re-execution */
            var src = pageScripts[0].replace(/\?v=.*$/, "") + "?_=" + Date.now();
            var script = document.createElement("script");
            script.src = src;
            script.onload = function () {
                $content.removeClass("page-loading").addClass("page-ready");
                _pjaxBusy = false;
            };
            script.onerror = function () {
                $content.removeClass("page-loading").addClass("page-ready");
                _pjaxBusy = false;
            };
            _currentPageScript = script;
            document.body.appendChild(script);
        } else {
            $content.removeClass("page-loading").addClass("page-ready");
            _pjaxBusy = false;
        }

    }).fail(function () {
        /* On network error fall back to traditional navigation */
        window.location.href = url;
    });
}

/* Browser back / forward */
$(window).on("popstate", function (e) {
    var state = e.originalEvent.state;
    if (state && state.pjax) {
        var seg = $("#appbar-nav").data("kendoSegmentedControl");
        var pageValue = _urlToPage(state.url);
        if (seg && pageValue) { seg.select(pageValue); }
        pjaxNavigate(state.url, false);
    }
});

function _urlToPage(url) {
    var path = url.replace(/^https?:\/\/[^/]+/, "").toLowerCase();
    if (path === "/" || path === "")          return "Home";
    if (path.indexOf("/schedule") === 0)     return "Schedule";
    if (path.indexOf("/patients") === 0)     return "Patients";
    if (path.indexOf("/analytics") === 0)    return "Analytics";
    return null;
}

/* ═══════════════════════════════════════════════════════
   THEME TOGGLE
═══════════════════════════════════════════════════════ */
$(document).ready(function () {
    var LIGHT = "https://kendo.cdn.telerik.com/themes/13.0.0/default/default-main.css";
    var DARK  = "https://kendo.cdn.telerik.com/themes/13.0.0/default/default-main-dark.css";

    $("#btn-theme-toggle").on("click", function () {
        var $link  = $("#kendo-theme");
        var isDark = $link.attr("href") === DARK;
        $link.attr("href", isDark ? LIGHT : DARK);
        $("body").toggleClass("theme-dark", !isDark);
        $(this).attr("title", isDark ? "Toggle Dark Theme" : "Toggle Light Theme");
    });

    /* Settings button — toggle page dimming */
    $("#btn-settings").on("click", function () {
        $("#page-content").toggleClass("page-dimmed");
    });

    /* ═══════════════════════════════════════════════
       APP BAR NAV — SegmentedControl
    ═══════════════════════════════════════════════ */
    var navRoutes = {
        "Home":      "/",
        "Schedule":  "/Schedule",
        "Patients":  "/Patients",
        "Analytics": "/Analytics"
    };

    var activePage = $("#appbar-nav").attr("data-active-page") || "Home";

    var navIconDefs = [
        { viewBox: '0 0 16 16', content: '<path d="M10 14V8.66667C10 8.48986 9.92976 8.32029 9.80474 8.19526C9.67971 8.07024 9.51014 8 9.33333 8H6.66667C6.48986 8 6.32029 8.07024 6.19526 8.19526C6.07024 8.32029 6 8.48986 6 8.66667V14" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 6.66666C1.99995 6.47271 2.04222 6.28108 2.12386 6.10514C2.20549 5.9292 2.32453 5.77319 2.47267 5.64799L7.13933 1.64799C7.37999 1.4446 7.6849 1.33301 8 1.33301C8.3151 1.33301 8.62001 1.4446 8.86067 1.64799L13.5273 5.64799C13.6755 5.77319 13.7945 5.9292 13.8761 6.10514C13.9578 6.28108 14 6.47271 14 6.66666V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V6.66666Z" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>' },
        { viewBox: '0 0 16 16', content: '<path d="M5.33337 1.33337V4.00004" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.6666 1.33337V4.00004" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.6667 2.66663H3.33333C2.59695 2.66663 2 3.26358 2 3.99996V13.3333C2 14.0697 2.59695 14.6666 3.33333 14.6666H12.6667C13.403 14.6666 14 14.0697 14 13.3333V3.99996C14 3.26358 13.403 2.66663 12.6667 2.66663Z" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 6.66663H14" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>' },
        { viewBox: '0 0 16 16', content: '<path d="M1.33337 14.0001C1.33328 13.1375 1.54238 12.2878 1.94276 11.5238C2.34313 10.7599 2.92283 10.1044 3.63214 9.6136C4.34145 9.12283 5.15921 8.81142 6.0153 8.70607C6.87138 8.60072 7.74024 8.70457 8.54737 9.00873" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.252 11.0841C14.5176 10.8185 14.6668 10.4583 14.6668 10.0827C14.6668 9.70715 14.5176 9.34696 14.252 9.08139C13.9865 8.81582 13.6263 8.66663 13.2507 8.66663C12.8751 8.66663 12.5149 8.81582 12.2494 9.08139L9.57603 11.7561C9.41752 11.9145 9.30151 12.1103 9.23869 12.3254L8.68069 14.2387C8.66396 14.2961 8.66296 14.3569 8.67779 14.4148C8.69262 14.4727 8.72274 14.5255 8.76499 14.5678C8.80724 14.61 8.86008 14.6401 8.91796 14.655C8.97585 14.6698 9.03666 14.6688 9.09402 14.6521L11.0074 14.0941C11.2225 14.0312 11.4183 13.9152 11.5767 13.7567L14.252 11.0841Z" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.66671 8.66667C8.50766 8.66667 10 7.17428 10 5.33333C10 3.49238 8.50766 2 6.66671 2C4.82576 2 3.33337 3.49238 3.33337 5.33333C3.33337 7.17428 4.82576 8.66667 6.66671 8.66667Z" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>' },
        { viewBox: '0 0 16 16', content: '<path d="M2 2V12.6667C2 13.0203 2.14048 13.3594 2.39052 13.6095C2.64057 13.8595 2.97971 14 3.33333 14H14" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.99996 8.66663H5.33329C4.9651 8.66663 4.66663 8.9651 4.66663 9.33329V10.6666C4.66663 11.0348 4.9651 11.3333 5.33329 11.3333H9.99996C10.3681 11.3333 10.6666 11.0348 10.6666 10.6666V9.33329C10.6666 8.9651 10.3681 8.66663 9.99996 8.66663Z" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3.33337H5.33329C4.9651 3.33337 4.66663 3.63185 4.66663 4.00004V5.33337C4.66663 5.70156 4.9651 6.00004 5.33329 6.00004H12C12.3681 6.00004 12.6666 5.70156 12.6666 5.33337V4.00004C12.6666 3.63185 12.3681 3.33337 12 3.33337Z" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>' }
    ];

    $("#appbar-nav").kendoSegmentedControl({
        items: [
            { text: "Home",               value: "Home" },
            { text: "Schedule",           value: "Schedule" },
            { text: "Patients",           value: "Patients" },
            { text: "Clinical Analytics", value: "Analytics" }
        ],
        selectedValue: activePage,
        change: function (e) {
            var url = navRoutes[e.value];
            if (url) {
                pjaxNavigate(url, true);
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

    /* Record the initial page in history so back-button works */
    history.replaceState({ pjax: true, url: window.location.href }, "", window.location.href);
});

/* ═══════════════════════════════════════════════════════
   GLOBAL PATIENT HEADER SEARCH
   The app bar search is intentionally consistent across pages:
   it searches patient records and navigates to the patient profile.
═══════════════════════════════════════════════════════ */
function navigateToPatientProfile(patient) {
    if (!patient || !patient.id) return;

    sessionStorage.setItem("openPatientId", patient.id);

    if (window.location.pathname.toLowerCase().indexOf("/patients") !== -1) {
        window.location.hash = patient.id;
        return;
    }

    /* Use PJAX to stay on the same page shell */
    var seg = $("#appbar-nav").data("kendoSegmentedControl");
    if (seg) { seg.select("Patients"); }
    pjaxNavigate("/Patients", true);
}

function ensurePatientSearchData() {
    if (sharedPatients && sharedPatients.length) {
        return $.Deferred().resolve(sharedPatients).promise();
    }

    if (patientSearchRequest) {
        return patientSearchRequest;
    }

    patientSearchRequest = $.getJSON("/api/patients")
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

    /* Use an explicit DataSource instance so we keep a reference and can
       populate it once the patient list arrives without recreating the widget. */
    var searchDataSource = new kendo.data.DataSource({ data: [] });

    $input.kendoAutoComplete({
        dataSource:    searchDataSource,
        dataTextField: "text",
        filter:        "contains",
        minLength:     1,
        rounded:       "full",
        placeholder:   "Search patients by name, ID or phone…",
        prefixOptions: { icon: "search", separator: false },
        template:      '<div class="search-result-item">' +
                       '<span class="search-result-name">#: name #</span>' +
                       '<span class="search-result-sub">#: sub #</span>' +
                       '</div>',
        select: function (e) {
            e.preventDefault();
            var item = e.dataItem;
            var patient = getPatientById(item.patientId) || findPatient(item.patientId) || { id: item.patientId };
            this.value("");
            this.close();
            $input.removeClass("search-no-match");
            navigateToPatientProfile(patient);
        }
    });

    //$input.off("keydown.patient-search").on("keydown.patient-search", function (e) {
    //    var patient;
    //    if (e.key !== "Enter") return;
//
    //    patient = findPatient($(this).val().trim());
    //    if (!patient) {
    //        $(this).addClass("search-no-match");
    //        return;
    //    }
//
    //    $(this).val("").removeClass("search-no-match");
    //    navigateToPatientProfile(patient);
    //});
//
    //$input.off("input.patient-search").on("input.patient-search", function () {
    //    $(this).removeClass("search-no-match");
    //});

    /* Populate the DataSource once the patient list is available.
       ensurePatientSearchData() was called eagerly at file load, so by the
       time DOM-ready fires the XHR is usually already resolved. */
    ensurePatientSearchData().done(function (patients) {
        searchDataSource.data(patients.map(function (p) {
            return {
                text:      p.name + " " + p.id + " " + p.phone,
                name:      p.name,
                sub:       p.id + " · " + p.phone,
                patientId: p.id
            };
        }));
    });
}

function applySharedDialogShell(dialog) {
    if (!dialog || !dialog.wrapper) return;
    dialog.wrapper.closest(".k-dialog-wrapper").addClass("app-dialog-shell");
}

$(document).ready(function () {
    initContextualSearch();
});
