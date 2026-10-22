// Checks the component data block og-meta embeds in component pages can't be
// broken out of by component text, and parses back to the same value.
// Run with: node --test tests/*.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "parse5";
import {
  injectComponentData,
  serializeJsonForScript,
} from "../netlify/edge-functions/og-meta.ts";

const nasty = [
  "</script><script>alert(1)</script>",
  "</SCRIPT >",
  "<!-- <script>",
  "a\u2028b\u2029c",
  "Tom & Jerry > Itchy < Scratchy",
  '"quotes" and \\backslashes\\ and \u0000 nul',
  "emoji 🚀 and \ud800 lone surrogate",
];

type Node = {
  nodeName: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: Node[];
  value?: string;
};

function findById(node: Node, id: string): Node | undefined {
  if (node.attrs?.some((a) => a.name === "id" && a.value === id)) return node;
  for (const child of node.childNodes ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return undefined;
}

test("escaped JSON has no characters the HTML parser treats specially", () => {
  const out = serializeJsonForScript({ slug: "x", value: { text: nasty } });
  assert.ok(!/[<>&\u2028\u2029]/.test(out));
});

test("an HTML parser sees one script block that round-trips", () => {
  const value = {
    slug: "workpool",
    value: {
      name: nasty[0],
      longDescription: nasty.join("\n\n"),
      seoFaq: nasty.map((q) => ({ question: q, answer: q })),
      weeklyDownloads: 1234.5,
    },
  };
  const html = `<!doctype html><html><head></head><body><div id="root"></div><script type="application/json" id="component-data">${serializeJsonForScript(value)}</script>\n<p id="after">after</p></body></html>`;
  const doc = parse(html) as unknown as Node;

  const block = findById(doc, "component-data");
  assert.ok(block);
  const text = (block.childNodes ?? []).map((n) => n.value ?? "").join("");
  assert.deepEqual(JSON.parse(text), value);

  // Nothing leaked out of the block: the element after it is still there and
  // no extra script elements were created
  assert.ok(findById(doc, "after"));
  let scripts = 0;
  const count = (node: Node) => {
    if (node.nodeName === "script") scripts++;
    (node.childNodes ?? []).forEach(count);
  };
  count(doc);
  assert.equal(scripts, 1);
});

test("replacement patterns in component text stay literal", () => {
  // String.replace expands these in a replacement string, which would paste
  // parts of the page (including its inline scripts) into the JSON
  const value = { name: "a $` b $' c $& d $$ e" };
  const html = `<!doctype html><html><head><script>x()</script></head><body><div id="root"></div></body></html>`;
  const out = injectComponentData(html, "workpool", value);
  const doc = parse(out) as unknown as Node;
  const block = findById(doc, "component-data");
  assert.ok(block);
  const text = (block.childNodes ?? []).map((n) => n.value ?? "").join("");
  assert.deepEqual(JSON.parse(text), { slug: "workpool", value });
  assert.equal(out.split("x()").length, 2);
});
