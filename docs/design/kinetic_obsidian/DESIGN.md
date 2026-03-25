# Design System Strategy: The Kinetic Ledger (Muted)

## 1. Overview & Creative North Star: "The Technical Archivist"
This design system is built for precision, high-velocity tracking, and editorial clarity. The Creative North Star is **The Technical Archivist**—a philosophy that treats data not as a spreadsheet, but as a living ledger of record. 

Unlike standard dashboards that rely on "boxed-in" modules, this system utilizes **Intentional Asymmetry** and **Tonal Depth** to create a sense of flow. We move away from the "template" look by using exaggerated typographic scales and eliminating structural lines. The result is an interface that feels like a premium, high-end technical document: authoritative, minimal, and kinetic.

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in `surface` (`#0e0e10`) and `secondary_container` (`#323c49`). The goal is to create "shadow-less" hierarchy through background shifts rather than borders.

*   **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. To define a new area, use a background shift (e.g., placing a `surface_container_high` card on a `surface` background).
*   **Surface Hierarchy & Nesting:** Treat the UI as layers of dark slate. 
    *   **Level 0 (Base):** `surface_dim` (`#0e0e10`)
    *   **Level 1 (Sections):** `surface_container_low` (`#131316`)
    *   **Level 2 (Active Cards):** `surface_container_highest` (`#25252b`)
*   **The Glass & Gradient Rule:** For primary actions, use a linear gradient from `primary` (`#cebdff`) to `primary_container` (`#5028ae`) at a 135-degree angle. Floating menus must use `surface_bright` at 80% opacity with a `20px` backdrop-blur to allow underlying data to bleed through subtly.

## 3. Typography: Editorial Authority
We pair the geometric technicality of **Space Grotesk** with the utilitarian clarity of **Inter**.

*   **Space Grotesk (Display/Headline/Labels):** Used for all data points, status indicators, and headers. It provides the "Kinetic" feel.
    *   *Display-LG (`3.5rem`):* Use for high-level PR metrics (e.g., total merged).
    *   *Label-MD (`0.75rem`):* Use for technical metadata (commit IDs, timestamps).
*   **Inter (Body/Title):** Used for PR descriptions and long-form commentary.
    *   *Body-MD (`0.875rem`):* The workhorse for readability.
*   **The Narrative Scale:** Use `headline-sm` for PR titles but drop the opacity to `on_surface_variant` (`#abaab1`) for closed PRs to create a visual "history" through type alone.

## 4. Elevation & Depth: Tonal Layering
Avoid shadows where possible. We communicate "upward" movement through color temperature.

*   **The Layering Principle:** A "raised" element is simply a lighter shade of charcoal. Use `surface_container_highest` (`#25252b`) to indicate an element is interactive or "on top."
*   **Ambient Shadows:** If a modal requires a shadow, use a `40px` blur with 8% opacity using the `primary_dim` color (`#c1acff`). This creates a purple "glow" rather than a dirty gray shadow, reinforcing the accent theme.
*   **The "Ghost Border" Fallback:** If a divider is mandatory for accessibility, use `outline_variant` (`#47474d`) at **15% opacity**. It should be felt, not seen.

## 5. Components: Style & Implementation

### Buttons
*   **Primary:** Background: `primary_container` (`#5028ae`). Text: `on_primary_container`. Radius: `md` (`0.375rem`). Use a subtle inner glow (top-down) for a "machined" look.
*   **Secondary:** Ghost style. No background. `outline` border at 20% opacity. Text: `primary`.
*   **Tertiary:** Text only. `label-md` in `on_surface_variant`.

### Chips (PR Status)
*   **Active/Open:** Background: `tertiary_container` (`#bc80f8`). Text: `on_tertiary_container`.
*   **Closed/Merged:** Background: `secondary_container` (`#323c49`). Text: `on_secondary_container`.
*   **Draft:** Background: `surface_container_highest`. Text: `outline`.

### Input Fields
*   **Default:** `surface_container_highest` background, no border. Bottom-only "indicator" line (2px) using `outline_variant`.
*   **Focused:** Indicator line transitions to `primary` (`#cebdff`).

### The PR Ledger (List/Card)
*   **Strict Rule:** No dividers. Use `spacing-6` (`1.3rem`) as a vertical gutter between PR entries.
*   **Hover State:** Transition the background from `surface` to `surface_container_low`. 
*   **Leading Element:** Use `label-sm` in `primary` for the PR number (e.g., #1042) to draw the eye immediately to the technical ID.

### Status Indicators (Muted Palette)
*   **Critical/Error:** Use `error_dim` (`#b95463`). Avoid bright reds; this is a "dried blood" or "faded brick" tone for a more professional feel.
*   **Warning/Pending:** Use a custom muted amber (mix `secondary` and `error`).

## 6. Do’s and Don’ts

**Do:**
*   Use `spacing-1` and `spacing-2` for tight technical data (the "Kinetic" look).
*   Use `display-sm` for numbers; the font's geometry is the hero.
*   Overlap elements (e.g., a floating purple action button slightly overlapping a dark gray container) to break the grid.

**Don't:**
*   **Never** use pure white (`#ffffff`). Use `on_background` (`#e6e4ec`) for the highest contrast.
*   **Never** use 100% opaque borders.
*   Avoid standard "Blue" for links. Use `tertiary_dim` (`#be83fa`) for all interactive text.
*   Avoid rounded corners larger than `lg` (`0.5rem`). This system should feel architectural and sharp, not bubbly.