# Settings

**User Management** (full settings access): add and edit accounts — name, email, role, own workshop, position, department, active, password reset.
A role fills the account's menus (§18 presets, `lib/domain/access.ts`); each module can then be set to No access / View / Enter & edit / Full on the account itself.
A deactivated account or a new password ends the account's open sessions. An admin cannot deactivate themselves or take away their own full Settings access.
Sign up creates a Dashboard-only account until an admin gives it its menus.
**General Setting:** company name, email and logo (≤ 1 MB, shown in the sidebar); the raw material allowance %, default density and machine hours a day.
**Change History:** every change — who, when, what, with the record before and after; filtered by period and record type. Sign-ins are logged too.
