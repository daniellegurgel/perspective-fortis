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

import {
    CellMetadata,
    CellMetadataRowHeader,
} from "regular-table/dist/esm/types.js";
import type { DatagridModel } from "../../types.js";
import { RegularTableElement } from "regular-table";
import { render_row_controls } from "./row_controls.js"; // [perspective-fortis]

/**
 * Classify a `<th>` row-header cell as a tree label, leaf or indent spacer by
 * its position in the row's header path.
 */
export function cell_style_row_header(
    model: DatagridModel,
    regularTable: RegularTableElement,
    td: HTMLElement,
    metadata: CellMetadataRowHeader,
): void {
    const x = metadata.row_header_x ?? 0;
    const is_flat = model._config.group_rollup_mode === "flat";
    const label_x = is_flat ? x : last_defined_index(metadata.row_header);
    const is_label = metadata.value !== undefined && x === label_x;
    const is_spacer = !is_flat && x < label_x;
    // [perspective-fortis] With `group_by_hide_null`, a row that ends before
    // the last level (e.g. an account with no sub-accounts) is a leaf too:
    // no +/- when there is nothing to open.
    const has_children =
        model._has_children?.[(metadata.y ?? 0) - (metadata.y0 ?? 0)];
    const is_leaf =
        x >= model._config.group_by.length || has_children === false;
    const next = regularTable.getMeta({
        dx: 0,
        dy: (metadata.y ?? 0) - (metadata.y0 ?? 0) + 1,
    } as CellMetadata);

    const is_collapse =
        next &&
        next.row_header &&
        typeof next.row_header[x + 1] !== "undefined";

    td.classList.toggle("psp-tree-spacer", is_spacer);
    td.classList.toggle("psp-tree-label", is_label && !is_leaf);
    td.classList.toggle(
        "psp-tree-label-expand",
        is_label && !is_leaf && !is_collapse,
    );

    td.classList.toggle(
        "psp-tree-label-collapse",
        is_label && !is_leaf && is_collapse,
    );
    td.classList.toggle("psp-tree-leaf", is_label && is_leaf);

    // [perspective-fortis] Tree guide lines, from the row's "last child"
    // flags (`_tree_last`, depth 1 first; the label sits at x = depth). In the
    // column of its parent a row draws │ over the whole row; in each column
    // further left, │ while that ancestor's list goes on below, else nothing.
    // No ─ into the label (2026-10-30; until then the parent's column drew
    // ├ or └ and a ─ up to the row's box or name). A connected label — the
    // root's too — drops a line from its open box.
    const last_flags = model._tree_last?.[
        (metadata.y ?? 0) - (metadata.y0 ?? 0)
    ];
    const connected = !is_flat && Array.isArray(last_flags);
    const connect = connected && label_x > 0;
    const in_parent_column = x === label_x - 1;
    const is_pipe =
        connect && is_spacer && (in_parent_column || !last_flags[x]);
    const is_gap =
        connect && is_spacer && !in_parent_column && !!last_flags[x];
    td.classList.toggle("psp-tree-pipe", is_pipe);
    td.classList.toggle("psp-tree-gap", is_gap);
    td.classList.toggle("psp-tree-connected", connected && is_label);

    // [perspective-fortis] Selection / action controls (opt-in per grid).
    render_row_controls(model, td, metadata, is_label && !is_flat);
}

function last_defined_index(row_header: unknown[] | undefined): number {
    if (!row_header) {
        return -1;
    }

    for (let i = row_header.length - 1; i >= 0; i--) {
        if (row_header[i] !== undefined) {
            return i;
        }
    }

    return -1;
}
