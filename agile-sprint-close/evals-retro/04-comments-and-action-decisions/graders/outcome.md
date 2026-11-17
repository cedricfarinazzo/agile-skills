---
type: llm
focus: last_message
weight: 1
---
Comment questions come first, and every action is decided with the user through options. The run stops where it needs the user's answers, so its questions may share one message; judge order within it. Check all of:
- It handles the comment questions before the team interview or the action items.
- APP-53 is answered from evidence (sync.py:72 retries on 429), not put to the user as an open question. Showing that evidence answer and asking the user to confirm or correct it before posting is the skill's Step 1.6 and passes; asking the user to supply the answer, or offering APP-53 options as a decision, fails.
- APP-51 is put to the user as a question with concrete options (for example default 10 / required per warehouse), one marked recommended.
- APP-55 is not re-asked: it already has an answer.
- It says each answer is posted as a reply on its ticket (naming the ticket each reply goes to counts).
- Each candidate action (at least the missing regression test from the closeout Critical and the previous retro's open contract-test action) gets its own question with options such as keep with owner and date, turn into a ticket, merge, drop or done, asked now or listed for after the interview; the closeout-derived action is not offered a drop option.
Fail if action items are written into the retro page without a per-action decision, or if APP-53 is put to the user as a question to answer or decide (a confirm-or-correct check of the evidence answer is not that).
