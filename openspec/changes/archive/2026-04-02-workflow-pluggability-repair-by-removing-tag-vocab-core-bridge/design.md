## Design

This change uses the conservative option: duplicate the small tag-vocabulary helper logic inside each workflow instead of introducing a new shared business module.

### Core boundary

Plugin core may expose only generic runtime host capabilities:

- `showToast`
- `appendRuntimeLog`

It must not expose:

- active committed vocabulary resolution
- staged bindings logic
- GitHub subscribe/publish semantics
- tag-manager / tag-regulator specific state operations

### Workflow boundary

`tag-manager` and `tag-regulator` each own their tag-vocabulary domain logic:

- mode resolution
- committed/staged prefs handling
- subscription-mode publish behavior
- parent binding reconciliation

No builtin workflow may import another builtin workflow or a shared sibling directory.

### Compatibility

Builtin workflow hooks must remain compatible with the loader fallback path. Avoiding cross-file hook imports removes the current failure mode where fallback text loading cannot safely evaluate top-level `import`.
