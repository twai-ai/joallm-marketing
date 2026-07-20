# Role Display Name Update

## Change
Updated the role display name from "casual" to "Casual User" in the user interface.

## Files Modified

1. **`services/commercial-frontend/src/components/layout/Header.tsx`**:
   - Changed role display from `capitalize` class to explicit text
   - Now shows "Casual User" instead of "casual"

2. **`services/landing-page/src/components/layout/Header.tsx`**:
   - Same change as above for consistency across both frontend apps

## Before
```tsx
<div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
  {user?.role || 'casual'}
</div>
```
Result: Displayed as "casual" (lowercase)

## After
```tsx
<div className="text-xs text-gray-500 dark:text-gray-400">
  {user?.role === 'casual' ? 'Casual User' : user?.role || 'Casual User'}
</div>
```
Result: Displays as "Casual User" (proper formatting)

## Impact

- Users with role 'casual' will now see "Casual User" in the header dropdown
- The internal role value remains 'casual' for consistency with the database
- Only the display name has changed, not the actual role value

## Note

The database and backend still use 'casual' as the role value. This change only affects how the role is displayed in the UI. The internal role configuration in `EnhancedUserRoleContext` was already set to display "Casual User" (name property), this update ensures the header also shows the correct display name.


