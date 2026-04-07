# Generate Questions -- Correct Answer Justification Only

This prompt produces a question bank where **only the correct answer has a justification**. The three incorrect options have empty strings. Use this variant when you want shorter AI output (fewer tokens) or when your source material only explains the correct answer.

For maximum study value, consider using [generate-questions-full.md](generate-questions-full.md) instead, which explains all four options.

---

## How to Use

1. Copy everything inside the **Prompt** section below.
2. Replace each `{{PLACEHOLDER}}` with your own values (see the table after the prompt).
3. Paste the completed prompt into Claude or ChatGPT.
4. Save the AI's output as a `.js` file in the `questions/` folder (e.g., `questions/my-bank.js`).

---

## Prompt

> Copy from here to the end of this section. Replace all `{{PLACEHOLDER}}` values before pasting.

---

You are an expert exam question writer. Generate a set of multiple-choice practice questions for the following subject:

**Subject:** {{SUBJECT}}

**Domains / Topics to cover:**

{{DOMAINS}}

**Total number of questions to generate:** {{NUM_QUESTIONS}}

**Distribution across domains (optional -- delete this section if not needed):**

{{QUESTIONS_PER_DOMAIN}}

**Difficulty level:** {{DIFFICULTY}}

**Question style notes (optional -- delete this section if not needed):**

{{STYLE_NOTES}}

**Source material (optional -- paste study content below this line, or delete this section):**

{{SOURCE_MATERIAL}}

---

### Output format

You must produce a single JavaScript variable assignment. Do NOT wrap the output in markdown code fences. Do NOT use `module.exports` or `export`. The output must start exactly with `const QUESTIONS_DATA = {` and end with `};`.

Use this exact structure:

```
const QUESTIONS_DATA = {
  meta: {
    title: "<Subject> Practice Questions",
    totalQuestions: <N>,
    domains: [
      "<Domain 1>",
      "<Domain 2>"
    ]
  },
  questions: [
    {
      id: 1,
      domain: "<Domain 1>",
      question: "<Question stem>",
      options: {
        A: "<Option A>",
        B: "<Option B>",
        C: "<Option C>",
        D: "<Option D>"
      },
      correctAnswer: "<letter>",
      justifications: {
        A: "",
        B: "<Explanation of why this answer is correct>",
        C: "",
        D: ""
      }
    }
  ]
};
```

### Justification rules for this variant

- Only the **correct answer** gets a justification string (1-3 sentences explaining why it is right).
- The three **incorrect options** must have an empty string `""` as their justification.
- The justification key for the correct answer must match the `correctAnswer` letter. For example, if `correctAnswer` is `"C"`, then `justifications.C` gets the explanation and `justifications.A`, `justifications.B`, `justifications.D` are `""`.

### Field rules

- `id`: Positive integer, sequential starting from 1.
- `domain`: Must exactly match one of the strings in `meta.domains` (case-sensitive).
- `question`: The question stem. End with a question mark.
- `options`: Exactly four keys -- `A`, `B`, `C`, `D`. Each value is a string.
- `correctAnswer`: Exactly one of `"A"`, `"B"`, `"C"`, or `"D"`.
- `justifications`: Exactly four keys -- `A`, `B`, `C`, `D`. See justification rules above.
- `meta.totalQuestions`: Must equal the actual number of objects in the `questions` array.
- `meta.domains`: A non-empty array listing every domain used by any question.

### Quality rules

- Every question must have exactly one unambiguously correct answer.
- All four options must be plausible. Avoid joke answers or obviously wrong filler.
- Do NOT use "All of the above", "None of the above", or "Both A and C" style options.
- Vary the position of the correct answer across A, B, C, and D roughly equally.
- Use professional certification exam phrasing: "MOST important", "BEST describes", "PRIMARY reason", "Which of the following" where appropriate.
- Include a mix of factual recall, conceptual understanding, and scenario-based/applied questions.
- The correct-answer justification should be specific -- reference concepts, standards, or reasoning, not just "this is the right answer."
- Ensure all string values properly escape special characters (backslash, quotes) for valid JavaScript.

### Important

- Output ONLY the JavaScript code. No explanations, no commentary, no markdown fences before or after.
- Do NOT truncate. Generate all {{NUM_QUESTIONS}} questions in a single response.

---

## Placeholder Reference

| Placeholder | Required | What to Write |
|---|---|---|
| `{{SUBJECT}}` | Yes | Exam or course name (e.g., `AWS Solutions Architect Associate SAA-C03`) |
| `{{DOMAINS}}` | Yes | List of topic areas, one per line (e.g., `Design Resilient Architectures`, `Design High-Performing Architectures`) |
| `{{NUM_QUESTIONS}}` | Yes | Total question count (e.g., `50`). Keep under 50 per prompt to avoid truncation. |
| `{{QUESTIONS_PER_DOMAIN}}` | No | Distribution like `Resilient: 15, High-Performing: 15, ...`. Delete the section if not needed. |
| `{{DIFFICULTY}}` | No | `beginner`, `intermediate`, `exam-level`, or `advanced`. Default: `exam-level` |
| `{{STYLE_NOTES}}` | No | Any extra instructions, e.g., `Focus on hands-on scenarios`, `Emphasize cost optimization` |
| `{{SOURCE_MATERIAL}}` | No | Paste study guide text, exam objectives, or textbook content. More context = better questions. |

## Example (filled in)

Below is an example of what the prompt looks like after filling in the placeholders, for reference only.

> Subject: **Microsoft AI-102: Designing and Implementing an Azure AI Solution**
>
> Domains:
> - Plan and Manage an Azure AI Solution
> - Implement Decision Support Solutions
> - Implement Computer Vision Solutions
> - Implement Natural Language Processing Solutions
> - Implement Knowledge Mining and Document Intelligence Solutions
> - Implement Generative AI Solutions
>
> Total: **40**
>
> Difficulty: **exam-level**
>
> Style: Include scenario-based questions about real Azure services. Reference specific service names and configuration options.
