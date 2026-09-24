import { Browser } from '@progress/kendo-e2e';
import BASE_URL from './config';
import {
    isCompactSchedulerToolbar,
    navigateSchedulerDate,
    openSchedulerViewsMenu,
    returnSchedulerToToday,
    schedulerView,
    selectSchedulerView,
} from './scheduler-toolbar';

describe('Schedule Page', () => {
    let browser: Browser;

    beforeAll(async () => {
        browser = new Browser();
        await browser.navigateTo(`${BASE_URL}Schedule`);
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

    describe('Navigation', () => {
        it('should have Schedule tab active', async () => {
            await browser.expect('.k-segmented-control-button.k-selected').toContainText('Schedule');
        });
    });

    describe('Scheduler Component', () => {
        it('should display the Kendo Scheduler', async () => {
            await browser.expect('#scheduler[data-role="scheduler"]').toBeVisible();
        });

        it('should provide Today or calendar date navigation for the toolbar layout', async () => {
            await browser.expect('.k-scheduler-toolbar').toBeVisible();
            if (await isCompactSchedulerToolbar(browser)) {
                await navigateSchedulerDate(browser, 'next');
                await returnSchedulerToToday(browser);
            } else {
                await browser.expect('.k-scheduler-toolbar [aria-label="Today"]').toBeVisible();
                await browser.expect('.k-scheduler-toolbar [aria-label="Today"] .k-button-text').toHaveText('Today');
            }
        });

        it('should provide Previous/Next or calendar navigation for the toolbar layout', async () => {
            if (await isCompactSchedulerToolbar(browser)) {
                await navigateSchedulerDate(browser, 'next');
                await navigateSchedulerDate(browser, 'previous');
                await returnSchedulerToToday(browser);
            } else {
                await browser.expect('.k-scheduler-toolbar [aria-label="Previous"]').toBeVisible();
                await browser.expect('.k-scheduler-toolbar [aria-label="Next"]').toBeVisible();
            }
        });

        it('should display the current date', async () => {
            await browser.expect('.k-nav-current').toBeVisible();
        });

        it('should show Day/Week/Month/Agenda through the visible view switcher', async () => {
            if (await isCompactSchedulerToolbar(browser)) {
                const menu = await openSchedulerViewsMenu(browser);
                await browser.click(`${menu} [role="menuitem"]:first-child`);
                await browser.expect(`${menu} [role="menuitem"]`).not.toBeVisible();
                await browser.expect('.k-toolbar-views-dropdown .k-menu-button').toHaveAttribute('aria-expanded', 'false');
                expect(await schedulerView(browser)).toBe('day');
            } else {
                await browser.expect('.k-scheduler-views.k-segmented-control').toBeVisible();
                for (const view of ['day', 'week', 'month', 'agenda']) {
                    await browser.expect(`.k-scheduler-views .k-segmented-control-button[data-value="${view}"]`).toBeVisible();
                }
                await browser.expect('.k-scheduler-views .k-segmented-control-button').toHaveCount(4);
            }
        });

        it('should have Day view selected by default', async () => {
            if (await isCompactSchedulerToolbar(browser)) {
                await browser.expect('.k-toolbar-views-dropdown .k-menu-button .k-button-text').toHaveText('Day');
            } else {
                await browser.expect(".k-scheduler-views .k-segmented-control-button[data-value='day']").toBeVisible();
                await browser.expect(".k-scheduler-views .k-segmented-control-button[data-value='day']").toHaveAttribute('aria-pressed', 'true');
            }
            expect(await schedulerView(browser)).toBe('day');
        });

        it('should switch to Week view when clicked', async () => {
            await selectSchedulerView(browser, 'week');
        });

        it('should switch back to Day view', async () => {
            await selectSchedulerView(browser, 'day');
        });
    });

    describe('Scheduler compact toolbar at 600px', () => {
        let compactBrowser: Browser;

        beforeAll(async () => {
            compactBrowser = new Browser();
            await compactBrowser.resizeWindow(600, 900);
            await compactBrowser.navigateTo(`${BASE_URL}Schedule`);
        });

        afterAll(async () => {
            await compactBrowser.close();
        });

        it('should display the compact view MenuButton at the narrow viewport', async () => {
            expect(await compactBrowser.executeScript('return window.innerWidth;')).toBe(600);
            expect(await isCompactSchedulerToolbar(compactBrowser)).toBe(true);
            const menu = await openSchedulerViewsMenu(compactBrowser);
            await compactBrowser.click(`${menu} [role="menuitem"]:first-child`);
            await compactBrowser.expect(`${menu} [role="menuitem"]`).not.toBeVisible();
            await compactBrowser.expect('.k-toolbar-views-dropdown .k-menu-button').toHaveAttribute('aria-expanded', 'false');
            expect(await schedulerView(compactBrowser)).toBe('day');
        });

        it('should switch to Week and back through the compact MenuButton', async () => {
            await selectSchedulerView(compactBrowser, 'week');
            await selectSchedulerView(compactBrowser, 'day');
        });

        it('should navigate to another date and back through the compact calendar', async () => {
            await navigateSchedulerDate(compactBrowser, 'next');
            await returnSchedulerToToday(compactBrowser);
        });
    });

    describe('Daily Tasks Card', () => {
        it('should display the tasks card', async () => {
            await browser.expect('.tasks-card').toBeVisible();
        });

        it('should display the Daily Tasks title', async () => {
            await browser.expect('.tasks-card-title').toHaveText('Daily Tasks');
        });

        it('should display the search input for tasks', async () => {
            await browser.expect('#tasks-search').toBeVisible();
        });

        it('should display the add task button', async () => {
            await browser.expect('#btn-add-task').toBeVisible();
        });

        it('should display the tasks ListView', async () => {
            await browser.expect('#tasks-list[data-role="listview"]').toBeVisible();
        });

        it('should display task items with checkboxes', async () => {
            const tasks = await browser.findAll('.task-item');
            expect(tasks.length).toBe(21);
        });

        it('should display priority badges on tasks', async () => {
            await browser.expect('.task-item [data-role="badge"]').toBeVisible();
        });

        it('should show task text content', async () => {
            await browser.expect('.task-text').toBeVisible();
        });

        it('should toggle task completion when checkbox is clicked', async () => {
            await browser.click('.task-item:not(.task-done) .k-checkbox-wrap');
            await browser.expect('.task-item.task-done').toBeVisible();
        });

        it('should show strikethrough text on completed task', async () => {
            const decoration = await browser.executeScript(
                "return window.getComputedStyle(document.querySelector('.task-done .task-text')).textDecorationLine"
            );
            expect(decoration).toBe('line-through');
        });

        it('should uncheck a completed task when checkbox is clicked again', async () => {
            await browser.click('.task-item.task-done .k-checkbox-wrap');
            const uncheckedItems = await browser.findAll('.task-item:not(.task-done)');
            expect(uncheckedItems.length).toBeGreaterThan(0);
        });

        it('should show normal text on unchecked task', async () => {
            const decoration = await browser.executeScript(
                "return window.getComputedStyle(document.querySelector('.task-item:not(.task-done) .task-text')).textDecorationLine"
            );
            expect(decoration).toBe('none');
        });

        it('should display task search input', async () => {
            await browser.expect('#tasks-search').toBeVisible();
        });
    });

    describe('Daily Tasks Scroll', () => {
        it('should have more tasks than visible in the list', async () => {
            await browser.navigateTo(`${BASE_URL}Schedule`);
            const tasks = await browser.findAll('.k-listview-content .task-item');
            expect(tasks.length).toBe(21);
        });

        it('should reveal the last task after scrolling into view', async () => {
            await browser.scrollIntoView('.k-listview-content .task-item:last-child');
            await browser.expect('.k-listview-content .task-item:last-child').toBeVisible();
        });
    });
});
