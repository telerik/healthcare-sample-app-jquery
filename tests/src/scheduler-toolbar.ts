import { Browser, Key } from '@progress/kendo-e2e';
import { expect } from 'vitest';

type SchedulerView = 'day' | 'week' | 'month' | 'agenda';
type Direction = 'next' | 'previous';

const viewNames: Record<SchedulerView, string> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
    agenda: 'Agenda',
};

export async function isCompactSchedulerToolbar(browser: Browser): Promise<boolean> {
    await browser.expect('.k-scheduler-toolbar').toBeVisible();
    await browser.expect('.k-scheduler-views.k-segmented-control').toHaveCount(1);
    const segmented = await browser.find('.k-scheduler-views.k-segmented-control');
    const compact = !(await segmented.isDisplayed());
    await browser.expect(compact
        ? '.k-toolbar-views-dropdown .k-menu-button'
        : '.k-scheduler-views.k-segmented-control').toBeVisible();
    return compact;
}

export async function openSchedulerViewsMenu(browser: Browser): Promise<string> {
    const button = '.k-toolbar-views-dropdown .k-menu-button';
    await browser.expect(button).toBeVisible();
    if (await (await browser.find(button)).getAttribute('aria-expanded') !== 'true') {
        await browser.click(button);
    }
    const menuId = String(await browser.executeScript(
        "return document.querySelector('.k-toolbar-views-dropdown .k-menu-button').getAttribute('aria-controls');"
    ));
    const menu = `[id="${menuId}"]`;
    await browser.expect(`${menu} [role="menuitem"]`).toHaveCount(4);
    for (const [index, name] of Object.values(viewNames).entries()) {
        await browser.expect(`${menu} [role="menuitem"]:nth-child(${index + 1})`).toBeVisible();
        await browser.expect(`${menu} [role="menuitem"]:nth-child(${index + 1}) .k-menu-link-text`).toHaveText(name);
    }
    return menu;
}

export async function schedulerView(browser: Browser): Promise<string> {
    return String(await browser.executeScript(
        "return $('#scheduler').data('kendoScheduler').view().name;"
    ));
}

export async function selectSchedulerView(browser: Browser, view: SchedulerView): Promise<void> {
    if (await isCompactSchedulerToolbar(browser)) {
        const menu = await openSchedulerViewsMenu(browser);
        const index = Object.keys(viewNames).indexOf(view) + 1;
        await browser.click(`${menu} [role="menuitem"]:nth-child(${index})`);
        await browser.expect('.k-toolbar-views-dropdown .k-menu-button .k-button-text').toHaveText(viewNames[view]);
        await browser.expect(`${menu} [role="menuitem"]`).not.toBeVisible();
        await browser.expect('.k-toolbar-views-dropdown .k-menu-button').toHaveAttribute('aria-expanded', 'false');
    } else {
        const button = `.k-scheduler-views .k-segmented-control-button[data-value="${view}"]`;
        await browser.expect(button).toBeVisible();
        await browser.click(button);
        await browser.expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    expect(await schedulerView(browser)).toBe(view);
}

export async function schedulerDate(browser: Browser): Promise<number> {
    return Number(await browser.executeScript(
        "return $('#scheduler').data('kendoScheduler').date().getTime();"
    ));
}

async function openSchedulerCalendar(browser: Browser): Promise<void> {
    const open = await browser.executeScript(
        "return [...document.querySelectorAll('.k-scheduler-calendar')].some(calendar => calendar.getClientRects().length > 0);"
    );
    if (!open) {
        await browser.click('.k-nav-current');
    }
    await browser.expect('.k-scheduler-calendar').toBeVisible();
}

export async function navigateSchedulerDate(browser: Browser, direction: Direction): Promise<void> {
    const before = await schedulerDate(browser);
    const target = new Date(before);
    if (await isCompactSchedulerToolbar(browser)) {
        target.setDate(1);
        target.setMonth(target.getMonth() + (direction === 'next' ? 1 : -1));
        await openSchedulerCalendar(browser);
        await browser.click(`.k-scheduler-calendar .k-calendar-nav-${direction === 'previous' ? 'prev' : 'next'}`);
        await browser.click(
            `.k-scheduler-calendar .k-calendar-td:not(.k-other-month) .k-link[data-value="${target.getFullYear()}/${target.getMonth()}/1"]`
        );
        await browser.sendKey(Key.ESCAPE);
        await browser.expect('.k-scheduler-calendar').not.toBeVisible();
    } else {
        target.setDate(target.getDate() + (direction === 'next' ? 1 : -1));
        const button = `.k-scheduler-toolbar [aria-label="${direction === 'next' ? 'Next' : 'Previous'}"]`;
        await browser.expect(button).toBeVisible();
        await browser.click(button);
    }
    await browser.wait(async () => await schedulerDate(browser) === target.getTime(), {
        message: `Scheduler did not navigate ${direction} to ${target.toDateString()}`,
    });
    expect(await schedulerDate(browser)).toBe(target.getTime());
}

export async function returnSchedulerToToday(browser: Browser): Promise<void> {
    if (await isCompactSchedulerToolbar(browser)) {
        const selected = new Date(await schedulerDate(browser));
        const todayDate = new Date();
        const monthDifference = (todayDate.getFullYear() - selected.getFullYear()) * 12 +
            todayDate.getMonth() - selected.getMonth();
        if (Math.abs(monthDifference) > 1) {
            throw new Error('The compact calendar test moved more than one month from Today');
        }
        await openSchedulerCalendar(browser);
        if (monthDifference !== 0) {
            await browser.click(`.k-scheduler-calendar .k-calendar-nav-${monthDifference > 0 ? 'next' : 'prev'}`);
        }
        await browser.click(
            `.k-scheduler-calendar .k-calendar-td:not(.k-other-month) .k-link[data-value="${todayDate.getFullYear()}/${todayDate.getMonth()}/${todayDate.getDate()}"]`
        );
        await browser.sendKey(Key.ESCAPE);
        await browser.expect('.k-scheduler-calendar').not.toBeVisible();
    } else {
        await browser.expect('.k-scheduler-toolbar [aria-label="Today"]').toBeVisible();
        await browser.click('.k-scheduler-toolbar [aria-label="Today"]');
    }
    const today = await browser.executeScript("return kendo.toString(new Date(), 'yyyy-MM-dd');");
    await browser.wait(async () => await browser.executeScript(
        "return kendo.toString($('#scheduler').data('kendoScheduler').date(), 'yyyy-MM-dd');"
    ) === today, { message: 'Scheduler did not return to Today' });
    expect(await browser.executeScript(
        "return kendo.toString($('#scheduler').data('kendoScheduler').date(), 'yyyy-MM-dd');"
    )).toBe(today);
}
