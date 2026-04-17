# Git Workflow Rules (Production-Level - Strict Mode)

You are responsible for managing Git operations in a clean, structured, and professional way after every meaningful code change.

This is a STRICT system. No shortcuts.

---

# 🔴 CORE PRINCIPLE

Git is NOT storage.

Git is:
✔ a history of decisions
✔ a timeline of development
✔ always deployable at any point

---

# 🔴 HARD RULE: CODE MUST RUN AFTER EVERY COMMIT

* NEVER commit broken code
* EVERY commit must run successfully
* If unsure → DO NOT commit

If broken:

✔ Fix immediately
OR
✔ Revert commit

---

# 🔴 COMMIT SIZE RULE (NON-NEGOTIABLE)

Each commit must:

✔ Do ONE logical thing
✔ Be understandable in <10 seconds
✔ Be safely revertable

BAD:

* Multiple features in one commit ❌
* UI + backend + config mixed ❌

GOOD:

* feat: add image compression utility ✔

---

# 🔴 ATOMIC COMMIT RULE

Each commit must:

✔ Have a single responsibility
✔ Not depend on a future commit to work
✔ Not leave system in partial state

---

# 🔴 COMMIT MESSAGE FORMAT

STRICT:

<type>: <clear, specific description>

DO NOT use:

* update
* changes
* final
* done

Examples:

feat: implement image upload pipeline with compression
fix: handle null timestamp in memory mapping
refactor: simplify vault membership logic
chore: add expo-image-picker dependency

---

# 🔴 COMMIT TYPES (ONLY THESE)

* feat → new feature
* fix → bug fix
* refactor → internal improvement
* chore → config, dependencies, minor updates

---

# 🔴 STAGING RULES

* Stage ONLY relevant files
* Avoid `git add .` unless verified
* Never include unrelated changes

---

# 🔴 COMMIT ORDER (MANDATORY)

1. Core logic (services, business logic)
2. State management
3. UI / screens
4. Styling / minor updates

---

# 🔴 PRE-COMMIT CHECKLIST (MANDATORY)

Before EVERY commit:

✔ App runs
✔ No crashes
✔ No console.log
✔ No unused imports
✔ No debug code
✔ No sensitive data (.env, API keys)
✔ Files formatted

---

# 🔴 DEBUG RULE

* NEVER commit debug logs
* Remove ALL console.log before commit

---

# 🔴 DEPENDENCY RULE

* Dependencies must be committed separately

Example:

chore: add expo-image-manipulator dependency

---

# 🔴 REFACTOR RULE

Refactor must:

✔ NOT change behavior
✔ ONLY improve structure

If behavior changes → use `feat`

---

# 🔴 FAILURE RULE (CRITICAL)

If a commit introduces a bug:

✔ Fix immediately
OR
✔ Revert commit

DO NOT stack broken commits

---

# 🔴 BRANCHING STRATEGY (STRICT)

## CORE RULES

* NEVER work on `main` for features
* ALWAYS use feature branches
* KEEP branches small
* DELETE after merge

---

# 🔴 WHEN TO CREATE A BRANCH

Create for:

✔ Feature
✔ Bug fix
✔ Refactor affecting multiple files

Do NOT create for:

* Minor UI text
* Small styling

---

# 🔴 BRANCH NAMING

feature/<name>
fix/<name>
refactor/<name>

Examples:

feature/multimodal-memories
feature/on-this-day
fix/image-upload-crash

---

# 🔴 BRANCH WORKFLOW

1. Create branch:

git checkout -b feature/<name>

2. Work inside branch
3. Make atomic commits
4. Push branch

---

# 🔴 BRANCH SYNC RULE (CRITICAL)

Before merging:

git checkout feature/<name>
git pull origin main

✔ Prevents conflicts

---

# 🔴 MERGE STRATEGY

1. Switch to main:

git checkout main

2. Pull latest:

git pull origin main

3. Merge:

git merge feature/<name>

---

# 🔴 MERGE CONFLICT RULE

If conflict occurs:

✔ Resolve manually
✔ Understand BOTH sides
✔ Do NOT blindly accept changes
✔ Test app after resolving

---

# 🔴 PRE-MERGE CHECKLIST (MANDATORY)

✔ App runs
✔ No crashes
✔ Feature fully complete
✔ No console logs
✔ No partial logic
✔ All flows tested

---

# 🔴 POST-MERGE RULE

✔ Test app again on main
✔ Ensure no regression

---

# 🔴 DELETE BRANCH (MANDATORY)

After merge:

git branch -d feature/<name>

---

# 🔴 OPTIONAL (ADVANCED)

Clean history:

git rebase -i main

Use ONLY if confident

---

# 🔴 FULL WORKFLOW (EXPECTED BEHAVIOR)

For EVERY feature:

1. Create branch
2. Implement feature
3. Make atomic commits
4. Validate after each commit
5. Push branch
6. Sync with main
7. Final validation
8. Merge
9. Test on main
10. Delete branch

---

# 🎯 FINAL STANDARD

Your repository must:

✔ Have clean, readable history
✔ Show clear feature evolution
✔ Be understandable to any developer
✔ Be deployable at ANY commit
✔ Reflect production-level discipline

---

NO SHORTCUTS.
