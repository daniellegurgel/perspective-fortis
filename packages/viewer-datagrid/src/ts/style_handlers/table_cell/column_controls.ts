// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃ ██████ ██████ ██████       █      █      █      █      █ █▄  ▀███ █       ┃
// ┃ ▄▄▄▄▄█ █▄▄▄▄▄ ▄▄▄▄▄█  ▀▀▀▀▀█▀▀▀▀▀ █ ▀▀▀▀▀█ ████████▌▐███ ███▄  ▀█ █ ▀▀▀▀▀ ┃
// ┃ █▀▀▀▀▀ █▀▀▀▀▀ █▀██▀▀ ▄▄▄▄▄ █ ▄▄▄▄▄█ ▄▄▄▄▄█ ████████▌▐███ █████▄   █ ▄▄▄▄▄ ┃
// ┃ █      ██████ █  ▀█▄       █ ██████      █      ███▌▐███ ███████▄ █       ┃
// ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
// ┃ Copyright (c) 2017, the Perspective Authors.                              ┃
// ┃ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ┃
// ┃ This file is part of the Perspective library, distributed under the terms ┃
// ┃ of the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

// [perspective-fortis] Neurotrading (Danielle Gurgel), 2026-10-30.
//
// Column controls: action buttons in the header of chosen columns, drawn by
// the Datagrid itself right after the column name (e.g. the documents of the
// period a column shows). They are opt-in per grid, set by the host with
// `setColumnControls()` (see `ColumnControls`). The Datagrid draws them and
// their tooltip, and reports clicks with the button's box; what a click opens
// (a menu, a dialog) is the host's.

import type {
    ColumnAction,
    ColumnControls,
    DatagridModel,
    DatagridPluginElement,
    RegularTable,
} from "../../types.js";

const CONTROLS_CLASS = "psp-column-controls";
const ACTION_CLASS = "psp-column-action";

function is_column_action(raw: unknown): raw is ColumnAction {
    const action = raw as Partial<ColumnAction> | null;
    return (
        typeof action?.id === "string" &&
        typeof action.label === "string" &&
        typeof action.icon === "string" &&
        Array.isArray(action.columns) &&
        action.columns.every((column) => typeof column === "string")
    );
}

/** Record `controls` on the plugin element and its model (no redraw). */
export function apply_column_controls(
    this: DatagridPluginElement,
    controls: ColumnControls,
): void {
    this._column_actions = (controls.actions ?? []).filter(is_column_action);
    if (this.model) {
        this.model._column_actions = this._column_actions;
    }
}

/**
 * Draw (or remove) the controls of the header cell `th` of the column at
 * `column_path`; `is_name_cell` is false on corner and menu cells, which never
 * get any.
 */
export function render_column_controls(
    model: DatagridModel,
    th: HTMLElement,
    column_path: unknown[] | undefined,
    is_name_cell: boolean,
): void {
    // The column name sits after the `split_by` values, as for the settings.
    const name = column_path?.[model._config.split_by.length];
    const actions =
        is_name_cell && typeof name === "string"
            ? model._column_actions.filter((action) =>
                  action.columns.includes(name),
              )
            : [];

    let controls = th.querySelector<HTMLElement>(
        `:scope > .${CONTROLS_CLASS}`,
    );
    if (actions.length === 0) {
        controls?.remove();
        return;
    }

    if (!controls) {
        controls = document.createElement("span");
        controls.className = CONTROLS_CLASS;
        // Right after the name (the cell's first `span`), so whoever renames
        // the column through that `span` leaves the buttons alone.
        const name = th.querySelector(":scope > span");
        if (name) {
            name.after(controls);
        } else {
            th.append(controls);
        }
    }

    controls.dataset.column = String(name);
    controls.dataset.columnPath = JSON.stringify(column_path);

    // Rebuild the buttons only when this column's actions change.
    const signature = JSON.stringify(
        actions.map(({ id, label, icon }) => [id, label, icon]),
    );
    if (controls.dataset.actions !== signature) {
        controls.dataset.actions = signature;
        controls.replaceChildren(
            ...actions.map((action) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = ACTION_CLASS;
                button.dataset.action = action.id;
                // The tooltip is drawn by CSS from `data-tooltip`; no `title`,
                // or the browser's own would show too.
                button.dataset.tooltip = action.label;
                button.setAttribute("aria-label", action.label);
                button.innerHTML = action.icon;
                return button;
            }),
        );
    }
}

/**
 * If `event` hit a column control, dispatch `perspective-column-action` and
 * return `true` (the caller then stops the event, so the header does not also
 * sort or open the column settings).
 */
export function handle_column_control_click(
    regularTable: RegularTable,
    event: Event,
): boolean {
    const control = (event.target as Element | null)?.closest?.(
        `.${ACTION_CLASS}`,
    ) as HTMLElement | null;

    if (!control || !regularTable.contains(control)) {
        return false;
    }

    const controls = control.closest<HTMLElement>(`.${CONTROLS_CLASS}`);
    const column_path = JSON.parse(
        controls?.dataset.columnPath ?? "[]",
    ) as unknown[];

    const box = control.getBoundingClientRect();
    regularTable.dispatchEvent(
        new CustomEvent("perspective-column-action", {
            bubbles: true,
            composed: true,
            detail: {
                action: control.dataset.action,
                column: controls?.dataset.column,
                column_path,
                rect: {
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                },
            },
        }),
    );

    return true;
}

/** Whether `event` started on a column control (so the header must not react). */
export function is_column_control_event(event: Event): boolean {
    return !!(event.target as Element | null)?.closest?.(`.${CONTROLS_CLASS}`);
}
