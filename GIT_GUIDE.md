**Run locally:** `npm install` then `npm run dev`. Set `DATABASE_URL` (and optional `GEMINI_API_KEY`) in `.env`.

---

# Git Guide for Lingua Boost

A simple explainer for the git commands you need to manage this project. Each section explains **what** the command does and **why** you’d use it.

---

## The Big Idea

- **Git** tracks changes to your code over time and lets you try ideas on separate “branches” without breaking the main app.
- **Branch** = a separate line of work. You do new work on a branch, then merge it into `main` when it’s ready.
- **Commit** = a saved snapshot of your project at a point in time. You commit after a logical chunk of work (e.g. “fix env loading”).
- **Remote** = the copy of the repo on GitHub (or another host). You **push** your commits to the remote so others can see them and so you have a backup.

---

## 1. See Where You Are

**Check which branch you’re on and what’s changed:**

```bash
git status
```

- **Branch:** The first line says `On branch main` (or another name). That’s your current branch.
- **Changes:** It lists modified or new files. “Untracked” = not added to git yet.

**Why:** Run this whenever you’re not sure what branch you’re on or what you’ve changed.

---

## 2. Start New Work on a New Branch

**Do this when you’re about to add a feature or fix a bug.** It keeps `main` clean until the work is done.

```bash
git checkout -b my-feature-name
```

- **`checkout`** = switch to a branch.
- **`-b`** = create the branch and switch to it in one step.
- **`my-feature-name`** = use a short, clear name (e.g. `fix-env-loading`, `custom-practice-mode`).

**Why:** All your new commits go on this branch. `main` doesn’t change until you merge.

**Then:** Make your code changes as usual. When you’re ready to save a snapshot, use the next steps.

---

## 3. Save Your Work (Commit)

**Two steps: stage files, then commit.**

**Step 1 – Stage (choose what to include):**

```bash
git add .
```

- **`.`** = “all changed files in this folder and below.”  
  To add only one file: `git add path/to/file.ts`

**Step 2 – Commit (create the snapshot with a message):**

```bash
git commit -m "Short description of what you did"
```

- **`-m`** = message. No space between `-m` and the message. Use quotes.
- Example: `git commit -m "Fix Start Review button payload"`

**Why:** Commits are the history of your project. Good messages make it easy to understand later what each change was for.

---

## 4. Send Your Branch to GitHub (Push)

**After you’ve committed**, put your branch on the remote so it’s backed up and visible (e.g. for pull requests).

**First time pushing this branch:**

```bash
git push -u origin my-feature-name
```

- **`push`** = upload your commits to the remote.
- **`-u origin`** = remember that this branch tracks `origin/my-feature-name`, so next time you can just run `git push`.
- **`my-feature-name`** = the branch name (same as in step 2).

**Next times** (after `-u` has been set once):

```bash
git push
```

**Why:** Your work is on GitHub, safe and shareable. You can open a Pull Request from this branch into `main` when ready.

---

## 5. Open a Pull Request (on GitHub)

**A Pull Request (PR)** is a request to pull your branch’s changes into `main`. You create and merge PRs on GitHub in the browser; the terminal is only for pushing your branch and then syncing after the merge.

**Step 1 – Push your branch** (see section 4):

```bash
git push -u origin my-feature-name
```

**Step 2 – Create the PR on GitHub:**

- Go to your repo on GitHub.
- You’ll often see a yellow bar: “my-feature-name had recent pushes” with a **Compare & pull request** button. Click it.
- Or: open the **Pull requests** tab → **New pull request** → set “base” to `main`, “compare” to your branch name.
- Add a title and short description of what you did, then click **Create pull request**.

**Step 3 – Merge the PR on GitHub:**

- Review the diff if you want, then click **Merge pull request** and **Confirm merge**.

**Step 4 – Sync your local repo (in the terminal):**

```bash
git checkout main
git pull
```

That updates your local `main` with the merged changes.

**Optional – Delete the feature branch locally:**

```bash
git branch -d my-feature-name
```

That removes the branch only if it’s fully merged. You can also delete the branch on GitHub from the branch list or from the closed PR page.

**Why use a PR:** You get a clear record of what changed and why. In team projects, others can review the code before it lands on `main`.

---

## 6. Go Back to Main and Get Latest

**When you’re done on a branch (or want to start from a clean main):**

```bash
git checkout main
```

Then, if others (or you on another machine) have updated `main`, pull those changes:

```bash
git pull
```

- **`pull`** = download new commits on the current branch and merge them into your local branch.

**Why:** Keeps your local `main` in sync with the remote before you start a new branch or merge.

---

## 7. Create a New Branch From Another Branch

**You’re on `cursorRestart` and want a new branch that starts from it:**

```bash
git checkout -b new-branch-name
```

That creates `new-branch-name` from wherever you are now (e.g. `cursorRestart`). All commits from `cursorRestart` are in the new branch too.

**Why:** Lets you build new work on top of an existing branch instead of `main`.

---

## Quick Reference: Common Sequences

| Goal | Commands |
|------|----------|
| Start a new feature | `git checkout main` → `git pull` → `git checkout -b feature-name` → make changes → `git add .` → `git commit -m "Message"` → `git push -u origin feature-name` |
| Save more work on current branch | `git add .` → `git commit -m "Message"` → `git push` |
| Merge via Pull Request | Push branch → on GitHub: **Compare & pull request** → Create PR → **Merge** → then in terminal: `git checkout main` → `git pull` → (optional) `git branch -d feature-name` |
| Switch back to main | `git checkout main` → (optional) `git pull` |
| Start a branch from another branch | `git checkout other-branch` → `git checkout -b new-branch` |

---

## Mistakes to Avoid

1. **Space in `-m`**  
   Wrong: `git commit - m "message"`  
   Right: `git commit -m "message"`

2. **Forgetting to be on the right branch**  
   Run `git status` before committing so you don’t commit to the wrong branch.

3. **Committing without staging**  
   You must run `git add` (or `git add .`) before `git commit`; otherwise the commit will be empty or not include your changes.

---

## Summary

- **Branch** = line of work. **Commit** = snapshot. **Push** = send branch to GitHub. **Pull Request** = merge your branch into `main` on GitHub.
- New work: create branch → change code → add → commit → push → open PR on GitHub → merge → `git checkout main` and `git pull`.
- Use `git status` often to see branch and changes; use `git checkout main` and `git pull` to sync with the main project.
