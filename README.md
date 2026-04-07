# Practice Quiz

A self-hosted, browser-based multiple-choice quiz application that supports any exam or certification. Drop question bank files into the `questions/` folder and they are automatically discovered and available to study.

## Features

- **Auto-discovery** -- question banks placed in `questions/` are detected on server start
- **Domain filtering** -- study a specific topic area or all domains at once
- **Sequential or random order** -- choose how questions are presented
- **Per-option justifications** -- after answering, see why each option is correct or incorrect
- **Progress tracking** -- scores and answers persist in your browser (localStorage)
- **Import / Save** -- save progress to a JSON file and restore it later or on another machine
- **Missed-questions review** -- retry only the questions you got wrong
- **Skip already answered** -- optional (on by default): hide questions you have already answered in this bank
- **Wrong-only study** -- optional: only questions you answered incorrectly, limited to the domain you select on setup
- **Remove loaded banks** -- remove a bank you added with **Load** from the browser registry; banks from `questions/` are built-in and cannot be removed
- **Bank-wide score** -- header shows your correct count across the whole bank as well as the current run
- **Session report** -- generate an AI Markdown summary from the quiz screen or the end-of-quiz summary (same action)
- **AI-powered explanations** -- ask Claude to explain a question in more depth (optional; requires an Anthropic API key)
- **File picker loading** -- load a custom question bank directly from your computer without restarting the server

## Prerequisites

| Requirement | Details |
|---|---|
| **Node.js** | v18 or later recommended -- download from [nodejs.org](https://nodejs.org) |
| **npm** | Included with Node.js |
| **Anthropic API key** | Optional. Needed for AI explanations and the session report |

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd AI-ExamSim
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables** (optional)

   Create a `.env` file in the project root if you want to use AI explanations or session reports:

   ```
   ANTHROPIC_API_KEY=your-api-key-here
   ```

   > You can get an API key from [console.anthropic.com](https://console.anthropic.com/).

4. **Start the server**

   ```bash
   npm start
   ```

5. **Open in your browser**

   Navigate to [http://localhost:3000](http://localhost:3000).

## How to Use

### Setup Screen

1. **Select a Question Bank** -- pick from the auto-discovered banks in the dropdown, or click **Load** to open a `.js` question bank file from your computer. For banks you loaded yourself, **Remove** drops that bank from the list and clears its saved progress and run data; it stays disabled for built-in banks from `questions/`.
2. **Choose a Domain** -- filter to a specific topic or select **All Domains**.
3. **Set Question Order** -- **Sequential** goes in order; **Random** shuffles.
4. **Skip questions I've already answered** -- when checked (default), those questions are left out of the next run. This filter does not apply while you are in **missed review** or when **Only questions I answered incorrectly** is enabled for that run.
5. **Only questions I answered incorrectly** -- when checked, the next run is limited to wrong answers in the **currently selected domain** (uses your saved progress for that bank).
6. Click **Start Quiz**.

### Taking the Quiz

- Select an answer (A, B, C, or D). The app immediately shows whether you are correct.
- **Clear answer** (below the question) removes your choice on the current question so you can pick again; score, missed list, and session run data update to match.
- **Justifications** appear below the question explaining each option.
- Use **Previous** / **Next** to navigate between questions.
- The header shows your running score for **this quiz run**, a **Bank** line with correct answers out of the total questions in the bank, and a count of missed questions.

### AI Explanations

After answering a question, the AI panel toggle appears (only when the server is running with a valid Anthropic API key). The label is **Ask AI to Explain** if you answered incorrectly, or **Ask AI anything** if you were correct. Click it to open the chat and get a detailed, conversational explanation from Claude. You can ask follow-up questions in the same chat.

The server uses the **`claude-sonnet-4-20250514`** model for streaming chat and for session reports (see below).

### Progress Management

- **Save** -- downloads your current score, answers, and missed-question list to a JSON file.
- **Save and Exit** -- same as **Save**, then returns to the setup screen.
- **Session report** -- use **Session report** on the quiz toolbar or **Session report (.md)** on the summary screen; both download the same Markdown file. The button is enabled after you have answered at least one question in the **current quiz run** (since you last clicked **Start Quiz**, **Retry All**, **Retry Missed Only**, or started **missed review**). While the report is generated, a short wait overlay appears (often about 15–60 seconds). Claude produces session overview, concepts practiced, key takeaways, and further-study suggestions from your answers, justifications, and any AI tutor chat from that run. Requires the same `ANTHROPIC_API_KEY` as AI explanations. **Limits:** for very long runs, only the first **80** questions in the run are sent; the report notes when truncation applies.
- **Import** -- restores a previously saved progress file.
- **Reset** -- clears all progress for the current bank.

### End of Quiz

After the last question you will see a summary screen with:
- Overall score and percentage
- Breakdown by domain
- Options to **Retry All**, **Retry Missed Only**, **Session report (.md)** (when the current run has answers), or **Back to Setup**

## Adding Question Banks

Place a `.js` file in the `questions/` folder. The server auto-discovers it on the next start. Each file must define a `const QUESTIONS_DATA` variable with a specific structure.

The **[prompts/](prompts/)** folder holds the detailed format specification and AI prompt templates for generating new banks. Start with [prompts/README.md](prompts/README.md) for validation rules and examples. For banks with a short explanation on every answer option, use [prompts/generate-questions-full.md](prompts/generate-questions-full.md); for banks that justify only the correct answer (empty strings on the other options), use [prompts/generate-questions-correct-only.md](prompts/generate-questions-correct-only.md).

**Sample bank:** [questions/general-cybersecurity-sample.js](questions/general-cybersecurity-sample.js) is a small built-in set (10 questions, full per-option justifications) you can use to try the app without loading a large bank.

You can also load a bank file at runtime using the **Load** button on the setup screen (no restart required).

## Project Structure

```
AI-ExamSim/
  server.js          Express server (static files + API endpoints)
  app.js             Client-side quiz logic
  index.html         Single-page UI
  styles.css         Stylesheet
  .env               Environment variables (not committed)
  package.json       Dependencies and scripts
  questions/         Question bank .js files (auto-discovered); includes general-cybersecurity-sample.js
  prompts/           Prompt templates and QUESTIONS_DATA format spec (see prompts/README.md)
  progress/          Saved progress JSON files
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | No | -- | Anthropic API key for AI chat streaming and session report generation |
| `PORT` | No | `3000` | Port the server listens on |

## License

ISC
