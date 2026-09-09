import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// A verifier that reached no verdict is a THIRD state: the round did not fail,
// so the Review tab must not draw the red cross that made the board contradict
// the pull-request body on the same screen. `verifierRows` already decides the
// state and verifierRows.test.mjs pins that decision. What was unpinned is the
// rest of the chain — the drawer reading the flag, choosing the informational
// icon, and the stylesheet giving `.unmet-item.advisory` a colour distinct from
// failure. Reverting any one of those three restored the red cross with the
// whole web suite still green, so each link is read here from ITS OWN SOURCE.
//
// This harness has no DOM renderer (no jsdom, no react-dom/server), so these
// are source-text assertions, as 66 of the 142 web tests are. That buys the
// wiring, not the pixels: a semantically equivalent rewrite of the JSX would
// break these tests without breaking the board, and a change confined to the
// colour VALUE would break the board without breaking these tests. The colour
// assertion below therefore pins the token, which is what the design system
// makes meaningful, rather than merely the presence of a `color:` property.

const SRC = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(SRC, p), "utf8");
const flat = (s) => s.replace(/\s+/g, " ");

const slideOver = flat(read("SlideOver.jsx"));
const css = read("styles.css");

test("the drawer gives the advisory row its own class, not the failure class", () => {
  assert.match(
    slideOver,
    /className=\{`unmet-item \$\{r\.ok \? "pass" : r\.advisory \? "advisory" : "fail"\}`\}/,
    "SlideOver.jsx must branch the <li> class on r.advisory before falling back to fail",
  );
  assert.match(
    slideOver,
    /className=\{`ci-icon \$\{r\.ok \? "" : r\.advisory \? "advisory" : "fail"\}`\}/,
    "the icon wrapper must branch on r.advisory too",
  );
});

test("the advisory row gets the informational icon, never the red cross", () => {
  assert.match(
    slideOver,
    /r\.advisory \? <IconInfo size=\{12\} \/> : <IconX size=\{12\} \/>/,
    "SlideOver.jsx must render IconInfo for an advisory verifier and IconX only for a real failure",
  );
});

test("the advisory colour is the dim token, never the failure red", () => {
  const rule = css.match(/\.unmet-item\.advisory[^{]*\{([^}]*)\}/);
  assert.ok(rule, "styles.css must define .unmet-item.advisory — without it the row inherits failure red");
  assert.match(
    rule[1],
    /color:\s*var\(--text-dim\)/,
    `the advisory row must use the dim token, not a failure colour; found: ${rule[1].trim()}`,
  );
  assert.doesNotMatch(rule[1], /var\(--red/, "an advisory row must never be painted with a red token");
  assert.match(css, /\.ci-icon\.advisory[^{]*\{[^}]*color:/, "…and the icon likewise");
});
