# agile-mods: decisions and gotchas

Read before changing a guard (this folder, `../tests/`, `../docs/`). The root `CLAUDE.md` covers the engine limits and the mirror rule (a guard mirrors a skill's prose: change both in one commit). The exact rules users see are in `../docs/reference.md`; keep it in step with the code.

## Locked decisions

Don't reopen these without the maintainer.

**Trust**
- A guard never takes the model's word. It checks GitHub, git and the engine at the moment of the call. A receipt, a banner or a report line never turns a guard on, off or green.
- A gate that cannot read its source refuses. When the hook throws, guarded calls are refused (the `.catch` on `tool.call`).

**Review credit** (`hooks/state/review.ts`, `guardsAfter`)
- A read counts only when its output holds git's own text: `host.show` for a file, the guard's own `git diff --no-ext-diff --no-textconv --text -M` for a diff (`showedFile`, `showedDiff`). Never credit from the command text alone: `exec >/dev/null`, a `git` shell function, an external diff or textconv, and `-diff` attributes all produce a command that looks right.
- Who reviews:
  - `pr-reviewer`;
  - `merge-session`;
  - the main loop once an `agile-11-merge-train` Skill call has *run* (set in `guardsAfter`);
  - an inline `merge-review-pr`, likewise only once its call ran.
- The build side never reviews: `agile-execution` agents, `build-session`, and the main loop after `agile-10-implement`.
- What credits reads waits for the call to run; what withholds credit applies at once.
- Each read in a `;` / `&&` chain counts on its own. None count:
  - after `||`;
  - after `&&` behind a command not known to succeed;
  - on a line with a heredoc, a `$'…'` quote, a `#` comment, a backgrounded command or a failed `cd`.
  - after a command that reshapes the shell (`set -e`, `exec`, `trap`, `alias`, `eval`, `source`, a function definition).
- When a parser differential is suspected, test it against real bash: stub `git(){ echo SHOWN:$2; }` and compare which shows ran with what `parseReads` credits.
- A `cd` or a sha variable is followed only when it surely ran.
- A path must be written from the repo root: `./` and `../` are refused. A quoted spec and `[ ]` in a path are read as git gets them.
- Coverage of a file at the head:

  | How | Rule |
  |---|---|
  | `full` | Read in full at the head |
  | `ranges` | Line ranges at the head that cover every line |
  | `carried` | Read at an ancestor, and the file is identical in both trees |
  | `delta` | A verified diff from a sha where the file counts, whatever the history between them. Diffs chain |

- GitHub's compare (the fallback when local git can't answer) answers nothing at 300 files or more.
- Chunks are sized by characters (25,000), not lines. A read that does not count gets a one-line note in that tool result (`context`), with the chunk plan.

**Fix rounds**
- A round starts with a push onto a reviewed head from which no round has started yet. Pushes onto unreviewed heads continue the round, so a fresh agent after a CI wait adds none.
- These are never a round:
  - a 3a update (merges and base commits only);
  - a push that restores this PR's own tree (its live head, a round's head, or a reviewed ancestor), sent in its own command;
  - a delete.
- Mutation checks stay local, never pushed (`agile-11-merge-train` Rules).

**Settings** (`hooks/state/config.ts`)
- One `userConfig` mode per gate: `enforce`, `warn` or `off`.
  - `guardPush` has no `off`.
  - `warn` means a toast and a Guards-tab entry; the model is not told.
  - `off` reads nothing.
- A repo's `CLAUDE.md` / `AGENTS.md` can only tighten a setting, and is read once at session start, because the loop can edit those files. `fixRounds` is floored before it is compared, and 0 from a repo is refused.

**Bypass** (`hooks/state/bypass.ts`)
- Only a person grants one: the pane button, or `/agile-board allow <id>` with origin `composer` or `bridge`. `/agile-board reset` is person-only too.
- Only the 3f gates, the fix cap and the budget can be bypassed. Push, grant and side-door changes go through config only.
- Refusals carry ids that are never reused, and the button and the command name that id, never a position in the list.
- A merge bypass covers one PR at one head, for 30 minutes, and never waives the pin: the merge must pin the allowed head. No head known means no offer.
- A fix bypass is one round, for 30 minutes.
- A budget bypass covers calls naming that one ticket until it is done, parked or merged. A ticketless one lasts until the next merge.
- `allowBypass: false` ignores stored bypasses.
- Every refusal that offers a bypass ends by telling the loop to report blocked and wait, never to hand the command to the person.

**Docs**
- `docs/*.md` are user pages; exact rules and the command disclosure live in `docs/reference.md`.
- The pictures in `docs/img/` are drawn from the views: rerun `bun docs/img/generate.ts` after a view changes.

## Gotchas

**Code**
- **TDZ:** a module-level helper named like a local later in the same function throws `Cannot access … before initialization`. That happened with `live` versus `const live = await host.prView(…)`.
- **Memo keys:** `howRead` memoises per `Know` *and* per state object. `coverageOf` must build one state object for all files, or the memo is lost.
- **Store eviction:** `capShas` evicts by insertion order; re-insert a key you update.

**Engine test kit** (`claude plugin test`)
- `$.command.run` carries no `origin`, so a person-only command (`allow <id>`, `reset`) is refused in engine tests.
- Test a grant through the pane instead:
  1. `ui.mount` the Pane;
  2. `ui.press({ key: 'tab-guards' })`;
  3. `ui.find({ type: 'Button', text: /Allow once/ })` (the query field is `type`, not `tag`);
  4. press its `key`.

  A `Button` needs an explicit `key` prop to be pressable.
- The stub tool answers `ok`. A test whose read must count stubs `git -C /repo show …` with the same text (`stdout: 'ok\n'`).
- `tool.call` results may carry `context` (notes only the model reads); that is how read notes reach the reviewer.
- No local typecheck: `bunx tsc` finds no tsconfig. Point one at the `/plugin-types` declarations if you need it.

**Unit tests**
- `fakeHost.show` defaults to an empty file, which counts against any output. `diffText` defaults to `diffOf(changes)`. A test that reads a diff passes `diffOf([...])` as the output.
- A JS default parameter applies when `undefined` is passed: `read(host, cmd, undefined)` reads as the default reviewer. Call `guardsAfter` directly for the main loop.

**Docs and pictures**
- Browsers drop a `<text>` element's leading spaces even with `xml:space="preserve"`. The generator moves `x` instead.
- Some glyphs (`⏸`, `⏳`) are missing from common monospace fonts; the generator swaps them.
- Check a picture with headless Chrome:

  ```sh
  google-chrome --headless=new --screenshot=out.png file://…/x.svg
  ```

- Check Mermaid with `npx @mermaid-js/mermaid-cli` and `-p` set to a puppeteer config pointing at the system Chrome.

**Out of scope, on purpose**
- A merge commit that carries real changes passes as a 3a update (`rev-list --no-merges`), so it takes no fix round.
