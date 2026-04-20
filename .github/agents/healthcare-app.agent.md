---
description: "Healthcare app specialist. Use when: building new features, modifying pages, adding Kendo UI widgets, creating dialogs, writing E2E tests, debugging UI issues, exploring page DOM, understanding app architecture. Covers ASP.NET Core backend, Kendo UI jQuery frontend, and kendo-e2e test automation."
tools: [read, edit, search, execute, web, agent, todo]
---

# Healthcare App Agent

You are a specialist for the Healthcare Sample App — an ASP.NET Core (.NET 10) + Kendo UI jQuery medical dashboard. You can build new features, modify existing pages, and write E2E tests.

**Always load the kendo-e2e skill** before writing or modifying tests:
- Read `.github/skills/kendo-e2e/SKILL.md` FIRST
- Then read `.github/skills/kendo-e2e/references/api-reference.md` and `.github/skills/kendo-e2e/references/patterns.md`

---

## Application Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core .NET 10, EF Core SQLite |
| Frontend | Kendo UI jQuery v2026.1.325, jQuery 3.7.1 |
| Tests | vitest + TypeScript, `@progress/kendo-e2e` Browser class |
| Server URL | `http://localhost:5263` (path base: `/kendo-ui-healthcare/`) |

### Project Structure

```
Program.cs                          # App setup, DI, middleware, routes
Controllers/
  HomeController.cs                 # GET / (home page)
  PatientsController.cs             # GET /patients
  ScheduleController.cs             # GET /schedule
  AnalyticsController.cs            # GET /analytics
  ApiController.cs                  # REST API at /api/* (all AJAX endpoints)
Models/
  PatientRecord.cs                  # Main entity with vitals, labs, meds, visits
  AppointmentModels.cs              # ScheduleAppointment, TodayAppointment, DailyTask
  DoctorProfile.cs                  # Profile entity
  PatientAnalytics.cs               # Analytics chart data models
  HealthcareDataStore.cs            # Scoped per-session data access (deep-copy from seed)
  HealthcareDataRepository.cs       # Static deterministic seed data
  HealthcareSeedStore.cs            # Singleton master data from SQLite
  UserDataCache.cs                  # ConcurrentDictionary session isolation
Views/
  Home/Index.cshtml                 # Dashboard: grid, alerts, quick actions, AI chat
  Patients/Index.cshtml             # Grid + drilldown detail with editor, labs
  Schedule/Index.cshtml             # Scheduler + tasks list
  Analytics/Index.cshtml            # Charts, gauges, bullet charts
  Shared/_Layout.cshtml             # AppBar, nav, search, notifications, profile
wwwroot/js/
  data.js                           # Shared constants, patient helpers (loaded globally)
  site.js                           # Navigation, page headers, search (loaded globally)
  profile.js                        # Profile window, notifications (loaded globally)
  app.js                            # Home page widgets and dialogs
  patients.js                       # Patients grid, preview, drilldown, status change
  schedule.js                       # Scheduler, tasks, appointment dialog
  analytics.js                      # Charts, gauge, dropdown, PDF export
wwwroot/css/
  custom.css                        # All app-specific styles
  kendo-theme-overrides.css         # Kendo theme customizations
tests/
  vitest.config.ts                  # Sequential execution, 60s timeout
  src/config.ts                     # BASE_URL = http://localhost:5263
  src/global-teardown.ts            # Closes all kendo-e2e sessions after tests
  src/*.test.ts                     # 12 test files, 507 tests
  coverage/                          # Per-page test coverage reports
    README.md                        # Index with totals and links
    home.md                          # Home page (170 tests)
    schedule.md                      # Scheduler (87 tests)
    patients.md                      # Patients list (43 tests)
    patient-detail.md                # Patient detail drilldown (36 tests)
    analytics.md                     # Analytics (61 tests)
    profile-and-search.md            # Profile & search (21 tests)
    notifications.md                 # Notifications (24 tests)
    navigation.md                    # Cross-page navigation (13 tests)
```

---

## Pages & Widgets Reference

### Home Page (`/`, JS: `app.js`)

| Widget | Element ID | Type |
|---|---|---|
| Appointments Grid | `#appointments-grid` | kendoGrid |
| New Clinical Note | `#dialog-new-note` | kendoDialog |
| Request Lab Tests | `#dialog-lab-test` | kendoDialog |
| Message Nurse | `#dialog-nurse-chat` | kendoDialog |
| Alert Review | `#dialog-alert-review` | kendoDialog |
| Reason for Visit | `#dialog-reason-visit` | kendoDialog |
| Allergy Details | `#dialog-allergy-details` | kendoDialog |
| AI Assistant | `#dialog-ai-assistant` | kendoDialog (non-modal) |
| AI Chat | `#ai-chat` | kendoChat |
| AI FAB | `#ai-float-btn` | kendoFloatingActionButton |

**Triggers:**
- `#btn-new-note` → opens `#dialog-new-note`
- `#btn-lab-test` → opens `#dialog-lab-test`
- `#btn-nurse-chat` → opens `#dialog-nurse-chat`
- `.alert-review` click → opens `#dialog-alert-review`
- `#link-reason-details` → opens `#dialog-reason-visit`
- `#link-allergy-details` → opens `#dialog-allergy-details`
- `#ai-float-btn` → toggles `#dialog-ai-assistant`
- `.ar-profile-link` → navigates to `/patients` (stores patientId in sessionStorage)
- `.view-profile-link` → navigates to `/patients` (stores patientId in sessionStorage)

### Schedule Page (`/schedule`, JS: `schedule.js`)

| Widget | Element ID | Type |
|---|---|---|
| Scheduler | `#scheduler` | kendoScheduler |
| Tasks List | `#tasks-list` | kendoListView |
| Task Search | `#tasks-search` | input |
| Add Task | `#add-task-dialog` | kendoDialog |
| View Task | `#view-task-dialog` | kendoDialog |
| Appointment Detail | `#appointment-dialog` | kendoDialog (expand/collapse) |

**Triggers:**
- `#btn-add-task` → opens `#add-task-dialog`
- `.task-text` click → opens `#view-task-dialog`
- Scheduler event double-click → opens `#appointment-dialog`
- `.appt-expand-btn` → toggles patient info section in appointment dialog

### Patients Page (`/patients`, JS: `patients.js`)

| Widget | Element ID | Type |
|---|---|---|
| Patients Grid | `#patients-grid` | kendoGrid |
| AI Chat | `#list-ai-chat` | kendoChat |
| Change Status | `#change-status-dialog` | kendoDialog |
| Patient Notes Editor | `#patient-notes-editor` | kendoEditor (in drilldown) |
| Patient Labs Grid | `#patient-labs-grid` | kendoGrid (in drilldown) |

**Triggers:**
- `.btn-view-patient` click → opens patient drilldown (`#patients-detail-view`)
- `.patient-name-cell` dblclick → opens preview panel (`#patient-preview-panel`)
- `#btn-ai-assistance` → toggles `#list-ai-dialog`
- `#btn-export-patients` → Excel export
- `#breadcrumb-back` → returns to grid

### Analytics Page (`/analytics`, JS: `analytics.js`)

| Widget | Element ID | Type |
|---|---|---|
| Patient Selector | `#patient-select` | kendoDropDownList |
| Vitals Chart | `#vitals-chart` | kendoChart (line) |
| Alerts Column | `#alerts-column-chart` | kendoChart (stacked column) |
| Alerts Donut | `#alerts-donut-chart` | kendoChart (donut) |
| Risk Gauge | `#risk-gauge` | kendoArcGauge |
| Export PDF | `#btn-export-analytics` | kendoButton |

### Global (all pages, JS: `site.js` + `profile.js`)

| Widget | Element ID | Type |
|---|---|---|
| Navigation | `#appbar-nav` | kendoSegmentedControl |
| Patient Search | `#appbar-search` | kendoAutoComplete |
| Profile Window | `#profile-window` | kendoWindow (modal) |
| Notifications | `#np-dropdown` | kendoWindow (non-modal) |
| Notification Badge | `#notif-badge` | kendoBadge |
| Search Toggle | `#btn-search-toggle` | button (visible < 1440px) |
| Hamburger Menu | `#hamburger-btn` | kendoDropDownButton (visible < 575px) |

---

## Responsive Layout

The app uses desktop-first CSS breakpoints in `wwwroot/css/custom.css`.

| Max-width | Key changes |
|---|---|
| 1439px | Nav shows icons only (`font-size: 0` on text). Search autocomplete hidden; `#btn-search-toggle` visible. Clicking it adds `.search-open` to `#appbar`, showing autocomplete as full-width overlay. Page body collapses to single column. Schedule stacks vertically. |
| 900px | Compact logo (no text). Chat dialogs go fullscreen. Analytics rows single-column. |
| 575px | `#hamburger-btn` replaces segmented nav. `.appbar-nav` hidden. Minimal padding. |

**Test configuration:** Existing tests run at 1920×1080 (`BROWSER_WIDTH`/`BROWSER_HEIGHT` env vars in `vitest.config.ts`). Responsive tests in `responsive.test.ts` use `browser.resizeWindow(1200, 900)`.

---

## API Endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/patients` | All patient records |
| POST | `/api/patients/{id}/notes` | Replace patient notes |
| POST | `/api/patients/{id}/add-note` | Prepend a note entry |
| POST | `/api/patients/{id}/status` | Update patient status |
| GET | `/api/alerts` | Daily alerts |
| GET | `/api/today-appointments` | Home grid data |
| GET | `/api/appointments` | Scheduler CRUD read |
| POST | `/api/appointments/update` | Scheduler update |
| POST | `/api/appointments/destroy` | Scheduler delete |
| GET | `/api/analytics` | All patient analytics |
| GET | `/api/analytics/{patientId}` | Single patient analytics |
| GET | `/api/event-types` | Scheduler event type options |
| GET | `/api/rooms` | Room options |
| GET | `/api/tasks` | Daily tasks |
| POST | `/api/tasks/create` | Create task |
| POST | `/api/tasks/update` | Update task |
| GET | `/api/profile` | Doctor profile |
| POST | `/api/profile/update` | Update profile |
| POST | `/api/profile/avatar` | Update avatar |

---

## Building New Features

### Adding a New Dialog

1. **View**: Add HTML placeholder in the appropriate `.cshtml` file:
   ```html
   <div id="dialog-my-feature"></div>
   ```

2. **JavaScript**: Initialize in the page's JS file:
   ```javascript
   $("#dialog-my-feature").kendoDialog({
       title: "My Feature",
       width: 480,
       modal: true,
       visible: false,
       actions: [
           { text: "Cancel" },
           { text: "Save", primary: true, action: function() { /* save logic */ } }
       ],
       content: '<div class="dialog-field">...</div>'
   });
   ```

3. **Trigger**: Add a button or link and wire the click handler:
   ```javascript
   $("#btn-my-feature").kendoButton({ icon: "plus" });
   $(document).on("click", "#btn-my-feature", function() {
       $("#dialog-my-feature").data("kendoDialog").open();
   });
   ```

4. **API** (if needed): Add action to `ApiController.cs`:
   ```csharp
   [HttpPost("my-feature")]
   public IActionResult MyFeature([FromBody] MyModel model) { ... }
   ```

5. **CSS**: Add styles in `wwwroot/css/custom.css` following existing patterns.

### Adding a Grid Column

1. Add field to model in `Models/`
2. Add seed data in `HealthcareDataRepository.cs`
3. Add column definition in the kendoGrid config in the page's JS file
4. Update E2E tests for the grid (column count, column name assertions)

### Cross-Page Navigation Pattern

The app uses `sessionStorage` to pass state between pages:
```javascript
sessionStorage.setItem("openPatientId", patientId);
window.location.href = "/patients";
```
On the target page, `sessionStorage.getItem("openPatientId")` is read on grid load to auto-open drilldown.

---

## E2E Testing Conventions

### Test File Structure

```typescript
import { Browser, Grid, Pager, DropDownList, Key } from '@progress/kendo-e2e';
import BASE_URL from './config';

describe('Page Name — Feature', () => {
    let browser: Browser;
    let grid: Grid; // when page has a kendoGrid

    beforeAll(async () => {
        browser = new Browser();
        grid = new Grid(browser, '#my-grid');
        await browser.navigateTo(`${BASE_URL}/page`);
    });

    afterAll(async () => {
        await browser.close();
    });

    beforeEach(async () => {
        expect(await browser.getErrorLogs()).toEqual([]);
    });

    afterEach(async () => {
        expect(await browser.getErrorLogs()).toEqual([]);
    });

    it('should do something', async () => {
        await browser.expect('#element').toBeVisible();
    });
});
```

### Dialog Close Pattern

All dialogs use this close selector:
```typescript
await browser.click('#dialog-id ~ .k-dialog-actions .k-button');
```

### Grid / Pager / DropDownList Abstractions

Use higher-level classes instead of raw selectors for grid assertions:

```typescript
// Grid row counts
const grid = new Grid(browser, '#my-grid');
expect(await grid.masterRowsCount()).toBe(10);
await grid.waitForRows(20);   // waits until exactly 20 rows
await grid.isEmpty();          // checks .k-grid-norecords (not pager "no items")

// Pager
const pager = await grid.pager();
expect(await pager.infoText()).toBe('1 - 10 of 30 items');
expect(await pager.selectedPage()).toBe('1');
await browser.click(await pager.pageButton(2)); // 1-indexed
await browser.click(await pager.firstPage());
const pages = await pager.pageButtons();
expect(pages.length).toBe(3);

// Page size DropDownList (via pager)
const ddl = await pager.dropDownList();
expect(await ddl.getText()).toBe('10'); // getText() returns displayed value
// ddl.getValue() reads hidden input attribute → returns null for Kendo DDL, avoid it

// Visibility checks: use CSS string, NOT await pager.root() / await ddl.root()
// root() returns WebElement, browser.expect() requires a string selector
await browser.expect('#my-grid .k-pager').toBeVisible();
await browser.expect('#my-grid .k-pager-sizes .k-dropdownlist').toBeVisible();
await browser.expect('#my-grid .k-pager-sizes .k-input-value-text').toHaveText('10');

// Pager DDL selection
await ddl.selectItemByText('20');   // triggers proper select + waitToCollapse

// Standalone page DDL (e.g., analytics #patient-select)
// Use expand() + setFilter() + waitForItems(count === 1) + getItemByIndex(0).click() for filtered selection
// Use selectItemByIndex(n) for positional selection (0-based, skips <div> optionLabel)
const analyticsDdl = new DropDownList(browser, '.analytics-header-controls .k-dropdownlist');
await analyticsDdl.selectItemByIndex(0);          // select first item
await analyticsDdl.expand();
await analyticsDdl.waitToExpand();
await analyticsDdl.setFilter('Olivia Davis');
await browser.wait(async () => (await analyticsDdl.getItems({ waitForItems: false })).length === 1);
await (await analyticsDdl.getItemByIndex(0)).click();
await analyticsDdl.waitToCollapse();
```

### Known Gotchas

| Issue | Solution |
|---|---|
| Kendo DropDownList selection | Use `executeScript` with widget API: `var ddl = $('#id').data('kendoDropDownList'); ddl.select(1); ddl.trigger('change');` |
| Window close button overlap | Use `executeScript`: `document.querySelector('.k-window-titlebar-action[aria-label="Close"]').click()` |
| Partial CSS class matching | Use `toHaveClass('k-selected', { exactMatch: false })` |
| Element below viewport | Call `browser.scrollIntoView('.selector')` before assertion |
| Uppercase CSS text | Assert with `toBeVisible()` instead of `toContainText()` when CSS `text-transform: uppercase` is applied |
| jQuery event delegation | `widget.tbody.on("dblclick", ...)` does not respond to Selenium `doubleClick()` — test via alternative button instead |
| Lab test item selection | Class is `selected` not `checked`: `toHaveClass('selected', { exactMatch: false })` |
| `executeScript` jQuery access | Use `kendo.jQuery(...)` not `$()` — `$` may not be globally available in script context |
| `root()` on widget abstractions | `pager.root()` / `ddl.root()` return `WebElement`, not a CSS string — never pass to `browser.expect()` |
| `ddl.getValue()` returns null | Reads hidden `<select>` element's `value` attribute (not set by Kendo) — use `ddl.getText()` or `browser.expect('.k-input-value-text')` |
| `browser.expect().toHaveCount()` vs `findAll()` | `toHaveCount()` auto-retries (async-safe); `findAll()` is a one-shot snapshot — prefer `toHaveCount()` for assertions that may need to wait |
| DDL item count | Use `dataSource.total()` via `executeScript` for reliable item counts; DOM option count may lag after re-render |
| DDL scope must be `.k-dropdownlist` wrapper | `new DropDownList(browser, selector)` scope must point to the `.k-dropdownlist` wrapper element, NOT the hidden `<input>` or `<select>` id (e.g., use `'.analytics-header-controls .k-dropdownlist'` not `'#patient-select'`) |
| DDL inside dialogs with focus timers | Avoid `selectItemByIndex`/`selectItemByText` for DDLs inside dialogs that steal focus via `setTimeout(...focus(), 100)` — use `executeScript` Kendo API instead (`ddl.select(n); ddl.trigger('change')`) |
| DDL `setFilter` + click filtered item | After `setFilter(text)`, wait for `items.length === 1` using `getItems({waitForItems: false})` before clicking — the default `getItems()` returns immediately (items already exist before filter applies) |
| `selectItemByText` requires exact match | Uses XPath `li[.="text"]` — full visible text including templates (e.g., `'Olivia Davis (P-1003)'` not just `'Olivia Davis'`) |
| `browser.type` closes DDL popup | `type()` defaults to `clear: true` which calls `element.clear()` — this triggers a Kendo event that closes the popup. Use `browser.type(selector, text, { clear: false })` for DDL filter inputs. Click the filter input first to focus it. |

### DOM Exploration with CLI

Before writing tests for new features, explore the live DOM:
```bash
npx kendo-e2e open http://localhost:5263
npx kendo-e2e snapshot --root "#my-widget" --filename my-widget
npx kendo-e2e find ".my-selector" --all --filename my-elements
npx kendo-e2e close
```

### Running Tests

```bash
cd tests
npx vitest run --reporter=verbose           # Full suite
npx vitest run src/home.test.ts             # Single file
```

Tests run in parallel (`fileParallelism: true`, `maxWorkers: 4`). Default browser size is 1920×1080 (set via `env` in `vitest.config.ts`). Server must be running on port 5263.
