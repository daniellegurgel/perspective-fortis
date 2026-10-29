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

// [perspective-fortis] Neurotrading (Danielle Gurgel), 2026-10-28.
//
// Row controls on tree rows: a round selection control and action buttons,
// drawn by the Datagrid itself inside the row-header label cell, right after
// the expand/collapse box, so they share its geometry (see
// `regular_table.css`). They are opt-in per grid, set by the host with
// `setRowControls()` (see `RowControls`), and never shown on the grand-total
// row. The Datagrid only draws them and reports clicks; the host owns the
// selection and sends it back in `selected_rows`.

import type { CellMetadataRowHeader } from "regular-table/dist/esm/types.js";
import type {
    DatagridModel,
    DatagridPluginElement,
    RegularTable,
    RowAction,
    RowControls,
} from "../../types.js";

const CONTROLS_CLASS = "psp-row-controls";
const SELECT_CLASS = "psp-row-select";
const ACTION_CLASS = "psp-row-action";

function is_row_action(raw: unknown): raw is RowAction {
    const action = raw as Partial<RowAction> | null;
    return (
        typeof action?.id === "string" &&
        typeof action.label === "string" &&
        typeof action.icon === "string"
    );
}

/** Record `controls` on the plugin element and its model (no redraw). */
export function apply_row_controls(
    this: DatagridPluginElement,
    controls: RowControls,
): void {
    this._row_selection = controls.selection === true;
    this._selected_rows = new Set(
        (controls.selected_rows ?? [])
            .filter((path): path is unknown[] => Array.isArray(path))
            .map((path) => JSON.stringify(path)),
    );

    this._row_actions = (controls.actions ?? []).filter(is_row_action);
    if (this.model) {
        this.model._row_selection = this._row_selection;
        this.model._selected_rows = this._selected_rows;
        this.model._row_actions = this._row_actions;
    }
}

/** Draw (or remove) the row controls of the label cell `th`. */
export function render_row_controls(
    model: DatagridModel,
    th: HTMLElement,
    metadata: CellMetadataRowHeader,
    is_label: boolean,
): void {
    const row_path = model._ids?.[(metadata.y ?? 0) - (metadata.y0 ?? 0)];
    const wanted =
        is_label &&
        Array.isArray(row_path) &&
        row_path.length > 0 &&
        (model._row_selection || model._row_actions.length > 0);

    let controls = th.querySelector<HTMLElement>(`:scope > .${CONTROLS_CLASS}`);
    if (!wanted) {
        controls?.remove();
        return;
    }

    if (!controls) {
        controls = document.createElement("span");
        controls.className = CONTROLS_CLASS;
        th.prepend(controls);
    }

    const key = JSON.stringify(row_path);
    const name = String(row_path[row_path.length - 1] ?? "");
    controls.dataset.rowPath = key;

    let select = controls.querySelector<HTMLButtonElement>(`.${SELECT_CLASS}`);
    if (model._row_selection) {
        if (!select) {
            select = document.createElement("button");
            select.type = "button";
            select.className = SELECT_CLASS;
            select.setAttribute("role", "checkbox");
            controls.prepend(select);
        }

        const checked = model._selected_rows.has(key);
        select.setAttribute("aria-checked", String(checked));
        select.setAttribute("aria-label", name);
    } else {
        select?.remove();
    }

    // Rebuild the action buttons only when the configured actions change.
    const signature = JSON.stringify(model._row_actions);
    if (controls.dataset.actions !== signature) {
        controls.dataset.actions = signature;
        for (const old of controls.querySelectorAll(`.${ACTION_CLASS}`)) {
            old.remove();
        }

        for (const action of model._row_actions) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = ACTION_CLASS;
            button.dataset.action = action.id;
            button.title = action.label;
            button.setAttribute("aria-label", action.label);
            button.innerHTML = action.icon;
            controls.append(button);
        }
    }
}

/**
 * If `event` hit a row control, dispatch the matching event and return `true`
 * (the caller then stops the event, so the cell does not also expand/collapse
 * or report a `perspective-click`).
 */
export function handle_row_control_click(
    regularTable: RegularTable,
    event: Event,
): boolean {
    const control = (event.target as Element | null)?.closest?.(
        `.${SELECT_CLASS}, .${ACTION_CLASS}`,
    ) as HTMLElement | null;

    if (!control || !regularTable.contains(control)) {
        return false;
    }

    const row_path = JSON.parse(
        control.closest<HTMLElement>(`.${CONTROLS_CLASS}`)?.dataset.rowPath ??
            "[]",
    ) as unknown[];

    const detail = control.classList.contains(SELECT_CLASS)
        ? {
              row_path,
              selected: control.getAttribute("aria-checked") !== "true",
          }
        : { action: control.dataset.action, row_path };

    regularTable.dispatchEvent(
        new CustomEvent(
            control.classList.contains(SELECT_CLASS)
                ? "perspective-row-select"
                : "perspective-row-action",
            { bubbles: true, composed: true, detail },
        ),
    );

    return true;
}

/** Whether `event` started on a row control (so the cell must not react). */
export function is_row_control_event(event: Event): boolean {
    return !!(event.target as Element | null)?.closest?.(`.${CONTROLS_CLASS}`);
}
