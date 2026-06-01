# Connection Form Demo - Schema-Driven Form in Isolation

<!-- docuserve:example-launch:start -->
> **[Launch the live app](examples/connection%5Fform%5Fdemo/index.html)** - runs in your browser, opens in a new tab.
<!-- docuserve:example-launch:end -->

A standalone interactive showcase for `pict-section-connection-form`.
It renders the view against a hardcoded set of provider schemas (no
server needed), then exposes buttons that exercise every public method
on the view: `getProviderConfig()`, `setValues(provider, configBlob)`,
and `clear()`. The output of `getProviderConfig()` streams live into a
pretty-printed `<pre>` so you can see the canonical wire-format payload
the view emits as you toggle fields.

Five provider schemas ship with the demo - SQLite, MySQL, PostgreSQL,
MSSQL, and Solr. The MSSQL schema is intentionally rich; it exercises
every advanced feature of the schema contract (`Multiplier` for sec->ms
unit conversion, `MapTo` for one-input-many-targets retry config,
`OmitIfFalsy` so unset fields drop out, plus a `Boolean` toggle that
isn't in the basic field types). Pick MSSQL, expand **Advanced**, edit
the retry timing, click **Read config** - the JSON output tells you the
whole story.

## What it demonstrates

| Capability | Where you see it |
|------------|------------------|
| Standalone host wiring | `addView('PictSection-ConnectionForm', { ContainerSelector: '#demo-form-slot', ... })` registers the form against a div the layout view owns |
| Schema injection lifecycle | `setSchemas(DEMO_SCHEMAS)` called from the layout's `onAfterRender` - schemas can arrive after the host renders |
| Provider `<select>` rendering | `ShowProviderSelect: true` (default) - five providers in the dropdown, swap them and the field block changes |
| Schema-driven field types | SQLite has `Path`, MySQL/PostgreSQL have `String`/`Number`/`Password`, MSSQL adds `Boolean`, Solr has another `Boolean` for HTTPS |
| Required / Min / Max / Placeholder hints | Every field's `Required: true` becomes `required`, `Min`/`Max` becomes the `<input>` attributes, `Placeholder` populates the input placeholder |
| Advanced `<details>` group | MySQL's `connectionLimit` and MSSQL's `RequestTimeoutMs` / `RetryInitialDelaySec` carry `Group: 'Advanced'` - the view stacks them under a collapsible `<details>` |
| `Multiplier` (sec <-> ms) | MSSQL's `RequestTimeoutMs` has `Multiplier: 1000` - input shows seconds, emitted config has milliseconds |
| `MapTo` (one input, many keys) | MSSQL's `RetryInitialDelaySec` has `MapTo: [ 'ConnectRetryOptions.InitialDelayMs', 'DDLRetryOptions.InitialDelayMs' ]` - one input populates both nested paths |
| `OmitIfFalsy` | Set MSSQL's `RequestTimeoutMs` to 0, click **Read config** - the key vanishes from the payload entirely |
| `OnProviderChange` callback | Layout-view supplies a callback that pipes provider changes into the status line |
| Round-tripping saved configs | **Set MSSQL example** writes `RequestTimeoutMs: 90000` into the form; the input renders 90 (sec) because `Multiplier` is reverse-applied on display |

## Key files

- `source/Pict-Application-ConnectionFormDemo.js` - the application
  wiring. Reads top-to-bottom: layout view, then the connection-form
  view with host overrides; `onAfterInitializeAsync` stashes the
  schema fixture in AppData and renders the layout. The `DEMO_SCHEMAS`
  constant inline is the entire schema source.
- `source/views/PictView-ConnectionFormDemo-Layout.js` - the demo
  shell. Renders the explanatory card, the slot div, the action
  buttons, the status line, and the JSON output `<pre>`. Its
  `onAfterRender` calls `form.setSchemas(...)` once the slot is in the
  DOM, and its action handlers exercise the form's public API.
- `html/index.html` - the static HTML shell. Loads `pict.min.js`
  followed by the application bundle, then drops a single
  `#ConnectionFormDemo-Application-Container` div for the layout to
  render into.
- `css/connection-form-demo.css` - the demo card / button / status /
  pre styling. Kept outside the view's `CSS` block so it can be tweaked
  without rebuilding the bundle.

## The data model

One AppData root, two keys, populated in
`PictApplicationConnectionFormDemo.onAfterInitializeAsync`:

```js
this.pict.AppData.ConnectionFormDemo =
{
    Schemas:        DEMO_SCHEMAS,    // the schema fixture
    ActiveProvider: ''               // empty string - the form picks the first schema as default
};
```

The form mirrors `AppData.ConnectionFormDemo.Schemas` to its internal
state on every `setSchemas()` call (via the `SchemasAddress` host
option). It also mirrors `AppData.ConnectionFormDemo.ActiveProvider`
on every `setActiveProvider()` call (via `ActiveAddress`). That gives
the host a single source of truth it can read - useful for cross-view
sync, persistence, deep-linking, and tests.

The form view itself maintains additional render-only AppData under
`AppData.PictSectionConnectionForm.*` (RootId, FormsId, SelectorSlot,
ProviderForms, etc.) - those are internal scaffolding the template
engine iterates over, not host-facing addresses.

---

## Feature 1 - Registering the form against a host slot

The form view is **pure presentation** - it renders into whatever DOM
selector the host points at, against whatever AppData addresses the
host names. The demo registers it like this:

```js
this.pict.addView('PictSection-ConnectionForm',
    Object.assign({}, libPictSectionConnectionForm.default_configuration,
        {
            ContainerSelector:         '#demo-form-slot',
            DefaultDestinationAddress: '#demo-form-slot',
            SchemasAddress:            'AppData.ConnectionFormDemo.Schemas',
            ActiveAddress:             'AppData.ConnectionFormDemo.ActiveProvider',
            FieldIDPrefix:             'demo-conn',
            OnProviderChange: function (pProvider)
            {
                let tmpLayout = tmpSelf.pict.views['ConnectionFormDemo-Layout'];
                if (tmpLayout && typeof(tmpLayout.notifyProviderChange) === 'function')
                {
                    tmpLayout.notifyProviderChange(pProvider);
                }
            }
        }), libPictSectionConnectionForm);
```

- **`ContainerSelector` / `DefaultDestinationAddress`** - the slot the
  layout view exposes (`<div id="demo-form-slot"></div>`). The form
  renders its provider `<select>` and field blocks into this single
  div.
- **`SchemasAddress`** - the AppData address the view mirrors schemas
  to. Set up so the host can read the current schema list out of
  AppData without calling a getter.
- **`ActiveAddress`** - the AppData address the active-provider id
  mirrors to. Useful for "remember the last provider" persistence or
  cross-view sync (e.g. another view that depends on the active
  provider).
- **`FieldIDPrefix: 'demo-conn'`** - every input's DOM id becomes
  `demo-conn-<provider>-<field>` (e.g. `demo-conn-mysql-host`). The
  prefix exists so multiple connection forms can coexist on the same
  page without collisions.
- **`OnProviderChange`** - host callback fired whenever the user picks
  a different provider in the dropdown. The demo pipes it into the
  status line at the bottom of the card.

`ShowProviderSelect` and `ShowAdvancedToggle` are not overridden - the
demo uses their `true` defaults so the dropdown and the collapsible
Advanced group are both visible.

---

## Feature 2 - Schemas after render, not before

The schemas are stashed in AppData by the application, but the call
that hands them to the form happens in the **layout's**
`onAfterRender` - *not* in the application's `onAfterInitializeAsync`:

```js
onAfterRender(pRenderable, pAddress, pRecord, pContent)
{
    // Prime the shared connection form with the hardcoded schema set.
    // We do this here (rather than in the application's
    // onAfterInitializeAsync) so the slot div is guaranteed to exist
    // in the DOM by the time the form tries to render.
    let tmpForm = this.pict.views['PictSection-ConnectionForm'];
    let tmpSchemas = this.pict.AppData.ConnectionFormDemo.Schemas;
    if (tmpForm && tmpSchemas)
    {
        tmpForm.setSchemas(tmpSchemas);
    }
    this.pict.CSSMap.injectCSS();
    return super.onAfterRender(pRenderable, pAddress, pRecord, pContent);
}
```

This is the canonical lifecycle pattern for a form-into-slot
composition: **the host's layout view owns the timing**. The layout
template defines `<div id="demo-form-slot"></div>`, so the slot only
exists in the DOM after the layout renders. Calling `setSchemas()` any
earlier than `onAfterRender` would mean the form tries to write into a
selector that resolves to `null`.

In production this becomes:

```js
fetch('/myapp/connection/schemas')
    .then((r) => r.json())
    .then((p) => { tmpForm.setSchemas(p.Schemas || []); });
```

Same shape - just `fetch` instead of `require()`. The form doesn't
care where the schemas came from.

---

## Feature 3 - A schema fixture that mirrors production

The fixture isn't a toy - it has the exact shape of what
`meadow-connection-manager.getAllProviderFormSchemas()` returns at
runtime, so the demo exercises the production contract end to end:

```js
const DEMO_SCHEMAS =
[
    {
        Provider:    'SQLite',
        DisplayName: 'SQLite',
        Description: 'Open or create a local SQLite database file.',
        Fields:
        [
            {
                Name:        'SQLiteFilePath',
                Label:       'SQLite File Path',
                Type:        'Path',
                Default:     '~/headlight-liveconnect-local/cloned.sqlite',
                Required:    true,
                Placeholder: '~/headlight-liveconnect-local/cloned.sqlite',
                Help:        'A leading ~ is expanded to your home directory.  Parent directories are created automatically.'
            }
        ]
    },
    {
        Provider:    'MySQL',
        DisplayName: 'MySQL',
        Description: 'Connect to a MySQL or MariaDB server.',
        Fields:
        [
            { Name: 'host',            Label: 'Server',           Type: 'String',   Default: '127.0.0.1', Required: true, Placeholder: '127.0.0.1' },
            { Name: 'port',            Label: 'Port',             Type: 'Number',   Default: 3306,        Required: true, Min: 1, Max: 65535 },
            { Name: 'user',            Label: 'User',             Type: 'String',   Default: 'root',      Required: true },
            { Name: 'password',        Label: 'Password',         Type: 'Password' },
            { Name: 'database',        Label: 'Database',         Type: 'String',   Placeholder: 'meadow' },
            { Name: 'connectionLimit', Label: 'Connection Limit', Type: 'Number',   Default: 20, Min: 1, Group: 'Advanced' }
        ]
    },
    /* PostgreSQL, MSSQL, Solr - same shape ... */
];
```

Each provider record is `{ Provider, DisplayName, Description?, Fields[] }`.
Each field record is the same shape every `meadow-connection-*` module
exports from its `Meadow-Connection-<Type>-FormSchema.js`. Swap the
literal for a `fetch` and the demo becomes a production host.

---

## Feature 4 - The MSSQL schema, end-to-end

MSSQL is the deep case - three advanced features land in the same
schema, and the demo's **Set MSSQL example** button lets you see them
all at once. From the fixture:

```js
{
    Provider:    'MSSQL',
    DisplayName: 'MSSQL',
    Description: 'Microsoft SQL Server - exercises all advanced schema features.',
    Fields:
    [
        { Name: 'server',           Label: 'Server',           Type: 'String',   Default: '127.0.0.1', Required: true },
        { Name: 'port',             Label: 'Port',             Type: 'Number',   Default: 1433,        Required: true, Min: 1, Max: 65535 },
        { Name: 'user',             Label: 'User',             Type: 'String',   Default: 'sa',        Required: true },
        { Name: 'password',         Label: 'Password',         Type: 'Password' },
        { Name: 'database',         Label: 'Database',         Type: 'String',   Placeholder: 'meadow_clone' },
        { Name: 'connectionLimit',  Label: 'Connection Limit', Type: 'Number',   Default: 20, Min: 1, Group: 'Advanced' },
        {
            Name:  'LegacyPagination',
            Label: 'Legacy pagination (SQL Server < 2012 / compat level < 110)',
            Type:  'Boolean',
            Help:  'Use ROW_NUMBER() instead of OFFSET/FETCH for older SQL Server versions.'
        },
        {
            Name:        'RequestTimeoutMs',
            Label:       'Request timeout (sec)',
            Type:        'Number',
            Default:     120,
            Min:         1,
            Multiplier:  1000,
            OmitIfFalsy: true,
            Group:       'Advanced'
        },
        {
            Name:        'RetryInitialDelaySec',
            Label:       'Retry initial delay (sec, applies to both Connect + DDL retries)',
            Type:        'Number',
            Default:     3,
            Min:         1,
            Max:         60,
            Multiplier:  1000,
            MapTo:       [ 'ConnectRetryOptions.InitialDelayMs', 'DDLRetryOptions.InitialDelayMs' ],
            OmitIfFalsy: true,
            Group:       'Advanced'
        }
    ]
}
```

Each rich field demonstrates one capability:

- **`LegacyPagination`** - `Type: 'Boolean'` renders a checkbox; the
  emitted config gets `LegacyPagination: true` / `LegacyPagination: false`.
- **`RequestTimeoutMs`** - `Multiplier: 1000` means the input shows
  seconds, but `getProviderConfig()` emits milliseconds (input × 1000).
  Reverse on `setValues()`: a saved blob with `RequestTimeoutMs: 90000`
  renders the input as **90**. `OmitIfFalsy: true` means if the user
  clears the field to 0, the key disappears from the emitted JSON
  entirely - the server gets to use *its* default.
- **`RetryInitialDelaySec`** - `MapTo: [ 'ConnectRetryOptions.InitialDelayMs', 'DDLRetryOptions.InitialDelayMs' ]`.
  The user fills *one* input; the emitted config nests the value at
  two paths. Combined with `Multiplier: 1000` this means "user types
  5, both nested keys get 5000". This is the **canonical pattern** for
  retry timing in MSSQL - both layers should retry on the same
  initial delay, so the schema collapses them into one input.

---

## Feature 5 - Action buttons that exercise the public API

The card's button row maps one-to-one to the form's public methods.
Each handler is a few lines of layout code:

```js
readConfig()
{
    let tmpForm = this.pict.views['PictSection-ConnectionForm'];
    if (!tmpForm) { return; }
    let tmpResult = tmpForm.getProviderConfig();
    document.getElementById('demo-output').textContent = JSON.stringify(tmpResult, null, 2);
    this._setStatus(`Read config for ${tmpResult.Provider} (${Object.keys(tmpResult.Config).length} keys).`);
}

applyMSSQLExample()
{
    let tmpForm = this.pict.views['PictSection-ConnectionForm'];
    if (!tmpForm) { return; }
    tmpForm.setValues('MSSQL',
        {
            server:           'mssql.internal',
            port:             1433,
            user:             'sa',
            password:         'P@ssw0rd!',
            database:         'analytics',
            LegacyPagination: true,
            RequestTimeoutMs: 90000,                                 // displayed as 90 sec
            ConnectRetryOptions: { InitialDelayMs: 5000 }            // RetryInitialDelaySec input shows 5
        });
    this._setStatus('Loaded MSSQL example values (note Multiplier converts ms<->sec on display).');
}

clearForm()
{
    let tmpForm = this.pict.views['PictSection-ConnectionForm'];
    if (!tmpForm) { return; }
    tmpForm.clear();
    document.getElementById('demo-output').textContent = '(click "Read config" to populate)';
    this._setStatus('Form cleared back to schema defaults.');
}
```

Three things to notice:

1. **The form is reached via `pict.views['PictSection-ConnectionForm']`**
   - the standard Pict view registry, not a global. Multiple instances
   on a page would use distinct view hashes.
2. **`setValues()` accepts the storage-format blob, not display-format.**
   `RequestTimeoutMs: 90000` (ms) becomes **90** in the input because
   the view reverse-applies `Multiplier` on display. Saved configs
   round-trip cleanly.
3. **`MapTo` is honored on both directions.** `setValues()` walks the
   first `MapTo[0]` path to populate the input; `getProviderConfig()`
   writes to every `MapTo[i]` path on read. Saving and reloading the
   same MSSQL connection is lossless even though one input drives two
   nested keys.

---

## Feature 6 - `OnProviderChange` callback wiring

The layout view exposes one host method:

```js
notifyProviderChange(pProvider)
{
    this._setStatus(`Active provider changed to ${pProvider}.`);
}
```

The form's `OnProviderChange` option in the application config calls
straight into it:

```js
OnProviderChange: function (pProvider)
{
    let tmpLayout = tmpSelf.pict.views['ConnectionFormDemo-Layout'];
    if (tmpLayout && typeof(tmpLayout.notifyProviderChange) === 'function')
    {
        tmpLayout.notifyProviderChange(pProvider);
    }
}
```

Switch the dropdown from MySQL to PostgreSQL - the status line below
the form updates without re-rendering the whole card. This is the
**callback escape hatch** for hosts that need to react to provider
changes without polling AppData (e.g. swap a sibling view, refetch a
schema-dependent setting, toggle a Save button label, ...).

---

## Running the example

```bash
cd example_applications/connection_form_demo
npm install
npm run build      # quack build -> quack copy -> dist/
# Open dist/index.html in a browser, or serve the dist folder:
#   cd dist && python3 -m http.server 8080
#   visit http://localhost:8080
```

No server, no database - the demo runs entirely client-side off the
hardcoded `DEMO_SCHEMAS` fixture. The bundle's filename is
`pict-section-connection-form-example-connection-form-demo.compatible.min.js`
(derived from the package name); the HTML shell loads it after
`pict.min.js`.

## Things to try in the running app

- **Pick MSSQL**, expand **Advanced** - note the three feature-rich
  fields: a Boolean checkbox, the request timeout in seconds, and the
  retry initial delay.
- **Click Set MSSQL example** - the form populates with the saved
  blob. The request timeout input shows **90** (sec); the retry initial
  delay shows **5** - both reverse-applied from milliseconds.
- **Click Read config** - the JSON output mirrors what
  `getProviderConfig()` returns:
  - `RequestTimeoutMs: 90000` (input × 1000)
  - `ConnectRetryOptions.InitialDelayMs: 5000` and
    `DDLRetryOptions.InitialDelayMs: 5000` (input × 1000 via `MapTo`)
  - `LegacyPagination: true` (boolean checkbox)
- **Set the request timeout to 0** and click Read config - the
  `RequestTimeoutMs` key is gone entirely (`OmitIfFalsy: true`).
- **Pick Solr** - the **Use HTTPS** checkbox demonstrates a
  `Type: 'Boolean'` outside the Advanced group.
- **Pick SQLite** - only one field, a `Path` with a tilde-expansion
  placeholder.
- **Click Clear** - every field resets to its schema-declared
  `Default`. The status line confirms the reset.
- **Pick a different provider** - the status line updates via
  `OnProviderChange`; no other view re-renders.

## Takeaways

1. **The form is pure presentation.** It does not fetch schemas, does
   not own any state outside `AppData.<host's addresses>`, and does
   not know what server backs the deployment. The host owns timing,
   transport, and persistence.
2. **The schema *is* the contract.** Fields you declare in the schema
   are fields you render - there is no "secret" extra config the form
   reads. `Multiplier` / `MapTo` / `OmitIfFalsy` are entirely
   schema-driven, so reusing the schema in tests or migrations is
   trivial.
3. **`Multiplier` round-trips.** Storage is canonical (ms / bytes /
   whatever); display is human-friendly (sec / MB / whatever). The
   reverse application on `setValues()` means saved blobs reload
   cleanly into the same display value the user typed.
4. **`MapTo` collapses correlated fields.** One input updates multiple
   nested config keys - and the reverse path reads from the first
   `MapTo` target, so saved configs round-trip even after the schema
   added the second mapping.
5. **`OmitIfFalsy` keeps the wire format minimal.** Cleared fields
   disappear from the payload instead of arriving as zeros, so the
   server's own defaults take over.

## Related documentation

- [pict-section-connection-form on GitHub](https://github.com/fable-retold/pict-section-connection-form) - README covers quick-start, host-option table, and the public-API surface
- [pict-meadow-connection-manager](https://fable-retold.github.io/pict-meadow-connection-manager/) - the named-connection manager that consumes this view
- [meadow-connection-manager](https://fable-retold.github.io/meadow-connection-manager/) - server-side schema aggregator
