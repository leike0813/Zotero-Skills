import { assert } from "chai";
import { config } from "../../package.json";
import { __tagManagerTestOnly } from "../../workflows/tag-manager/hooks/applyResult.js";

type ControlledEntry = {
  tag: string;
  facet: string;
  source: string;
  note: string;
  deprecated: boolean;
};

type StagedEntry = ControlledEntry & {
  createdAt?: string;
  updatedAt?: string;
  sourceFlow?: string;
};

class FakeHtmlDocument {
  public activeElement: FakeHtmlElement | null = null;

  public defaultView: {
    confirm?: (message: string) => boolean;
  } = {
    confirm: () => true,
  };

  createElementNS(_ns: string, tagName: string) {
    return new FakeHtmlElement(this, tagName.toLowerCase());
  }
}

type Listener = (event: { type: string; target: FakeHtmlElement }) => void;

class FakeHtmlElement {
  public style: Record<string, string> = {};

  public children: FakeHtmlElement[] = [];

  public parentNode: FakeHtmlElement | null = null;

  public textContent = "";

  public type = "";

  public value = "";

  public checked = false;

  public selectionStart: number | null = null;

  public selectionEnd: number | null = null;

  public scrollTop = 0;

  private listeners = new Map<string, Listener[]>();

  private attrs = new Map<string, string>();

  constructor(
    private readonly doc: FakeHtmlDocument,
    public readonly tagName: string,
  ) {}

  get firstChild() {
    return this.children[0] || null;
  }

  appendChild(child: FakeHtmlElement) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeHtmlElement) {
    this.children = this.children.filter((entry) => entry !== child);
    child.parentNode = null;
    return child;
  }

  setAttribute(name: string, value: string) {
    this.attrs.set(String(name || ""), String(value || ""));
  }

  getAttribute(name: string) {
    return this.attrs.get(String(name || "")) || null;
  }

  addEventListener(type: string, listener: Listener) {
    const existing = this.listeners.get(type) || [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  dispatch(type: string) {
    let stopped = false;
    const event = {
      type,
      target: this,
      currentTarget: this,
      stopPropagation: () => {
        stopped = true;
      },
    };
    let cursor: FakeHtmlElement | null = this;
    while (cursor) {
      const listeners = cursor.listeners.get(type) || [];
      event.currentTarget = cursor;
      for (const listener of listeners) {
        listener(event);
      }
      if (stopped) {
        break;
      }
      cursor = cursor.parentNode;
    }
  }

  click() {
    this.dispatch("click");
  }

  focus() {
    this.doc.activeElement = this;
  }

  setSelectionRange(start: number, end: number) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
}

function walkTree(root: FakeHtmlElement) {
  const nodes: FakeHtmlElement[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.shift()!;
    nodes.push(node);
    for (const child of node.children) {
      stack.push(child);
    }
  }
  return nodes;
}

function findNodeByRole(root: FakeHtmlElement, role: string) {
  return (
    walkTree(root).find((node) => node.getAttribute("data-zs-role") === role) || null
  );
}

function findNodeByRoleAndRow(
  root: FakeHtmlElement,
  role: string,
  rowIndex: number,
) {
  return (
    walkTree(root).find(
      (node) =>
        node.getAttribute("data-zs-role") === role &&
        node.getAttribute("data-zs-row-index") === String(rowIndex),
    ) || null
  );
}

const TAG_VOCAB_PREF_KEY = `${config.prefsPrefix}.tagVocabularyJson`;
const TAG_VOCAB_STAGED_PREF_KEY = `${config.prefsPrefix}.tagVocabularyStagedJson`;

function clearVocabularyPrefs() {
  Zotero.Prefs.clear(TAG_VOCAB_PREF_KEY, true);
  Zotero.Prefs.clear(TAG_VOCAB_STAGED_PREF_KEY, true);
}

function loadControlledEntries(): ControlledEntry[] {
  const raw = Zotero.Prefs.get(TAG_VOCAB_PREF_KEY, true);
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    return [];
  }
  const parsed = JSON.parse(text);
  return Array.isArray(parsed?.entries) ? parsed.entries : [];
}

function loadStagedEntries(): StagedEntry[] {
  const raw = Zotero.Prefs.get(TAG_VOCAB_STAGED_PREF_KEY, true);
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    return [];
  }
  const parsed = JSON.parse(text);
  return Array.isArray(parsed?.entries) ? parsed.entries : [];
}

function createStagedRendererHarness(entries: StagedEntry[]) {
  const doc = new FakeHtmlDocument();
  const root = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  const renderer = __tagManagerTestOnly.createStagedTagInboxRenderer();
  const state: Record<string, unknown> = {
    entries: entries.map((entry) => ({ ...entry })),
    query: "",
    actionNotice: "",
    validationIssues: [],
    facetVisibility: __tagManagerTestOnly.createInitialFacetVisibilityState(),
    facetMenuRowIndex: -1,
    filterPanelOpen: false,
    queryFocus: {
      active: false,
      start: 0,
      end: 0,
    },
    editorFocus: {
      active: false,
      rowIndex: -1,
      role: "",
      start: 0,
      end: 0,
    },
    listScrollTop: 0,
    listScrollMode: "keep",
    corrupted: false,
  };

  const host = {
    patchState: (updater: (draft: Record<string, unknown>) => void) => {
      const draft = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
      updater(draft);
      Object.assign(state, draft);
      renderer.render({ doc, root, state, host });
    },
  };

  renderer.render({ doc, root, state, host });
  return {
    doc,
    root,
    state,
  };
}

describe("workflow: tag-manager staged inbox", function () {
  beforeEach(function () {
    clearVocabularyPrefs();
  });

  afterEach(function () {
    clearVocabularyPrefs();
  });

  it("persists staged entries independently from controlled vocabulary", function () {
    __tagManagerTestOnly.persistEntries([
      {
        tag: "topic:controlled",
        facet: "topic",
        source: "manual",
        note: "controlled",
        deprecated: false,
      },
    ]);
    __tagManagerTestOnly.persistStagedEntries([
      {
        tag: "topic:staged",
        facet: "topic",
        source: "agent-suggest",
        note: "staged",
        deprecated: false,
      },
    ]);

    const controlled = loadControlledEntries();
    const staged = loadStagedEntries();

    assert.lengthOf(controlled, 1);
    assert.equal(controlled[0].tag, "topic:controlled");
    assert.lengthOf(staged, 1);
    assert.equal(staged[0].tag, "topic:staged");
    assert.equal(staged[0].sourceFlow, "manual-staged");
    assert.match(String(staged[0].createdAt || ""), /^\d{4}-\d{2}-\d{2}T/);
    assert.match(String(staged[0].updatedAt || ""), /^\d{4}-\d{2}-\d{2}T/);
  });

  it("promotes a valid staged entry into controlled vocabulary and removes it from staged", function () {
    __tagManagerTestOnly.persistEntries([
      {
        tag: "topic:existing",
        facet: "topic",
        source: "manual",
        note: "existing",
        deprecated: false,
      },
    ]);
    __tagManagerTestOnly.persistStagedEntries([
      {
        tag: "field:CE/UG",
        facet: "field",
        source: "agent-suggest",
        note: "staged",
        deprecated: false,
      },
    ]);

    const harness = createStagedRendererHarness(loadStagedEntries());
    const joinBtn = findNodeByRoleAndRow(harness.root, "staged-accept-btn", 0);
    assert.isOk(joinBtn);
    joinBtn!.click();

    const controlledTags = loadControlledEntries()
      .map((entry) => entry.tag)
      .sort();
    const stagedTags = loadStagedEntries().map((entry) => entry.tag);
    assert.deepEqual(controlledTags, ["field:CE/UG", "topic:existing"]);
    assert.deepEqual(stagedTags, []);
  });

  it("keeps staged entry when promotion fails validation", function () {
    __tagManagerTestOnly.persistEntries([
      {
        tag: "topic:dup",
        facet: "topic",
        source: "manual",
        note: "existing",
        deprecated: false,
      },
    ]);
    __tagManagerTestOnly.persistStagedEntries([
      {
        tag: "topic:dup",
        facet: "topic",
        source: "agent-suggest",
        note: "duplicate",
        deprecated: false,
      },
    ]);

    const harness = createStagedRendererHarness(loadStagedEntries());
    const joinBtn = findNodeByRoleAndRow(harness.root, "staged-accept-btn", 0);
    assert.isOk(joinBtn);
    joinBtn!.click();

    const controlledTags = loadControlledEntries().map((entry) => entry.tag);
    const stagedTags = loadStagedEntries().map((entry) => entry.tag);
    assert.deepEqual(controlledTags, ["topic:dup"]);
    assert.deepEqual(stagedTags, ["topic:dup"]);
    assert.isAtLeast(
      Array.isArray(harness.state.validationIssues)
        ? harness.state.validationIssues.length
        : 0,
      1,
    );
  });

  it("supports immediate discard and clear-all actions", function () {
    __tagManagerTestOnly.persistStagedEntries([
      {
        tag: "topic:a",
        facet: "topic",
        source: "agent-suggest",
        note: "a",
        deprecated: false,
      },
      {
        tag: "topic:b",
        facet: "topic",
        source: "agent-suggest",
        note: "b",
        deprecated: false,
      },
    ]);

    const harness = createStagedRendererHarness(loadStagedEntries());
    const discardBtn = findNodeByRoleAndRow(harness.root, "staged-discard-btn", 0);
    assert.isOk(discardBtn);
    discardBtn!.click();
    assert.deepEqual(loadStagedEntries().map((entry) => entry.tag), ["topic:b"]);

    const clearBtn = findNodeByRole(harness.root, "staged-clear-btn");
    assert.isOk(clearBtn);
    clearBtn!.click();
    assert.deepEqual(loadStagedEntries(), []);
  });

  it("persists staged edits immediately without save action", function () {
    __tagManagerTestOnly.persistStagedEntries([
      {
        tag: "topic:old-value",
        facet: "topic",
        source: "agent-suggest",
        note: "old note",
        deprecated: false,
      },
    ]);

    const harness = createStagedRendererHarness(loadStagedEntries());
    const tagInput = findNodeByRoleAndRow(harness.root, "staged-tag-suffix-input", 0);
    assert.isOk(tagInput);
    tagInput!.value = "new-value";
    tagInput!.dispatch("input");

    const noteInput = findNodeByRoleAndRow(harness.root, "staged-note-input", 0);
    assert.isOk(noteInput);
    noteInput!.value = "updated note";
    noteInput!.dispatch("input");

    const after = loadStagedEntries();
    assert.lengthOf(after, 1);
    assert.equal(after[0].tag, "topic:new-value");
    assert.equal(after[0].note, "updated note");
  });
});
