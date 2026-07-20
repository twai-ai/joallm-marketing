# 📝 Monorepo Commit Strategy - Prevent Deployment Skips

**Purpose:** Best practices for commits in a monorepo to ensure proper Railway deployments  
**Audience:** All developers  
**Status:** ✅ ADOPT IMMEDIATELY

---

## 🎯 THE GOLDEN RULE

**One Service Per Commit (When Possible)**

This ensures Railway can clearly identify which service changed and deploy accordingly.

---

## ✅ GOOD COMMIT PATTERNS

### **Pattern 1: Pure Frontend Commit**
```bash
# Change only frontend files
git add services/frontend/
git commit -m "feat(frontend): Add dark mode toggle to settings"
git push
```

**Railway Action:** ✅ Deploys ONLY frontend  
**Why it works:** Clear single-service change

---

### **Pattern 2: Pure Backend Commit**
```bash
# Change only backend files
git add services/backend/
git commit -m "feat(backend): Add rate limiting middleware"
git push
```

**Railway Action:** ✅ Deploys ONLY backend  
**Why it works:** Clear single-service change

---

### **Pattern 3: Docs Only (Skips are OK!)**
```bash
# Documentation updates
git add *.md docs/
git commit -m "docs: Update API documentation"
git push
```

**Railway Action:** ⏭️ SKIPS (Correct behavior!)  
**Why it works:** No code changes = no deployment needed

---

### **Pattern 4: Multiple Services (Use Separate Commits)**
```bash
# If you changed both frontend AND backend:

# Commit 1: Frontend
git add services/frontend/
git commit -m "feat(frontend): Add user profile page"
git push

# Commit 2: Backend
git add services/backend/
git commit -m "feat(backend): Add user profile API endpoint"
git push
```

**Railway Action:** ✅ Deploys BOTH (separately)  
**Why it works:** Clear boundaries per commit

---

## ❌ BAD COMMIT PATTERNS (Cause Skips)

### **Anti-Pattern 1: Everything in One Commit**
```bash
# DON'T DO THIS:
git add .
git commit -m "feat: Add user profiles"
# Contains: frontend + backend + docs + tests + scripts
git push
```

**Railway Action:** ⏭️ SKIPS (confused by mixed changes)  
**Problem:** Railway can't determine primary service changed

---

### **Anti-Pattern 2: Docs + Code Mixed**
```bash
# DON'T DO THIS:
git add services/frontend/Header.tsx
git add DEPLOYMENT_GUIDE.md UI_IMPROVEMENTS.md
git commit -m "feat: Update Header + add docs"
git push
```

**Railway Action:** ⏭️ SKIPS (sees docs as majority)  
**Problem:** Docs overwhelm the code change signal

---

### **Anti-Pattern 3: Small Code + Huge Docs**
```bash
# Commit contains:
# - 2 frontend files changed
# - 20 documentation files added
# Total: 22 files (91% docs, 9% code)
```

**Railway Action:** ⏭️ SKIPS (heuristic says "mostly docs")  
**Problem:** Ratio of docs to code triggers skip

---

## 🎯 CONVENTIONAL COMMIT FORMAT

Use this format for Railway-friendly commits:

```
<type>(<scope>): <description>

[optional body]
```

### **Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation only
- `test` - Tests only
- `chore` - Maintenance

### **Scopes (IMPORTANT):**
- `frontend` - Frontend service
- `backend` - Backend service
- `landing` - Landing page service
- `shared` - Shared code (deploys all)
- `infra` - Infrastructure (may skip)

### **Examples:**

✅ **`feat(frontend): Add dark mode toggle`**
- Clearly frontend
- Railway deploys frontend ✅

✅ **`fix(backend): Resolve database connection timeout`**
- Clearly backend
- Railway deploys backend ✅

✅ **`docs: Update README`**
- Clearly docs only
- Railway skips (correct!) ⏭️

✅ **`feat(shared): Update API types`**
- Shared code affects all
- Railway deploys all services ✅

---

## 🔄 HANDLING CROSS-SERVICE CHANGES

When a feature requires changes to multiple services:

### **Option A: Sequential Commits (Recommended)**

```bash
# Step 1: Backend API first
git add services/backend/
git commit -m "feat(backend): Add user profile API endpoint"
git push
# Railway deploys backend ✅

# Wait for backend deploy to complete (~5 min)

# Step 2: Frontend using that API
git add services/frontend/
git commit -m "feat(frontend): Add user profile page using new API"
git push
# Railway deploys frontend ✅
```

**Benefits:**
- Clear deployment order
- Can test backend first
- Each deployment isolated
- Easy to debug issues

---

### **Option B: Tagged Multi-Service (Advanced)**

```bash
# If you MUST commit both together:
git add services/frontend/ services/backend/
git commit -m "feat(frontend,backend): Add user profiles

Frontend: User profile page component
Backend: User profile API endpoint

Breaking: Frontend requires backend v2.1+"
git push
```

**Railway with proper watch paths:** Deploys BOTH services

---

## 📊 COMMIT SIZE GUIDELINES

### **Ideal Commit:**
- ✅ 1-10 code files changed
- ✅ 0-2 doc files (if related)
- ✅ Single service directory
- ✅ Clear scope in message

### **Acceptable Commit:**
- ✅ 10-20 code files changed
- ✅ 0-5 doc files
- ✅ Single service directory

### **Problematic Commit:**
- ⚠️ 5 code files changed
- ⚠️ 15+ doc files added
- ⚠️ Multiple service directories
- Railway might skip!

---

## 🎯 REAL EXAMPLES FROM YOUR REPO

### **✅ GOOD: Commit `69d0ff6`**
```
feat: Enhanced Knowledge Manager with bulk actions

Files changed:
- services/frontend/...BulkActionToolbar.tsx
- services/frontend/...BulkDeleteConfirmModal.tsx
- services/frontend/...DocumentFilters.tsx
- services/frontend/...KnowledgeManagerNew.tsx

Result: Railway DEPLOYED ✅
```

**Why it worked:**
- Pure frontend commit
- No docs at all
- Clear service boundary
- Railway: "100% frontend change" → DEPLOY!

---

### **❌ BAD: Commit `0898e23`**
```
feat: Major header redesign + documentation

Files changed:
- services/frontend/...Header.tsx
- services/frontend/...Logo.tsx
- services/frontend/...ThemeToggle.tsx
- HEADER_UX_IMPROVEMENTS.md
- HEADER_VISUAL_GUIDE.md
- DATABASE_EXPLORATION.md

Result: Railway SKIPPED ❌
```

**Why it failed:**
- 3 frontend files
- 3 docs files
- 50/50 split
- Railway: "Mixed signals, half docs" → SKIP

**How to fix:**
```bash
# Commit 1: Code only
git add services/frontend/
git commit -m "feat(frontend): Major header redesign"
git push

# Commit 2: Docs only  
git add *.md
git commit -m "docs: Add header redesign documentation"
git push
```

---

## 🔍 BEFORE COMMITTING - ASK YOURSELF

1. **Did I change files in multiple services?**
   - YES → Split into separate commits
   - NO → Proceed

2. **Am I adding 5+ documentation files?**
   - YES → Commit docs separately
   - NO → Proceed

3. **Is this a pure docs change?**
   - YES → Use `docs:` prefix (Railway will skip - correct!)
   - NO → Use `feat:` or `fix:` prefix

4. **Does my commit message have a scope?**
   - NO → Add it: `feat(frontend):` or `feat(backend):`
   - YES → Good!

---

## 📋 PRE-COMMIT CHECKLIST

Before running `git push`:

- [ ] Commit affects ONE service OR is pure docs
- [ ] Commit message has scope: `(frontend)`, `(backend)`, `(landing)`
- [ ] Less than 10 files changed (or all in same service)
- [ ] If docs included, less than 3 doc files
- [ ] OR separate docs commit planned next

---

## 🚀 EMERGENCY: "I Already Committed Wrong"

**If you made a mixed commit:**

### **Option 1: Amend (if not pushed yet)**
```bash
# Uncommit
git reset HEAD~1

# Commit frontend only
git add services/frontend/
git commit -m "feat(frontend): Add feature X"

# Commit backend separately
git add services/backend/
git commit -m "feat(backend): Add API for feature X"

# Commit docs last
git add *.md
git commit -m "docs: Document feature X"
```

---

### **Option 2: Follow-up Commit (if already pushed)**
```bash
# Don't worry, just do this:
# Make a tiny change to frontend
echo "// trigger deploy" >> services/frontend/src/App.tsx

git add services/frontend/
git commit -m "feat(frontend): Trigger deployment with latest changes"
git push
```

---

## 🎓 WHY THIS MATTERS

### **With Good Strategy:**
```
Commit 1 (frontend) → Railway deploys frontend ✅
Commit 2 (backend) → Railway deploys backend ✅
Commit 3 (docs) → Railway skips ✅
```
- Clear deployment history
- Easy to track what's live
- Fast CI/CD
- No technical debt

### **With Bad Strategy:**
```
Commit 1 (mixed) → Railway SKIPS ❌
Commit 2 (mixed) → Railway SKIPS ❌
Commit 3 ("trigger") → Railway deploys ✅ (but with old+new changes)
```
- Confusing deployment history
- Unknown what's actually deployed
- Slow CI/CD
- Technical debt accumulates

---

## 📊 DEPLOYMENT PREDICTABILITY

**Goal:** Make Railway's behavior PREDICTABLE

```
Frontend file change → Frontend deploys
Backend file change → Backend deploys  
Docs change → Nothing deploys (correct!)
```

**With proper commits + watch paths:**
- ✅ 100% predictable
- ✅ Fast feedback
- ✅ Easy debugging
- ✅ Clean history

---

## 🎯 SUMMARY

**DO:**
- ✅ One service per commit when possible
- ✅ Use conventional commit format with scope
- ✅ Separate code and docs commits
- ✅ Keep commits focused and small

**DON'T:**
- ❌ Mix frontend + backend in one commit
- ❌ Add 10+ docs files with 2 code files
- ❌ Use generic commit messages without scope
- ❌ Commit "everything" with `git add .`

---

**Adopt this strategy and Railway will love you!** 🚂💚

Your deployments will be fast, predictable, and debt-free! 🚀

