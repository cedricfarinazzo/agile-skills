---
type: llm
focus: last_message
weight: 1
---
The readiness score is broken down per criterion with evidence, not asserted as a bare number. Check all of:
- All seven criteria are scored individually: persona summary, falsifiable acceptance criteria, definition of done, Specs UI link, ADR reference, dependencies, and absence of a blocking unknown.
- Each scored criterion carries either a quotation of text taken from the APP-204 ticket, or an explicit N/A with a reason. For example the persona line should quote wording resembling "As a warehouse planner, I want to define reorder rules on a SKU", and the ADR line should cite ADR 4.2.
- A paraphrase or a restatement in the grader's own words does NOT count as evidence. The quoted fragment must appear in the ticket.
- A bare total such as "score 9/10, pass" with no per-criterion lines fails outright.
