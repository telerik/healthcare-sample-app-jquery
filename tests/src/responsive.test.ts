import { Browser, Key } from '@progress/kendo-e2e';
import BASE_URL from './config';

describe('Responsive Layout (< 1440px)', () => {
    let browser: Browser;

    beforeAll(async () => {
        browser = new Browser();
        await browser.resizeWindow(1200, 900);
        await browser.navigateTo(BASE_URL);
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

    describe('AppBar — Responsive Navigation', () => {
        it('should display the app bar', async () => {
            await browser.expect('#appbar').toBeVisible();
        });

        it('should display the full logo', async () => {
            await browser.expect('.appbar-logo-img.logo-full').toBeVisible();
        });

        it('should display navigation with four icon-only buttons', async () => {
            await browser.expect('[data-role="segmentedcontrol"]').toBeVisible();
            await browser.expect('.k-segmented-control-button').toHaveCount(4);
        });

        it('should have navigation buttons with icons visible', async () => {
            await browser.expect('.k-segmented-control-button .k-svg-icon').toHaveCount(4);
        });

        it('should hide navigation button text via CSS', async () => {
            const fontSize = await browser.executeScript(
                "return getComputedStyle(document.querySelector('.k-segmented-control-button .k-segmented-control-button-text')).fontSize;"
            );
            expect(fontSize).toBe('0px');
        });

        it('should have Dashboard selected by default', async () => {
            await browser.expect('.k-segmented-control-button:nth-child(2)').toHaveAttribute('aria-pressed', 'true');
        });

        it('should display the notification badge', async () => {
            await browser.expect('#notif-btn .k-badge').toBeVisible();
        });

        it('should display the profile avatar', async () => {
            await browser.expect('#profile-trigger').toBeVisible();
        });

        it('should hide the hamburger menu', async () => {
            await browser.expect('#hamburger-btn').not.toBeVisible();
        });
    });

    describe('AppBar — Search Icon Toggle', () => {
        it('should hide the inline search autocomplete', async () => {
            await browser.navigateTo(BASE_URL);
            await browser.expect('.appbar-right .k-autocomplete').not.toBeVisible();
        });

        it('should display the search icon button', async () => {
            await browser.expect('#btn-search-toggle').toBeVisible();
        });

        it('should open full-width search overlay on search icon click', async () => {
            await browser.click('#btn-search-toggle');
            await browser.expect('#appbar.search-open').toBeVisible();
            await browser.expect('.appbar-right .k-autocomplete').toBeVisible();
        });

        it('should show the search input with placeholder text', async () => {
            await browser.expect('#appbar-search').toHaveAttribute('placeholder', 'Search patients by name, ID or phone…');
        });

        it('should focus the search input when overlay opens', async () => {
            const activeId = await browser.executeScript("return document.activeElement.id;");
            expect(activeId).toBe('appbar-search');
        });

        it('should allow typing in the search overlay', async () => {
            await browser.type('#appbar-search', 'Emma');
            await browser.expect('#appbar-search').toHaveValue('Emma');
        });

        it('should show autocomplete suggestions in overlay', async () => {
            await browser.expect('.k-autocomplete-popup:not([hidden])').toBeVisible();
        });

        it('should close search overlay on click outside', async () => {
            await browser.click('.home-greeting');
            await browser.expect('#appbar.search-open').not.toBeVisible();
            await browser.expect('.appbar-right .k-autocomplete').not.toBeVisible();
        });
    });

    describe('AppBar — Search Functionality in Overlay', () => {
        beforeAll(async () => {
            await browser.navigateTo(BASE_URL);
        });

        it('should open search and type a query', async () => {
            await browser.click('#btn-search-toggle');
            await browser.expect('.appbar-right .k-autocomplete').toBeVisible();
            await browser.type('#appbar-search', 'Henry');
            await browser.expect('#appbar-search').toHaveValue('Henry');
        });

        it('should show matching patient suggestions', async () => {
            await browser.expect('.k-autocomplete-popup:not([hidden])').toBeVisible();
            await browser.expect('.search-result-name').toBeVisible();
        });

        it('should clear the search input', async () => {
            await browser.type('#appbar-search', '');
            await browser.expect('#appbar-search').toHaveValue('');
        });

        it('should show No data found for non-existing patient', async () => {
            await browser.type('#appbar-search', 'ZZZNOMATCH999');
            await browser.expect('.k-autocomplete-popup .k-no-data').toBeVisible();
            await browser.expect('.k-autocomplete-popup .k-no-data').toContainText('No data found');
        });

        it('should close overlay when clicking outside', async () => {
            await browser.type('#appbar-search', '');
            await browser.expect('.k-autocomplete-popup').not.toBeVisible();
            await browser.click('.home-greeting');
            await browser.expect('#appbar.search-open').not.toBeVisible();
        });
    });

    describe('Cross-Page Navigation — Icon-Only', () => {
        it('should navigate to Schedule page via icon button', async () => {
            await browser.navigateTo(BASE_URL);
            await browser.click('.k-segmented-control-button:nth-child(3)');
            await browser.expect('#scheduler[data-role="scheduler"]').toBeVisible();
        });

        it('should have Schedule button selected', async () => {
            await browser.expect('.k-segmented-control-button:nth-child(3)').toHaveAttribute('aria-pressed', 'true');
        });

        it('should navigate to Patients page via icon button', async () => {
            await browser.click('.k-segmented-control-button:nth-child(4)');
            await browser.expect('#patients-grid[data-role="grid"]').toBeVisible();
        });

        it('should have Patients button selected', async () => {
            await browser.expect('.k-segmented-control-button:nth-child(4)').toHaveAttribute('aria-pressed', 'true');
        });

        it('should navigate to Analytics page via icon button', async () => {
            await browser.click('.k-segmented-control-button:nth-child(5)');
            await browser.expect('#vitals-chart[data-role="chart"]').toBeVisible();
        });

        it('should have Analytics button selected', async () => {
            await browser.expect('.k-segmented-control-button:nth-child(5)').toHaveAttribute('aria-pressed', 'true');
        });

        it('should navigate back to Dashboard via icon button', async () => {
            await browser.click('.k-segmented-control-button:nth-child(2)');
            await browser.expect('.quick-actions-card').toBeVisible();
        });
    });

    describe('Home Page — Responsive Layout', () => {
        it('should display greeting', async () => {
            await browser.navigateTo(BASE_URL);
            await browser.expect('.home-greeting h1').toBeVisible();
        });

        it('should display quick actions card', async () => {
            await browser.expect('.quick-actions-card').toBeVisible();
        });

        it('should display the appointments grid', async () => {
            await browser.expect('#appointments-grid').toBeVisible();
        });

        it('should use single-column layout for page body', async () => {
            const columns = await browser.executeScript(
                "return getComputedStyle(document.querySelector('.page-body')).gridTemplateColumns;"
            );
            // At <1440px with .col-side, should collapse to 1fr
            expect(columns).not.toContain('480px');
        });
    });

    describe('Schedule Page — Responsive Layout', () => {
        it('should navigate to Schedule page', async () => {
            await browser.navigateTo(`${BASE_URL}Schedule`);
            await browser.expect('#scheduler[data-role="scheduler"]').toBeVisible();
        });

        it('should display the scheduler', async () => {
            await browser.expect('#scheduler').toBeVisible();
        });

        it('should display tasks list', async () => {
            await browser.expect('#tasks-list').toBeVisible();
        });

        it('should stack scheduler and tasks in column layout', async () => {
            const direction = await browser.executeScript(
                "return getComputedStyle(document.querySelector('.schedule-body')).flexDirection;"
            );
            expect(direction).toBe('column');
        });
    });

    describe('Patients Page — Responsive Layout', () => {
        it('should navigate to Patients page', async () => {
            await browser.navigateTo(`${BASE_URL}Patients`);
            await browser.expect('#patients-grid[data-role="grid"]').toBeVisible();
        });

        it('should display patients grid', async () => {
            await browser.expect('#patients-grid').toBeVisible();
        });

        it('should stack page header vertically', async () => {
            const direction = await browser.executeScript(
                "return getComputedStyle(document.querySelector('.patients-page-header')).flexDirection;"
            );
            expect(direction).toBe('column');
        });

        it('should display search icon button on Patients page', async () => {
            await browser.expect('#btn-search-toggle').toBeVisible();
        });
    });

    describe('Analytics Page — Responsive Layout', () => {
        it('should navigate to Analytics page', async () => {
            await browser.navigateTo(`${BASE_URL}Analytics`);
            await browser.expect('#vitals-chart[data-role="chart"]').toBeVisible();
        });

        it('should display vitals chart', async () => {
            await browser.expect('#vitals-chart').toBeVisible();
        });

        it('should display risk gauge', async () => {
            await browser.expect('#risk-gauge').toBeVisible();
        });

        it('should stack analytics header vertically', async () => {
            const direction = await browser.executeScript(
                "return getComputedStyle(document.querySelector('.analytics-page-header')).flexDirection;"
            );
            expect(direction).toBe('column');
        });
    });

    describe('Profile — Responsive', () => {
        it('should open profile window when avatar is clicked', async () => {
            await browser.navigateTo(BASE_URL);
            await browser.click('#profile-trigger');
            await browser.expect('#profile-window').toBeVisible();
        });

        it('should display Profile Management title', async () => {
            await browser.expect('.k-window-title').toHaveText('Profile Management');
        });

        it('should close profile window', async () => {
            await browser.executeScript("document.querySelector('.k-window-titlebar-action[aria-label=\"Close\"]').click()");
            await browser.expect('#profile-window').not.toBeVisible();
        });
    });

    describe('Notifications — Responsive', () => {
        it('should display the notification bell button', async () => {
            await browser.expect('#notif-btn').toBeVisible();
        });

        it('should open notifications dropdown on click', async () => {
            await browser.click('#notif-btn');
            await browser.expect('#np-dropdown').toBeVisible();
        });

        it('should display notification cards', async () => {
            const cards = await browser.findAll('.np-card');
            expect(cards.length).toBe(7);
        });

        it('should close notifications dropdown', async () => {
            await browser.click('#notif-btn');
            await browser.expect('#np-dropdown').not.toBeVisible();
        });
    });
});
