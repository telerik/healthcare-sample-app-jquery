/* ═══════════════════════════════════════════════════════
   CLINICAL ANALYTICS PAGE — DATA loaded remotely from /api
═══════════════════════════════════════════════════════ */
var patientsData   = [];
var analyticsData  = {};

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

    // Labs bullet chart
    var labsChart = $("#labs-chart").data("kendoChart");
    if (labsChart) {
        labsChart.dataSource.data(data.labResults);
        labsChart.refresh();
    }

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
        patientsData  = Array.isArray(patientsResp) ? patientsResp : (patientsResp[0] || []);
        analyticsData = analyticsResp[0];

        $("#patient-select").kendoDropDownList({
            dataSource:    patientsData,
            width: 300,
            dataTextField: "name",
            dataValueField: "id",
            rounded:       "large",
            autoWidth:     true,
            filter: 'contains',
            template: '<span>#: name # (#: id #)</span>',
            valueTemplate: '<span>#: name # (#: id #)</span>',
            change: function () {
                updateAllCharts(this.value());
            }
        });

        if (patientsData.length > 0) {
            updateAllCharts(patientsData[0].id);
        }

        $("#page-content").removeClass("page-loading").addClass("page-ready");
    });

    // ── Export Button ──────────────────────────────────
    $("#btn-export").kendoButton({
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
        centerTemplate: '<div class="risk-gauge-center"><span class="risk-score-pct" style="color: #: color #;">#: value #%</span><span class="risk-score-outof">Out of 100</span></div>',
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
            labels:     { visible: false },
            majorTicks: { visible: false },
            minorTicks: { visible: false },
            rangePlaceholderColor: "#e8e8e8",
            rangeSize: 16,
            rangeLineCap: "round"
        },
        gaugeArea: { background: "transparent" }
    });

    // ── Lab Results Bullet Chart ───────────────────────
    $("#labs-chart").kendoChart({
        legend: { visible: false },
        seriesDefaults: { type: "bullet", gap: 0.6, spacing: 0.25 },
        series: [{
            color: function (e) {
                var d = e.dataItem;
                if (!d) return "#1a874a";
                if (d.value > d.warningMax) return "#c0345a";
                if (d.value > d.normalMax)  return "#b8860b";
                return "#1a874a";
            },
            target: {
                color: "#444",
                line:  { width: 3 }
            },
            currentField: "value",
            targetField:  "normalMax"
        }],
        categoryAxis: {
            field: "name",
            majorGridLines: { visible: false }
        },
        valueAxis: {
            majorGridLines: { color: "#f0eeff" },
            labels: { format: "{0}" }
        },
        tooltip: {
            visible:  true,
            template: "#= category #<br/>Max: #= dataItem.normalMax # #= dataItem.unit #<br/>Ave: <strong>#= value.current #</strong> #= dataItem.unit #"
        },
        chartArea:  { background: "transparent" },
        dataSource: { data: [] }
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
            }
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

});
