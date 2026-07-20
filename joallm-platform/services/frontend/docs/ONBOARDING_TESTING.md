# Testing the Onboarding Feature

## Quick Test

To see the onboarding feature in action:

### Step 1: Clear Onboarding Flag
Open browser console (F12) and run:
```javascript
localStorage.removeItem('joallm_onboarding_complete');
localStorage.removeItem('user_role');
```

### Step 2: Refresh Page
Refresh your browser (F5 or Cmd+R)

### Step 3: Onboarding Should Appear
You should now see the onboarding modal with:
- Welcome message
- Progress bar
- Step indicators
- Skip button
- Next/Complete button

### Step 4: Test Completion
- Click through the steps
- OR click "Skip Onboarding"
- Refresh page - onboarding should NOT appear again

## Expected Behavior

### For First-Time Users
1. Modal appears automatically
2. Shows role-appropriate steps
3. Progress bar shows completion percentage
4. User can skip or complete

### After Completion
1. Modal doesn't appear
2. `joallm_onboarding_complete` is set in localStorage
3. User goes straight to main interface

## Visual Verification

The onboarding modal should have:
- ✅ Gradient header (blue to purple)
- ✅ Progress bar at top
- ✅ Large icon for current step
- ✅ Step title and description
- ✅ Action button (if step has an action)
- ✅ Step indicator dots at bottom
- ✅ Skip button (top right)
- ✅ Next/Complete button (bottom right)

## Role-Specific Content

The onboarding content changes based on user role:

### Casual Role
- Welcome to JoaLLM
- Basic chat features
- Simple setup

### Premium/Analyst Role
- Welcome to Analyst Mode
- Notebook features
- Advanced analytics

### Admin/Developer Role
- Welcome to Developer Mode
- Workflow builder
- API configuration
- Model management

## Troubleshooting

### Onboarding doesn't appear
1. Check console for errors
2. Verify `localStorage.removeItem('joallm_onboarding_complete')` was run
3. Check that you're logged in
4. Refresh the page

### Onboarding appears every time
1. Check localStorage: `localStorage.getItem('joallm_onboarding_complete')`
2. Should be `true` after completing
3. If not, there's a bug in `completeOnboarding()`

### Wrong role content showing
1. Check current role: `localStorage.getItem('user_role')`
2. Verify role mapping in context
3. Check backend user role

## Manual Testing Checklist

- [ ] Onboarding appears for new users
- [ ] Progress bar updates correctly
- [ ] Skip button works
- [ ] Next button works
- [ ] Complete button appears on last step
- [ ] Onboarding doesn't appear after completion
- [ ] Role-specific content is correct
- [ ] Mobile responsive
- [ ] Dark mode works
- [ ] Action buttons navigate correctly

## Reset for Testing

To reset onboarding (show it again):
```javascript
// Clear only onboarding
localStorage.removeItem('joallm_onboarding_complete');

// Or reset everything
localStorage.clear();
```

Then refresh the page.

## Expected Console Output

When onboarding appears, you should see:
- No errors related to onboarding
- Role initialization in console
- Storage operations logged

## Completion Flow

1. User sees onboarding modal
2. User completes or skips
3. `completeOnboarding()` is called
4. `setIsFirstTime(false)` is executed
5. `storage.set('joallm_onboarding_complete', true)` is saved
6. Modal disappears
7. On next visit, modal doesn't appear

## Notes

- The onboarding is controlled by the `isFirstTime` state in `EnhancedUserRoleContext`
- This state is initialized based on the `joallm_onboarding_complete` localStorage flag
- The modal component `RoleBasedOnboarding` checks `if (!isFirstTime) return null` to hide/show
- All changes have been applied to both `commercial-frontend` and `landing-page` services


