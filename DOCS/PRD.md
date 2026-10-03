# Product Requirements Document (PRD) — LocalCommit

## 1. Executive Summary
**LocalCommit** is a local-first, AI-powered Command Line Interface (CLI) tool designed to transform messy `git diff --staged` outputs into standardized, clean Conventional Commit messages (`feat:`, `fix:`, `chore:`, etc.). Built with Node.js and TypeScript, it leverages local open-weight LLMs (Gemma 2B via Ollama) with an optional cloud fallback (Backboard API).

## 2. Target User & Persona
- **Target User:** Developers who dislike manually typing structured commit messages, teams needing automated git traceability, and developers working under strict code-privacy constraints.
- **Primary Persona:** "The Speed Developer" — wants zero-friction tooling, instant execution, local privacy (no proprietary code leaving the machine), and clear terminal prompts.

## 3. Core Problem Statement
Developers frequently write vague commit messages (e.g., `wip`, `fix stuff`, `asdf`), breaking automated changelog generation and making release debugging difficult. Cloud AI tools risk leaking proprietary code diffs to external APIs.

## 4. Key Features & Requirements

### F-1: Staged Git Diff Reader
- Reads current staged changes using native shell integration (`git diff --staged`).
- Validates if any files are staged. If empty, halts gracefully with an actionable warning.

### F-2: Local Open-Weight Inference (Gemma 2B via Ollama)
- Connects to Ollama running locally at `http://localhost:11434`.
- Transmits the raw staged diff to `gemma:2b` with a strict system prompt to generate a Conventional Commit string.

### F-3: Backboard API Fallback Client
- If Ollama is unreachable or configured for cloud mode, routes inference through the Backboard API endpoint.
- Satisfies partner tag requirements for `#gemma` and `#backboard` Hacktoberfest tracks.

### F-4: Conventional Commit Enforcer
- Parses and formats output into standard format: `<type>(<scope>): <short description>`.
- Automatically strips conversational AI fluff or extra markdown backticks.

### F-5: Interactive Terminal Confirmation
- Displays the proposed commit message to standard output.
- Prompts the user with `Commit with this message? [y/N]`.
- On `y` / `yes`: Executes `git commit -m "<message>"`.
- On `n` / `no` / `abort`: Cancels execution without touching the git history.