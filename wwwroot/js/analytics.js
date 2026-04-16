/* ═══════════════════════════════════════════════════════
   CLINICAL ANALYTICS PAGE — DATA loaded remotely from /api
═══════════════════════════════════════════════════════ */
var patientsData   = [];
var analyticsData  = {};
var lastDonutSmall = null;

function updateDonutLabels() {
    var donut = $("#alerts-donut-chart").data("kendoChart");
    if (!donut) return;
    var isSmall = window.innerWidth < 730;
    if (isSmall === lastDonutSmall) return;
    lastDonutSmall = isSmall;
    var series = donut.options.series[0];
    series.labels.position = isSmall ? "insideEnd" : "outsideEnd";
    series.labels.distance = isSmall ? 0 : 20;
    series.labels.align = isSmall ? "circle" : "column";
    series.labels.connectors.width = isSmall ? 0 : 1;
    donut.redraw();
}

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
function avg(arr, field) {
    var sum = arr.reduce(function (acc, d) { return acc + d[field]; }, 0);
    return Math.round(sum / arr.length);
}

function legendItemVisual(e) {
        var color = e.options.markers.background;
        var labelColor = e.options.labels.color;
        var labelText = e.text || e.series.name || "";
        var rect = new kendo.geometry.Rect([0, 0], [150, 75]);
        var layout = new kendo.drawing.Layout(rect, {
            spacing: 4,
            alignItems: "center"
        });
        var circle = new kendo.drawing.Circle(new kendo.geometry.Circle([0, 0], 5), {
            fill:   { color: color },
            stroke: { color: color }
        });
        var label = new kendo.drawing.Text(labelText, [0, 0], {
            fill: { color: labelColor }
        });
        layout.append(circle, label);
        layout.reflow();
        return layout;
}

/* ═══════════════════════════════════════════════════════
   LAB RESULTS — one bullet chart per metric
═══════════════════════════════════════════════════════ */
function buildLabCharts(labResults) {
    var $container = $("#labs-charts-container");

    // Destroy any existing per-metric charts
    $container.find("[id^='klab-']").each(function () {
        var w = $(this).data("kendoChart");
        if (w) { w.destroy(); }
    });
    $container.empty();

    $.each(labResults, function (i, d) {
        var isBelow  = d.value < d.normalMin;
        var isAbove  = d.value > d.normalMax;
        var barColor = isBelow ? "#e8735a" : (isAbove ? "#f5c842" : "#4ade80");
        var tVal     = isBelow ? d.normalMin : d.normalMax;

        // Compute the upper bound: gives the lightest band visible room
        var axisMax = Math.max(d.value * 1.15, d.normalMax + 0.8 * (d.normalMax - d.normalMin));

        var chartId = "klab-" + i;

        // Flex row: fixed-width label  +  chart (no category-axis label)
        // All charts start at exactly the same x position.
        $container.append(
            '<div class="klab-row">' +
                '<span class="klab-label">' + kendo.htmlEncode(d.name) + '</span>' +
                '<div id="' + chartId + '" class="klab-chart"></div>' +
            '</div>'
        );

        $("#" + chartId).kendoChart({
            legend: { visible: false },
            seriesDefaults: { type: "bullet", gap: 0.45, spacing: 0 },
            series: [{
                color: barColor,
                target: {
                    color: "#1e293b",
                    line:  { width: 3 }
                },
                data: [[d.value, tVal]]
            }],
            categoryAxis: {
                categories: [d.name],
                majorGridLines: { visible: false },
                labels: { visible: false}
            },
            valueAxis: {
                name: "v",
                min: 0,
                max: axisMax,
                plotBands: [
                    { from: 0,           to: d.normalMin, color: "#b8b8b8" },
                    { from: d.normalMin, to: d.normalMax, color: "#d4d4d4" },
                    { from: d.normalMax, to: axisMax,     color: "#ececec" }
                ],
                majorGridLines: { color: "#f0eeff" },
                labels: { format: "{0}"}
            },
            tooltip: {
                visible: true,
                template: (function (capturedD) {
                    return function (e) {
                        return "Min: " + capturedD.normalMin + "  Max: " + capturedD.normalMax + " " + capturedD.unit +
                               "<br/>Result: <strong>" + e.value.current + "</strong> " + capturedD.unit;
                    };
                })(d)
            },
            chartArea: { background: "transparent", height: 75 }
        });
    });
}

/* ═══════════════════════════════════════════════════════
   CHART DATA REFRESH
═══════════════════════════════════════════════════════ */
function updateAllCharts(id) {
    var data = analyticsData[id];
    if (!data) return;

    // Vitals line chart
    var vitalsChart = $("#vitals-chart").data("kendoChart");
    if (vitalsChart) {
        vitalsChart.dataSource.data(data.vitalsHistory);
        vitalsChart.refresh();
    }

    // Labs bullet charts (per metric)
    buildLabCharts(data.labResults);

    // Risk gauge
    var gauge = $("#risk-gauge").data("kendoArcGauge");
    if (gauge) {
        gauge.value(data.riskScore);
    }

    // Alerts stacked column
    var colChart = $("#alerts-column-chart").data("kendoChart");
    if (colChart) {
        colChart.dataSource.data(data.alertsOverTime);
        colChart.refresh();
    }

    // Alerts donut
    var donutChart = $("#alerts-donut-chart").data("kendoChart");
    if (donutChart) {
        donutChart.dataSource.data(data.alertsByType);
        donutChart.refresh();
    }

    // Re-apply responsive donut labels after data refresh
    lastDonutSmall = null;
    updateDonutLabels();
}

/* ═══════════════════════════════════════════════════════
   DOCUMENT READY
═══════════════════════════════════════════════════════ */
$(document).ready(function () {

    // Notification badge is managed by profile.js initNotifDropdown()

    // ── Patient Selection DropDownList ─────────────────
    $.when(
        ensurePatientSearchData(),
        $.getJSON("/api/analytics")
    ).done(function (patientsResp, analyticsResp) {
        // $.when wraps jqXHR results as [data, textStatus, jqXHR],
        // but a plain Deferred.resolve(value) passes the value directly.
        patientsData  = (Array.isArray(patientsResp) && patientsResp.length > 0 && Array.isArray(patientsResp[0]))
            ? patientsResp[0]
            : (Array.isArray(patientsResp) ? patientsResp : []);
        analyticsData = Array.isArray(analyticsResp) ? analyticsResp[0] : analyticsResp;

        var existingDDL = $("#patient-select").data("kendoDropDownList");
        if (existingDDL) {
            existingDDL.setDataSource(new kendo.data.DataSource({ data: patientsData }));
        } else {
            $("#patient-select").kendoDropDownList({
                dataSource:    patientsData,
                width: 300,
                dataTextField: "name",
                dataValueField: "id",
                rounded:       "large",
                autoWidth:     true,
                filter: 'contains',
                template: ({ name, id }) => `<span>${kendo.htmlEncode(name)} (${kendo.htmlEncode(id)})</span>`,
                valueTemplate: ({ name, id }) => `<span>${kendo.htmlEncode(name)} (${kendo.htmlEncode(id)})</span>`,
                change: function () {
                    updateAllCharts(this.value());
                }
            });
        }

        if (patientsData.length > 0) {
            updateAllCharts(patientsData[0].id);
        }

        $("#page-content").removeClass("page-loading").addClass("page-ready");
        $(".analytics-header-controls").addClass("is-ready");
    });

    // ── Export Button ──────────────────────────────────
    if (!$("#btn-export-analytics").data("kendoButton")) {
        $("#btn-export-analytics").kendoButton({
            icon:    "download",
            rounded: "large",
            click: function () {  
                kendo.drawing.drawDOM($("#analytics-body"), {
                    paperSize: "auto"
                }).then(function (group) {
                    return kendo.drawing.exportPDF(group, { multiPage: true });
                }).done(function (data) {
                    kendo.saveAs({
                        dataURI:  data,
                        fileName: "analytics-report.pdf"
                    });
                });
            }
        });
    }

    // ── Vitals Line Chart ──────────────────────────────
    $("#vitals-chart").kendoChart({
        legend: {
            position: "bottom",
            item: { visual: legendItemVisual }
        },
        seriesDefaults: { type: "line", style: "smooth", markers: { visible: true, size: 5 } },
        series: [
            { name: "Systolic BP",   field: "systolic",    color: "#e84c6e" },
            { name: "Diastolic BP",  field: "diastolic",   color: "#f0c040" },
            { name: "Heart Rate",    field: "heartRate",   color: "#27ae60" },
            { name: "SpO\u2082 (%)", field: "spo2",        color: "#2980b9" },
            { name: "Temperature",   field: "temperature", color: "#8e44ad" }
        ],
        categoryAxis: {
            field: "date",
            majorGridLines: { visible: false },
            labels: { rotation: 0 }
        },
        valueAxis: {
             min: 50,
            labels: { format: "{0}" },
            majorGridLines: { color: "#f0eeff" }
        },
        tooltip: {
            visible: true,
            shared:  true
        },
        chartArea: { background: "transparent" },
        dataSource: { data: [] }
    });

    // ── Arc Risk Gauge ──────────────────────────────
    $("#risk-gauge").kendoArcGauge({
        value: 0,
        centerTemplate: ({ color, value }) => `<div class="risk-gauge-center"><span class="risk-score-pct" style="color: ${color};">${value}%</span><span class="risk-score-outof">Out of 100</span></div>`,
        colors: [{
            to: 25,
            color: '#0058e9'
        }, {
            from: 25,
            to: 50,
            color: '#37b400'
        }, {
            from: 50,
            to: 75,
            color: '#ffc000'
        }, {
            from: 75,
            color: '#f31700'
        }],
        scale: {
            min: 0,
            max: 100,
            labels:     { visible: false  },
            majorTicks: { visible: false },
            minorTicks: { visible: false },
            rangePlaceholderColor: "#e8e8e8",
            rangeSize: 16,
            rangeLineCap: "round"
        },
        gaugeArea: { background: "transparent", margin: 30 },
    });

    // ── Alerts Stacked Column Chart ────────────────────
    $("#alerts-column-chart").kendoChart({
        legend: {
            position: "bottom",
            item: { visual: legendItemVisual }
        },
        seriesDefaults: { type: "column", stack: true },
        series: [
            { name: "Critical", field: "critical", color: "#c0345a" },
            { name: "Warning",  field: "warning",  color: "#b8860b" },
            { name: "Info",     field: "info",      color: "#1a6db8" }
        ],
        categoryAxis: {
            field: "day",
            majorGridLines: { visible: false }
        },
        valueAxis: {
            title:          { text: "Alert Count" },
            majorGridLines: { color: "#f0eeff" }
        },
        tooltip:    { visible: true, shared: true },
        chartArea:  { background: "transparent" },
        dataSource: { data: [] }
    });

    // ── Alerts by Type Donut Chart ─────────────────────
    $("#alerts-donut-chart").kendoChart({
        legend: {
            position: "bottom",
            spacing: 8,
            labels: {
                font: "12px Poppins, sans-serif",
                color: "#4A5666"
            },
            //item: { visual: legendItemVisual }
        },
        series: [{
            type:          "donut",
            field:         "value",
            categoryField: "category",
            padding:       30,
            holeSize:      90,
            startAngle:    90,
            labels: {
                visible:    true,
                template:   function (e) { return e.category; },
                align:      "column",
                position:   "outsideEnd",
                distance:   20,
                font:       "13px Poppins, sans-serif",
                color:      "#232A36",
                connectors: {
                    width:   1,
                    color:   "#94a3b8",
                    padding: 8
                }
            },
            overlay: { gradient: "none" }
        }],
        seriesColors: ["#e8735a", "#f0c040", "#27ae60", "#2c3e8a", "#9b59b6", "#e91e8c"],
        tooltip: {
            visible:  true,
            template: function (e) { return e.category + ": " + e.value + " alerts (" + kendo.format("{0:P0}", e.percentage) + ")"; }
        },
        chartArea:  { background: "transparent" },
        dataSource: { data: [] }
    });

    // ── Initial load with first patient ───────────────
    // Initial chart load is called after the API responds (inside $.when above)

    // ── Resize charts on window resize ────────────────
    var resizeTimer;

    $(window).on("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            $("#vitals-chart, #alerts-column-chart, #alerts-donut-chart").each(function () {
                var chart = $(this).data("kendoChart");
                if (chart) { chart.resize(); }
            });
            var gauge = $("#risk-gauge").data("kendoArcGauge");
            if (gauge) { gauge.resize(); }
            $("[id^='klab-']").each(function () {
                var chart = $(this).data("kendoChart");
                if (chart) { chart.resize(); }
            });
            updateDonutLabels();
        }, 150);
    });

    // Apply on initial load too
    setTimeout(updateDonutLabels, 300);

});
