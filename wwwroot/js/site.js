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

        /* Destroy all Kendo widgets in the old content to free memory.
           kendo.destroy walks the tree and calls destroy on each widget. */
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

    /* Settings button — toggle page dimming */
    $("#btn-settings").kendoButton({
        click: function () {
            $("#page-content").toggleClass("page-dimmed");
        }
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

    $("#appbar-nav").kendoSegmentedControl({
        items: [
            { text: "Home",               value: "Home" , icon: "home"},
            { text: "Schedule",           value: "Schedule", icon: "calendar" },
            { text: "Patients",           value: "Patients", icon: "user-outline" },
            { text: "Clinical Analytics", value: "Analytics", icon: "chart-bar-stacked" }
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

function ensurePatientSearchData(forceRefresh) {
    if (!forceRefresh && sharedPatients && sharedPatients.length) {
        return $.Deferred().resolve(sharedPatients).promise();
    }

    if (!forceRefresh && patientSearchRequest) {
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
