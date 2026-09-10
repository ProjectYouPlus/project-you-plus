# Project You+ AI Operating Budget

The application uses one shared monthly AI operating budget across the Development Team and Growth Department.

Default monthly budget: $50.00.

Controls:
- Development Team can be turned on or off independently.
- Growth Department can be turned on or off independently.
- New AI work is blocked server-side when a department is off.
- New AI work is blocked when the shared monthly cap is reached.
- Estimated spend resets automatically at the start of each month.

The budget and department state are stored in Supabase using `ai_department_budget`, with estimated usage history in `ai_department_spend_ledger`.
