# Prompt Templates for Question Bank Generation

This folder contains ready-to-use prompts that you can paste into **Claude** or **ChatGPT** to generate question banks compatible with the Practice Quiz app. The prompts work for **any exam, certification, or subject** -- you fill in your specific details.

## Quick Start

1. Decide which prompt variant you need (see [Prompt Variants](#prompt-variants) below).
2. Open the corresponding `.md` file and copy the entire prompt.
3. Replace every `{{PLACEHOLDER}}` with your own values (see [What You Need to Provide](#what-you-need-to-provide)).
4. Paste the completed prompt into Claude or ChatGPT.
5. Copy the AI's output and save it as a new `.js` file in the `questions/` folder (e.g., `questions/aws-saa.js`).
6. Restart the server (`npm start`) -- or use the **Load** button in the app to load it without restarting.
7. Your new bank appears in the bank selector dropdown.

## Prompt Variants

| File | Justification Style | Best For |
|---|---|---|
| [generate-questions-full.md](generate-questions-full.md) | Explains **all four options** (why correct is right, why each distractor is wrong) | Maximum learning value; recommended for self-study |
| [generate-questions-correct-only.md](generate-questions-correct-only.md) | Explains **only the correct answer** (other three are blank) | Shorter output; useful when hitting token limits or when source material only explains correct answers |

When in doubt, use **full justifications** -- understanding why wrong answers are wrong is one of the most effective study techniques.

## What You Need to Provide

Before using a prompt, gather the following information. Items marked **(required)** must be filled in; the rest improve quality but can be omitted.

### Required

| Placeholder | What to Write | Examples |
|---|---|---|
| `{{SUBJECT}}` | The exam, certification, or course name | `ISACA AAIA`, `AWS Solutions Architect Associate`, `CompTIA Security+`, `Organic Chemistry 101` |
| `{{DOMAINS}}` | A list of topic areas, exam sections, or chapters to cover. One per line. | `AI Governance`, `AI Development`, `AI Operations` |
| `{{NUM_QUESTIONS}}` | Total number of questions to generate | `50`, `100` |

### Optional (but recommended)

| Placeholder | What to Write | Examples |
|---|---|---|
| `{{QUESTIONS_PER_DOMAIN}}` | How to distribute questions across domains. Delete this section if you want the AI to decide. | `AI Governance: 20, AI Development: 15, AI Operations: 15` |
| `{{DIFFICULTY}}` | Target difficulty level | `exam-level`, `beginner`, `intermediate`, `advanced` |
| `{{STYLE_NOTES}}` | Preferences for question phrasing or style | `Use "MOST important" / "BEST describes" stems`, `Include scenario-based questions`, `Focus on practical application` |
| `{{SOURCE_MATERIAL}}` | Paste study guide text, exam objectives, textbook excerpts, or any reference content the AI should base questions on. The more context you give, the better the questions. | *(paste content directly)* |

## Output Format

The AI will produce a JavaScript file that looks like this:

```javascript
const QUESTIONS_DATA = {
  meta: {
    title: "AWS Solutions Architect Associate Practice Questions",
    totalQuestions: 50,
    domains: [
      "Design Resilient Architectures",
      "Design High-Performing Architectures",
      "Design Secure Applications and Architectures",
      "Design Cost-Optimized Architectures"
    ]
  },
  questions: [
    {
      id: 1,
      domain: "Design Resilient Architectures",
      question: "A company needs to ensure that their web application remains available even if an entire Availability Zone fails. Which architecture BEST meets this requirement?",
      options: {
        A: "Deploy the application on a single large EC2 instance with enhanced networking",
        B: "Use an Auto Scaling group that spans multiple Availability Zones behind an Application Load Balancer",
        C: "Deploy the application in a single Availability Zone with automated EC2 instance recovery",
        D: "Use a larger instance type with provisioned IOPS storage for better performance"
      },
      correctAnswer: "B",
      justifications: {
        A: "A single instance, regardless of size, is a single point of failure and does not survive an AZ outage.",
        B: "An Auto Scaling group spanning multiple AZs with an ALB distributes traffic and automatically replaces failed instances, maintaining availability during an AZ failure.",
        C: "Deploying in a single AZ means the entire application goes down if that AZ fails, regardless of instance recovery capabilities.",
        D: "Instance size and storage performance do not address availability across Availability Zones."
      }
    }
    // ... more questions
  ]
};
```

### Format Rules

The app validates every bank on load. To avoid errors, the output **must** follow these rules:

- The variable is named exactly `QUESTIONS_DATA` (not `questionsData`, not `module.exports`)
- `meta.title` is a non-empty string
- `meta.domains` is a non-empty array of strings
- `meta.totalQuestions` matches the actual number of items in the `questions` array
- Each question has:
  - `id` -- positive integer, sequential starting from 1
  - `domain` -- a string that exactly matches one of the entries in `meta.domains`
  - `question` -- the question stem as a non-empty string
  - `options` -- an object with exactly four keys: `A`, `B`, `C`, `D`
  - `correctAnswer` -- one of `"A"`, `"B"`, `"C"`, `"D"`
  - `justifications` -- an object with keys `A`, `B`, `C`, `D` (values are strings; use `""` for blank)
- The output is raw JavaScript -- **not** wrapped in markdown code fences (` ```javascript `)

## Tips for Better Results

- **Provide source material.** Pasting exam objectives, textbook sections, or study guide content dramatically improves question accuracy and relevance.
- **Generate in batches.** If you need 200 questions, generate 50 at a time. Large outputs increase the chance of the AI truncating or making format errors.
- **Verify the output.** Open the generated `.js` file in a text editor and spot-check a few questions for accuracy before loading it into the app.
- **Specify domain distribution.** If some domains are more heavily tested on the real exam, tell the AI to weight them accordingly.
- **Iterate.** If the first batch is too easy or too hard, adjust the `{{DIFFICULTY}}` and `{{STYLE_NOTES}}` placeholders and regenerate.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Bank does not appear in the dropdown | File is not in `questions/` or has a syntax error | Move the file to `questions/`, open it in an editor, and check for missing commas or brackets |
| "Failed to parse question bank" error | Output is wrapped in markdown code fences | Remove the `` ```javascript `` and `` ``` `` lines from the top and bottom of the file |
| Questions load but justifications are blank | Using the correct-only variant | This is expected -- only the correct answer has a justification |
| AI truncated the output mid-question | Too many questions requested at once | Ask for fewer questions per prompt (30-50 is a safe range) and combine files manually |
| Domain filter shows unexpected entries | `domain` on questions does not match `meta.domains` exactly | Ensure domain strings are identical (case-sensitive) in both places |
| `totalQuestions` mismatch warning | `meta.totalQuestions` does not match array length | Count the questions in the array and update `meta.totalQuestions` to match |
