# Git Workflow Rules (Industry Standard)

You are responsible for managing Git operations in a clean, structured, and professional way after every meaningful code change.

STRICT RULES:
- NEVER create a single large commit for everything
- ALWAYS group commits logically by feature or concern
- NEVER use vague commit messages like "update", "fix", "changes"
- NEVER commit sensitive files (.env, API keys, credentials)
- ALWAYS follow a clean commit structure
- KEEP commits readable for code reviewers

---

## 1. COMMIT STRATEGY

Split changes into logical commits based on:

- Feature (auth, vault, navigation)
- Fix (bug fixes, edge cases)
- Refactor (code cleanup, no behavior change)
- Chore (config, UI polish, minor updates)

---

## 2. COMMIT MESSAGE FORMAT

Follow this format STRICTLY:

<type>: <short clear description>

Examples:

feat: implement vault creation with rollback safety  
feat: add invite code generation and validation  
fix: prevent state update on unmounted component  
refactor: clean up auth service error handling  
chore: improve UI loading states and error messages  

---

## 3. COMMIT TYPES

Use ONLY these:

- feat → new feature
- fix → bug fix
- refactor → internal improvement (no feature change)
- chore → minor updates, UI tweaks, configs

---

## 4. STAGING RULES

- Stage ONLY relevant files per commit
- DO NOT use `git add .` blindly
- Use selective staging

Example:

git add src/services/vaultService.ts
git commit -m "feat: implement vault creation with rollback safety"

---

## 5. COMMIT ORDER (IMPORTANT)

Always commit in this order:

1. Core logic (services, business logic)
2. State management / hooks
3. UI / screens
4. Styling / minor changes

---

## 6. PRE-COMMIT CHECKLIST

Before committing:

- Code runs without errors
- No console logs or debug code left
- No unused imports
- No sensitive data exposed
- Files are properly formatted

---

## 7. PUSH RULES

After commits:

- Ensure branch is correct (main or feature branch)
- Push with:

git push origin main

OR

git push -u origin <feature-branch>

---

## 8. OPTIONAL (ADVANCED - IF APPLICABLE)

For larger features:

- Use separate branch:

git checkout -b feature/vault-creation

- Merge after completion

---

## 9. WHAT NOT TO DO (CRITICAL)

DO NOT:

- Commit everything at once
- Use "final", "done", "last", "update"
- Push broken code
- Commit .env or credentials
- Mix multiple features in one commit

---

## 10. EXPECTED OUTPUT

After any code change:

- Analyze changes
- Split into logical commits
- Generate correct commit messages
- Execute git add + commit for each
- Push cleanly

---

END GOAL:

Your Git history should look like a professional production project, readable and review-friendly.