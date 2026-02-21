import { assert } from "chai";
import { __tagManagerTestOnly } from "../../workflows/tag-manager/hooks/applyResult.js";

type TagEntry = {
  tag: string;
  facet: string;
  source: string;
  note: string;
  deprecated: boolean;
};

type Listener = (event: { type: string; target: FakeHtmlElement }) => void;

const FACETS = [
  "field",
  "topic",
  "method",
  "model",
  "ai_task",
  "data",
  "tool",
  "status",
];

class FakeBlob {
  public parts: unknown[];

  public type: string;

  constructor(parts: unknown[], options?: { type?: string }) {
    this.parts = parts;
    this.type = String(options?.type || "");
  }
}

class FakeHtmlDocument {
  public activeElement: FakeHtmlElement | null = null;

  public clipboardWrites: string[] = [];

  public anchorClicks: Array<{ href: string; download: string }> = [];

  public createdObjectUrls: string[] = [];

  public revokedObjectUrls: string[] = [];

  public defaultView: {
    Blob: typeof FakeBlob;
    URL: {
      createObjectURL: (blob: unknown) => string;
      revokeObjectURL: (url: string) => void;
    };
    navigator: {
      clipboard: {
        writeText: (text: string) => Promise<void>;
      };
    };
    setTimeout: (fn: () => void, delay: number) => number;
  };

  constructor() {
    this.defaultView = {
      Blob: FakeBlob,
      URL: {
        createObjectURL: () => {
          const url = `blob:test-${this.createdObjectUrls.length + 1}`;
          this.createdObjectUrls.push(url);
          return url;
        },
        revokeObjectURL: (url: string) => {
          this.revokedObjectUrls.push(url);
        },
      },
      navigator: {
        clipboard: {
          writeText: async (text: string) => {
            this.clipboardWrites.push(String(text || ""));
          },
        },
      },
      setTimeout: (fn: () => void, _delay: number) => {
        fn();
        return 1;
      },
    };
  }

  createElementNS(_ns: string, tagName: string) {
    return new FakeHtmlElement(this, tagName.toLowerCase());
  }
}

class FakeHtmlElement {
  public style: Record<string, string> = {};

  public children: FakeHtmlElement[] = [];

  public parentNode: FakeHtmlElement | null = null;

  public textContent = "";

  public type = "";

  public value = "";

  public checked = false;

  public readOnly = false;

  public placeholder = "";

  public accept = "";

  public href = "";

  public download = "";

  public files: Array<{ text?: () => Promise<string> }> | null = null;

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
    if (this.tagName === "a") {
      this.doc.anchorClicks.push({
        href: String(this.href || ""),
        download: String(this.download || ""),
      });
    }
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

function findFirstNode(root: FakeHtmlElement, matcher: (node: FakeHtmlElement) => boolean) {
  return walkTree(root).find(matcher) || null;
}

function findNodes(root: FakeHtmlElement, matcher: (node: FakeHtmlElement) => boolean) {
  return walkTree(root).filter(matcher);
}

function findNodeByRole(root: FakeHtmlElement, role: string) {
  return findFirstNode(
    root,
    (node) => node.getAttribute("data-zs-role") === role,
  );
}

function findNodesByRole(root: FakeHtmlElement, role: string) {
  return findNodes(root, (node) => node.getAttribute("data-zs-role") === role);
}

function findButtonByText(root: FakeHtmlElement, text: string) {
  return findFirstNode(
    root,
    (node) => node.tagName === "button" && String(node.textContent || "").trim() === text,
  );
}

function createFacetVisibilityDefaultAll() {
  const state: Record<string, boolean> = {};
  for (const facet of FACETS) {
    state[facet] = true;
  }
  return state;
}

function createRendererHarness(entries: TagEntry[]) {
  const doc = new FakeHtmlDocument();
  const root = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  const renderer = __tagManagerTestOnly.createTagManagerRenderer();
  const initialFacetVisibility =
    typeof __tagManagerTestOnly.createInitialFacetVisibilityState === "function"
      ? __tagManagerTestOnly.createInitialFacetVisibilityState()
      : createFacetVisibilityDefaultAll();
  const state: Record<string, unknown> = {
    entries: entries.map((entry) => ({ ...entry })),
    query: "",
    exportText: "",
    exportNotice: "",
    validationIssues: [],
    importOnDuplicate: "skip",
    importDryRun: false,
    importReport: null,
    facetVisibility: initialFacetVisibility,
    onDuplicateMenuOpen: false,
    facetMenuRowIndex: -1,
    filterPanelOpen: false,
    queryFocus: {
      active: false,
      start: 0,
      end: 0,
    },
    listScrollTop: 0,
    listScrollMode: "keep",
    editorFocus: {
      active: false,
      rowIndex: -1,
      role: "",
      start: 0,
      end: 0,
    },
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
    host,
    rerender: () => renderer.render({ doc, root, state, host }),
  };
}

describe("workflow: tag-manager panel usability", function () {
  const sampleEntries: TagEntry[] = [
    {
      tag: "topic:alpha",
      facet: "topic",
      source: "manual",
      note: "alpha",
      deprecated: false,
    },
    {
      tag: "topic:beta",
      facet: "topic",
      source: "import",
      note: "beta",
      deprecated: false,
    },
    {
      tag: "field:CE/UG",
      facet: "field",
      source: "manual",
      note: "field",
      deprecated: false,
    },
  ];

  it("builds deterministic export text and excludes deprecated tags", function () {
    const text = __tagManagerTestOnly.buildExportText([
      {
        tag: "topic:deprecated",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: true,
      },
      ...sampleEntries,
    ]);
    assert.equal(text, ["field:CE/UG", "topic:alpha", "topic:beta"].join("\n"));
  });

  it("defaults facet filter to all-enabled and renders all rows", function () {
    const harness = createRendererHarness(sampleEntries);
    const rows = findNodesByRole(harness.root, "tag-row");
    assert.lengthOf(rows, 3);

    const filterBtn = findButtonByText(harness.root, "Filter");
    assert.isOk(filterBtn);
    filterBtn!.click();

    const toggles = findNodesByRole(harness.root, "facet-visibility-toggle");
    assert.equal(toggles.length, FACETS.length);
    for (const toggle of toggles) {
      assert.equal(toggle.checked, true);
    }
  });

  it("applies facet visibility filtering instantly without action buttons", function () {
    const harness = createRendererHarness(sampleEntries);
    const filterBtn = findButtonByText(harness.root, "Filter");
    assert.isOk(filterBtn);
    filterBtn!.click();

    const topicToggle = findFirstNode(
      harness.root,
      (node) =>
        node.getAttribute("data-zs-role") === "facet-visibility-toggle" &&
        node.getAttribute("data-zs-facet") === "topic",
    );
    assert.isOk(topicToggle);
    topicToggle!.checked = false;
    topicToggle!.dispatch("change");

    const rowsAfter = findNodesByRole(harness.root, "tag-row");
    assert.lengthOf(rowsAfter, 1);
    const onlyTagInput = findFirstNode(
      rowsAfter[0],
      (node) => node.getAttribute("data-zs-role") === "tag-suffix-input",
    );
    assert.isOk(onlyTagInput);
    assert.equal(onlyTagInput!.value, "CE/UG");

    const popup = findNodeByRole(harness.root, "facet-filter-popup");
    assert.isOk(popup);
    assert.isNotOk(findButtonByText(popup!, "Clear"));
    assert.isNotOk(findButtonByText(popup!, "Apply"));
    assert.isNotOk(findButtonByText(popup!, "Delete"));
  });

  it("closes filter popup by outside click and filter button toggle", function () {
    const harness = createRendererHarness(sampleEntries);
    const filterBtn = findButtonByText(harness.root, "Filter");
    assert.isOk(filterBtn);
    filterBtn!.click();
    assert.isOk(findNodeByRole(harness.root, "facet-filter-popup"));

    const overlay = findNodeByRole(harness.root, "facet-filter-overlay");
    assert.isOk(overlay);
    overlay!.click();
    assert.isNotOk(findNodeByRole(harness.root, "facet-filter-popup"));

    filterBtn!.click();
    assert.isOk(findNodeByRole(harness.root, "facet-filter-popup"));
    filterBtn!.click();
    assert.isNotOk(findNodeByRole(harness.root, "facet-filter-popup"));
  });

  it("keeps search input focused and preserves list scroll position during edits", function () {
    const harness = createRendererHarness(sampleEntries);

    const queryInput = findFirstNode(
      harness.root,
      (node) => node.tagName === "input" && node.type === "search",
    );
    assert.isOk(queryInput);
    queryInput!.focus();
    queryInput!.value = "alpha";
    queryInput!.selectionStart = 5;
    queryInput!.selectionEnd = 5;
    queryInput!.dispatch("input");

    const queryAfterInput = findFirstNode(
      harness.root,
      (node) => node.tagName === "input" && node.type === "search",
    );
    assert.equal(harness.doc.activeElement, queryAfterInput);
    assert.equal(queryAfterInput!.value, "alpha");

    const listBefore = findNodeByRole(harness.root, "tag-table-scroll");
    assert.isOk(listBefore);
    listBefore!.scrollTop = 180;

    const noteInput = findFirstNode(
      harness.root,
      (node) =>
        node.getAttribute("data-zs-role") === "note-input" &&
        node.getAttribute("data-zs-row-index") === "0",
    );
    assert.isOk(noteInput);
    noteInput!.value = "alpha updated";
    noteInput!.dispatch("input");

    const listAfter = findNodeByRole(harness.root, "tag-table-scroll");
    assert.isOk(listAfter);
    assert.equal(listAfter!.scrollTop, 180);
  });

  it("preserves list scroll position after Validate and Export actions", function () {
    const harness = createRendererHarness(sampleEntries);
    const list = findNodeByRole(harness.root, "tag-table-scroll");
    assert.isOk(list);
    list!.scrollTop = 160;

    const validateBtn = findButtonByText(harness.root, "Validate");
    assert.isOk(validateBtn);
    validateBtn!.click();
    const afterValidate = findNodeByRole(harness.root, "tag-table-scroll");
    assert.equal(afterValidate!.scrollTop, 160);

    afterValidate!.scrollTop = 140;
    const exportBtn = findButtonByText(harness.root, "Export");
    assert.isOk(exportBtn);
    exportBtn!.click();
    const afterExport = findNodeByRole(harness.root, "tag-table-scroll");
    assert.equal(afterExport!.scrollTop, 140);
  });

  it("keeps tag input focused while typing", function () {
    const harness = createRendererHarness(sampleEntries);
    const firstTagInput = findFirstNode(
      harness.root,
      (node) =>
        node.getAttribute("data-zs-role") === "tag-suffix-input" &&
        node.getAttribute("data-zs-row-index") === "0",
    );
    assert.isOk(firstTagInput);
    firstTagInput!.focus();
    firstTagInput!.value = "alph";
    firstTagInput!.selectionStart = 4;
    firstTagInput!.selectionEnd = 4;
    firstTagInput!.dispatch("input");

    const latestTagInput = findFirstNode(
      harness.root,
      (node) =>
        node.getAttribute("data-zs-role") === "tag-suffix-input" &&
        node.getAttribute("data-zs-row-index") === "0",
    );
    assert.isOk(latestTagInput);
    assert.equal(harness.doc.activeElement, latestTagInput);
    assert.equal(latestTagInput!.value, "alph");
  });

  it("renders facet-first columns and supports facet dropdown + tag recomposition", function () {
    const harness = createRendererHarness(sampleEntries);
    const header = findNodeByRole(harness.root, "tag-table-header");
    assert.isOk(header);
    assert.equal(header!.style.position, "sticky");
    assert.equal(
      header!.children.map((cell) => String(cell.textContent || "").trim()).join("|"),
      "Facet|Tag|Source|Note|Deprecated|Delete",
    );

    const firstRow = findNodesByRole(harness.root, "tag-row")[0];
    const facetSelect = findFirstNode(
      firstRow,
      (node) => node.getAttribute("data-zs-role") === "facet-select",
    );
    assert.isOk(facetSelect);
    assert.isAtLeast(facetSelect!.children.length, 2);
    assert.equal(String(facetSelect!.children[0].textContent || ""), "topic");
    assert.equal(String(facetSelect!.children[1].textContent || ""), "▾");

    const tagSuffixInput = findFirstNode(
      firstRow,
      (node) => node.getAttribute("data-zs-role") === "tag-suffix-input",
    );
    assert.isOk(tagSuffixInput);
    assert.equal(tagSuffixInput!.value, "alpha");

    const facetHint = findFirstNode(
      firstRow,
      (node) => node.getAttribute("data-zs-role") === "facet-display-prefix",
    );
    assert.isOk(facetHint);
    assert.equal(facetHint!.textContent, ":");

    facetSelect!.dispatch("click");
    const firstRowAfterOpen = findNodesByRole(harness.root, "tag-row")[0];
    const facetMenuBtn = findFirstNode(
      firstRowAfterOpen,
      (node) => node.tagName === "button" && String(node.textContent || "").trim() === "model",
    );
    assert.isOk(facetMenuBtn);
    facetMenuBtn!.dispatch("click");
    assert.equal((harness.state.entries as TagEntry[])[0].facet, "model");
    assert.equal((harness.state.entries as TagEntry[])[0].tag, "model:alpha");
  });

  it("locks source column and normalizes Add-created row source to manual", function () {
    const harness = createRendererHarness(sampleEntries);

    const sourceInputs = findNodes(
      harness.root,
      (node) => node.getAttribute("data-zs-role") === "source-input",
    );
    assert.lengthOf(sourceInputs, 0);

    const sourceReadonlyNodes = findNodesByRole(harness.root, "source-readonly");
    assert.isAtLeast(sourceReadonlyNodes.length, 1);

    const addBtn = findButtonByText(harness.root, "Add");
    assert.isOk(addBtn);
    addBtn!.click();

    const entries = harness.state.entries as TagEntry[];
    const added = entries[entries.length - 1];
    assert.equal(added.facet, "topic");
    assert.match(added.tag, /^topic:/);
    assert.equal(added.source, "manual");
  });

  it("scrolls to bottom after Add", function () {
    const harness = createRendererHarness(sampleEntries);
    const listBefore = findNodeByRole(harness.root, "tag-table-scroll");
    assert.isOk(listBefore);
    listBefore!.scrollTop = 20;

    const addBtn = findButtonByText(harness.root, "Add");
    assert.isOk(addBtn);
    addBtn!.click();

    const listAfter = findNodeByRole(harness.root, "tag-table-scroll");
    assert.isOk(listAfter);
    assert.isAbove(listAfter!.scrollTop, 20);
  });

  it("groups import controls and updates on-duplicate state reliably", function () {
    const harness = createRendererHarness(sampleEntries);
    const mainActions = findNodeByRole(harness.root, "main-actions-group");
    const importActions = findNodeByRole(harness.root, "import-controls-group");
    assert.isOk(mainActions);
    assert.isOk(importActions);

    const dryRunLabel = findFirstNode(
      importActions!,
      (node) => node.tagName === "label",
    );
    assert.isOk(dryRunLabel);
    assert.equal(dryRunLabel!.children[0].tagName, "span");
    assert.equal(String(dryRunLabel!.children[0].textContent || "").trim(), "Dry Run");
    assert.equal(dryRunLabel!.children[1].tagName, "input");

    const duplicateLabel = findFirstNode(
      importActions!,
      (node) =>
        node.getAttribute("data-zs-role") === "on-duplicate-label" &&
        String(node.textContent || "").trim() === "On Duplicate:",
    );
    assert.isOk(duplicateLabel);

    const selector = findNodeByRole(importActions!, "on-duplicate-select");
    assert.isOk(selector);
    selector!.dispatch("click");
    const importActionsAfterOpen = findNodeByRole(harness.root, "import-controls-group");
    const overwriteOption = findFirstNode(
      importActionsAfterOpen!,
      (node) => node.tagName === "button" && String(node.textContent || "").trim() === "Overwrite",
    );
    assert.isOk(overwriteOption);
    overwriteOption!.dispatch("click");
    assert.equal(harness.state.importOnDuplicate, "overwrite");
  });

  it("does not render txt download action in export panel", function () {
    const harness = createRendererHarness(sampleEntries);
    const exportBtn = findButtonByText(harness.root, "Export");
    assert.isOk(exportBtn);
    exportBtn!.click();
    assert.isNotOk(findButtonByText(harness.root, "Download .txt"));
  });
});
