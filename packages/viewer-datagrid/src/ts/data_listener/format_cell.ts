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

import { FormatterCache, Formatter } from "./formatter_cache.js";
import type {
    ColumnConfig,
    DatagridModel,
    DatagridPluginElement,
    ResolvedColumnsConfig,
    ResolvedColumnStyle,
    ResolvedRowFormat,
    RowFormat,
    RowFormats,
} from "../types.js";
import type { ColumnType } from "@perspective-dev/client";

const FORMAT_CACHE = new FormatterCache();

function is_row_format(raw: unknown): raw is RowFormat {
    const entry = raw as Partial<RowFormat> | null;
    return Array.isArray(entry?.path) && entry.path.length > 0;
}

/**
 * [perspective-fortis] Record `formats` on the plugin element and its model
 * (no redraw) — see `RowFormats` / `setRowFormats()`.
 */
export function apply_row_formats(
    this: DatagridPluginElement,
    formats?: RowFormats,
): void {
    const map = new Map<string, ResolvedRowFormat>();
    for (const entry of (formats?.formats ?? []).filter(is_row_format)) {
        const percent = entry.percent === true;
        const decimals =
            typeof entry.decimals === "number" &&
            Number.isInteger(entry.decimals) &&
            entry.decimals >= 0
                ? entry.decimals
                : percent
                  ? 1
                  : 2;
        const prefix = typeof entry.prefix === "string" ? entry.prefix : "";
        const suffix =
            typeof entry.suffix === "string"
                ? entry.suffix
                : percent
                  ? "%"
                  : "";
        map.set(JSON.stringify(entry.path), { decimals, prefix, suffix });
    }

    this._row_formats = map;
    if (this.model) {
        this.model._row_formats = map;
    }
}

/**
 * [perspective-fortis] Format `val` with the row's declared format when
 * `setRowFormats()` is active. Rows without a declared format (such as group
 * rows whose children have different units) render empty (`""`).
 */
function format_row_cell(
    model: DatagridModel,
    row_path: unknown[],
    val: unknown,
): string | null {
    if (!Array.isArray(row_path) || row_path.length === 0) {
        return "";
    }

    const fmt = model._row_formats.get(JSON.stringify(row_path));
    if (!fmt) {
        return "";
    }

    if (val === null) {
        return null;
    }

    const num =
        typeof val === "number"
            ? val
            : typeof val === "string" && val.trim() !== ""
              ? Number(val)
              : NaN;
    if (!Number.isFinite(num)) {
        return "";
    }

    const value = fmt.decimals === 0 ? Math.round(num) : num;
    const formatted = value.toLocaleString("pt-BR", {
        minimumFractionDigits: fmt.decimals,
        maximumFractionDigits: fmt.decimals,
    });
    return `${fmt.prefix}${formatted}${fmt.suffix}`;
}

export function format_raw(
    type: ColumnType,
    value: Pick<ColumnConfig, "date_format" | "number_format">,
): Formatter | false | undefined {
    return FORMAT_CACHE.get(type, value);
}

/**
 * Format a single cell's text content as the content of a `<td>` or `<th>`.
 */
export function format_cell(
    this: DatagridModel,
    title: string,
    val: unknown,
    plugins: ResolvedColumnsConfig = {},
    use_table_schema = false,
    row_path?: unknown[],
): string | HTMLElement | null {
    const type: ColumnType = ((use_table_schema && this._table_schema[title]) ||
        this._schema[title] ||
        this._window_schema?.[title] ||
        "string") as ColumnType;
    const plugin: ResolvedColumnStyle = plugins[title] || {};
    const is_numeric = type === "integer" || type === "float";

    if (
        is_numeric &&
        !use_table_schema &&
        (plugin.fg_mode === "bar" || plugin.fg_mode === "label-bar")
    ) {
        return val === null ? null : "";
    } else if (
        is_numeric &&
        !use_table_schema &&
        row_path !== undefined &&
        this._row_formats &&
        this._row_formats.size > 0
    ) {
        return format_row_cell(this, row_path, val);
    }

    if (val === null) {
        return null;
    }

    if (plugin?.link === true && type === "string") {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", val as string);
        anchor.setAttribute("target", "_blank");
        anchor.textContent = val as string;
        return anchor;
    } else {
        // `String(val)`, not a cast: with no formatter (e.g. an unknown
        // column type falling back to `"string"`), a raw non-string value
        // must not leak into consumers that expect text - see the
        // `{ toString }` wrapper in `format_tree_header.ts`.
        const formatter = FORMAT_CACHE.get(type, plugin);
        return formatter ? formatter.format(val) : String(val);
    }
}
