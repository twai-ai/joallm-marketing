# Role Changes Summary

## Overview
This document summarizes the role system changes made to align with the requirement of removing the generic "user" role and implementing a "superuser" role for support@joallm.ai.

## Changes Made

### 1. Role System Restructure

#### Previous Roles
- `user` - Generic user role
- `admin` - Administrator role
- `premium` - Premium subscription role

#### New Roles
- `casual` - Default role for all new users (replaces generic "user")
- `admin` - Administrator role
- `premium` - Premium subscription role
- `superuser` - Special role for support@joallm.ai

### 2. Backend Changes

#### Database Schema (`services/backend/src/database/schema.ts`)
- Updated role enum from `['casual', 'user', 'admin', 'premium']` to `['casual', 'admin', 'premium', 'superuser']`
- Default role remains `'casual'`

#### Authentication Routes (`services/backend/src/routes/auth.ts`)
**Registration:**
- Automatically assigns `'superuser'` role to `support@joallm.ai`
- All other users default to `'casual'` role

**Login:**
- Ensures `support@joallm.ai` always has `'superuser'` role
- Automatically upgrades role if user is support@joallm.ai but doesn't have superuser role
- Password bypass for support@joallm.ai maintained

**Token Generation:**
- All token generation uses updated role enum
- Default role fallback changed from `'user'` to `'casual'`

### 3. Shared Types (`shared/types/index.ts`)
- Updated User interface role type from `'admin' | 'user'` to `'casual' | 'admin' | 'premium' | 'superuser'`

### 4. Frontend Changes

#### Commercial Frontend
- `AuthContext.tsx` - Updated role types
- `ProtectedRoute.tsx` - Updated role types
- `authService.ts` - Updated hasRole method signature
- `Header.tsx` - Updated default role display from 'user' to 'casual'

#### Landing Page
- `AuthContext.tsx` - Updated role types
- `ProtectedRoute.tsx` - Updated role types
- `authService.ts` - Updated hasRole method signature
- `Header.tsx` - Updated default role display from 'user' to 'casual'

## Role Definitions

### Casual (Default)
- Default role for all new registrations
- Basic access to platform features
- Standard chat functionality
- Basic document upload capabilities

### Admin
- Administrative access
- User management capabilities
- System configuration access
- Advanced analytics

### Premium
- Premium subscription features
- Enhanced API limits
- Priority support
- Advanced features access

### Superuser (support@joallm.ai)
- Special role exclusively for support@joallm.ai
- Highest level of access
- Bypasses normal authentication checks
- Full system access
- Cannot be changed by user actions

## Security Implications

### Positive Security Aspects
1. **Automatic Role Enforcement**: support@joallm.ai automatically gets superuser role
2. **Role Auto-Correction**: If role is changed, it's automatically corrected on login
3. **Clear Separation**: Casual users are distinct from premium/admin users
4. **Explicit Superuser**: Clear identification of highest privilege level

### Considerations
1. **Superuser Email Binding**: The superuser role is tightly bound to support@joallm.ai email
2. **Password Bypass**: support@joallm.ai can bypass password checks (for emergency access)
3. **Role Immutability**: Superuser role is automatically corrected if tampered with

## Migration Notes

### For Existing Users
- Users with 'user' role should be migrated to 'casual' role
- Database migration may be needed if 'user' role exists in production
- support@joallm.ai will automatically be upgraded to 'superuser' on next login

### Database Migration
If you have existing users with 'user' role, run this SQL:

```sql
UPDATE users 
SET role = 'casual' 
WHERE role = 'user';
```

## Testing Checklist

- [ ] New user registration defaults to 'casual' role
- [ ] support@joallm.ai registration gets 'superuser' role
- [ ] support@joallm.ai login maintains 'superuser' role
- [ ] Password bypass works for support@joallm.ai
- [ ] Casual users can access basic features
- [ ] Role display shows correctly in UI
- [ ] Protected routes work with new role types
- [ ] Token generation includes correct roles
- [ ] Frontend role checks work correctly

## Rollback Plan

If issues arise, follow these steps:

1. Revert role enum to include 'user': `['casual', 'user', 'admin', 'premium']`
2. Update default registration to use 'user' instead of 'casual'
3. Remove superuser auto-assignment logic
4. Revert frontend type changes
5. Run database migration to set all users back to 'user' role

## Related Files Changed

### Backend
- `services/backend/src/database/schema.ts`
- `services/backend/src/routes/auth.ts`

### Shared
- `shared/types/index.ts`

### Commercial Frontend
- `services/commercial-frontend/src/contexts/AuthContext.tsx`
- `services/commercial-frontend/src/components/auth/ProtectedRoute.tsx`
- `services/commercial-frontend/src/services/authService.ts`
- `services/commercial-frontend/src/components/layout/Header.tsx`

### Landing Page
- `services/landing-page/src/contexts/AuthContext.tsx`
- `services/landing-page/src/components/auth/ProtectedRoute.tsx`
- `services/landing-page/src/services/authService.ts`
- `services/landing-page/src/components/layout/Header.tsx`

## Conclusion

The role system has been successfully restructured to:
1. Remove the generic "user" role
2. Implement "casual" as the default role
3. Create "superuser" role exclusively for support@joallm.ai
4. Maintain backward compatibility where possible
5. Ensure automatic role enforcement for support account

All changes are consistent across frontend, backend, and shared types.


