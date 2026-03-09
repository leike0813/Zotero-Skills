import { assert } from "chai";
import {
  ensureDashboardToolbarButton,
  removeDashboardToolbarButton,
} from "../../src/modules/dashboardToolbarButton";

type Listener = (event: Record<string, unknown>) => void;

class FakeXULElement {
  private attrs = new Map<string, string>();
  private listeners = new Map<string, Listener[]>();
  private _id = "";

  public parentNode: FakeXULElement | null = null;
  public children: FakeXULElement[] = [];
  public style = {
    setProperty: () => undefined,
  };

  constructor(
    private readonly owner: FakeDocument,
    public readonly tagName: string,
  ) {}

  get id() {
    return this._id;
  }

  set id(value: string) {
    this._id = value;
    this.attrs.set("id", value);
    this.owner.register(this);
  }

  appendChild(child: FakeXULElement) {
    child.parentNode = this;
    this.children.push(child);
    if (child.id) {
      this.owner.register(child);
    }
    return child;
  }

  insertBefore(child: FakeXULElement, before: FakeXULElement | null) {
    if (!before) {
      return this.appendChild(child);
    }
    const idx = this.children.indexOf(before);
    if (idx < 0) {
      return this.appendChild(child);
    }
    child.parentNode = this;
    this.children.splice(idx, 0, child);
    if (child.id) {
      this.owner.register(child);
    }
    return child;
  }

  removeChild(child: FakeXULElement) {
    this.children = this.children.filter((entry) => entry !== child);
    child.parentNode = null;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
    this.owner.unregister(this.id);
  }

  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
    if (name === "id") {
      this.id = value;
    }
  }

  getAttribute(name: string) {
    return this.attrs.get(name) || null;
  }

  addEventListener(type: string, listener: Listener) {
    const existing = this.listeners.get(type) || [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  dispatch(type: string, init: Record<string, unknown> = {}) {
    const listeners = this.listeners.get(type) || [];
    const event = {
      type,
      target: this,
      ...init,
    };
    for (const listener of listeners) {
      listener(event);
    }
  }
}

class FakeDocument {
  private elements = new Map<string, FakeXULElement>();

  createXULElement(tagName: string) {
    return new FakeXULElement(this, tagName);
  }

  register(element: FakeXULElement) {
    if (element.id) {
      this.elements.set(element.id, element);
    }
  }

  unregister(id: string) {
    if (!id) {
      return;
    }
    this.elements.delete(id);
  }

  getElementById(id: string) {
    return this.elements.get(id) || null;
  }
}

describe("dashboard toolbar button", function () {
  it("adds button to top toolbar and dispatches openDashboard", async function () {
    const calls: Array<{ type: string; data: unknown }> = [];
    (globalThis as any).addon = {
      hooks: {
        onPrefsEvent: async (type: string, data: unknown) => {
          calls.push({ type, data });
        },
      },
    };

    const document = new FakeDocument();
    const host = document.createXULElement("hbox");
    host.id = "zotero-toolbar-item-tree";
    const win = {
      document,
    } as unknown as _ZoteroTypes.MainWindow;

    ensureDashboardToolbarButton(win);

    const button = host.children[0];
    assert.isOk(button);
    assert.equal(button.getAttribute("class"), "zotero-tb-button");

    button.dispatch("command");
    assert.lengthOf(calls, 1);
    assert.equal(calls[0].type, "openDashboard");
    assert.deepEqual(calls[0].data, { window: win });
  });

  it("removes existing toolbar button", function () {
    const document = new FakeDocument();
    const host = document.createXULElement("hbox");
    host.id = "zotero-toolbar-item-tree";
    const win = {
      document,
    } as unknown as _ZoteroTypes.MainWindow;

    ensureDashboardToolbarButton(win);
    assert.lengthOf(host.children, 1);

    removeDashboardToolbarButton(win);
    assert.lengthOf(host.children, 0);
  });

  it("inserts dashboard button before search anchor when present", function () {
    const document = new FakeDocument();
    const host = document.createXULElement("hbox");
    host.id = "zotero-toolbar-item-tree";
    const search = document.createXULElement("toolbarbutton");
    search.id = "zotero-tb-search";
    host.appendChild(search);
    const win = {
      document,
    } as unknown as _ZoteroTypes.MainWindow;

    ensureDashboardToolbarButton(win);

    assert.lengthOf(host.children, 2);
    assert.equal(host.children[0].id, "zotero-skills-tb-dashboard");
    assert.equal(host.children[1].id, "zotero-tb-search");
  });

  it("inserts dashboard button before nested search container", function () {
    const document = new FakeDocument();
    const host = document.createXULElement("hbox");
    host.id = "zotero-toolbar-item-tree";
    const searchWrap = document.createXULElement("hbox");
    searchWrap.id = "zotero-search-wrap";
    const search = document.createXULElement("toolbarbutton");
    search.id = "zotero-tb-search";
    searchWrap.appendChild(search);
    host.appendChild(searchWrap);
    const win = {
      document,
    } as unknown as _ZoteroTypes.MainWindow;

    ensureDashboardToolbarButton(win);

    assert.lengthOf(host.children, 2);
    assert.equal(host.children[0].id, "zotero-skills-tb-dashboard");
    assert.equal(host.children[1].id, "zotero-search-wrap");
  });

  it("prefers zotero-items-toolbar as host to avoid left-edge insertion", function () {
    const document = new FakeDocument();
    const toolbar = document.createXULElement("toolbar");
    toolbar.id = "zotero-toolbar-item-tree";
    const itemsToolbar = document.createXULElement("hbox");
    itemsToolbar.id = "zotero-items-toolbar";
    const search = document.createXULElement("toolbarbutton");
    search.id = "zotero-tb-search";
    itemsToolbar.appendChild(search);
    toolbar.appendChild(itemsToolbar);
    const win = {
      document,
    } as unknown as _ZoteroTypes.MainWindow;

    ensureDashboardToolbarButton(win);

    assert.lengthOf(toolbar.children, 1);
    assert.equal(toolbar.children[0].id, "zotero-items-toolbar");
    assert.lengthOf(itemsToolbar.children, 2);
    assert.equal(itemsToolbar.children[0].id, "zotero-skills-tb-dashboard");
    assert.equal(itemsToolbar.children[1].id, "zotero-tb-search");
  });
});
