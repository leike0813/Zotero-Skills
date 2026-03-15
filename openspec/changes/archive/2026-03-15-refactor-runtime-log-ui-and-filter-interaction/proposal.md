# Proposal: Refactor Runtime Log UI and Filter Interaction

## Problem Statement
The runtime log dashboard serves as the primary transparency layer for Zotero-Skills workflows. However, the legacy implementation suffered from several critical friction points:

1. **Usability Bottlenecks**: Filtering was restricted to single-string matches. In multi-backend (e.g., Skill-Runner + Generic HTTP) or complex workflow environments, users could not isolate specific cohorts of logs, leading to "log fatigue."
2. **"Black Box" Filters**: The filter state used raw internal IDs (UUIDs or technical short-names) instead of human-readable display names, making it difficult for users to verify active filters at a glance.
3. **State Loss (High-Severity UX Bug)**: The dashboard re-renders frequently to show live log streams. Due to an aggressive "destroy-and-rebuild" rendering strategy, any open dropdown menus were forcibly closed every time a new log entry arrived, making multi-selection practically impossible.
4. **Missing Feedback Loop**: Critical actions like `Copy Diagnostic Bundle` (which involves complex data aggregation) operated silently. Users received no confirmation of success or failure.

## Proposed Changes
1. **Multi-select Componentry**: 
    - Introduce a checkbox-driven dropdown system within `custom-select.js`.
    - Implement "Smart Labels" that map technical IDs to localized Display Names (Backends) and Labels (Workflows).
2. **Sticky Rendering Architecture**:
    - Refactor the `app.js` renderer to identify "Sticky" DOM zones (Filters) vs "Dynamic" DOM zones (Actions/Status).
    - Use incremental element replacement to maintain the lifecycle of open menus during data refreshes.
3. **Reactive Interaction Model**:
    - Implement an "Outside Click" closure system so filters apply naturally when the user finishes their selection and clicks back to the table.
4. **Visual Affirmation**:
    - Add a Toast notification system to confirm clipboard operations.

## Expected Impact
- **Traceability**: Enhanced through readable labels and flexible multi-cohort filtering.
- **Robustness**: Eliminated the re-render interference bug, allowing stable interaction with complex UI widgets.
- **Polish**: Professional-grade feedback via toasts and grouped functional zones.
