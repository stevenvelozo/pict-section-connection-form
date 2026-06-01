# pict-section-connection-form

Schema-driven Pict view for rendering Meadow database connection forms.
Consumes the connection-form schemas exported by each `meadow-connection-*`
module and aggregated server-side via
[`meadow-connection-manager`](../../meadow/meadow-connection-manager) ≥ 1.1.0.

Three Retold apps consume this view today -
[`retold-data-service`](../../meadow/retold-data-service) (the DataCloner
"Database Connection" accordion), [`retold-databeacon`](../../apps/retold-databeacon)
(the "Add Connection" form), and [`retold-facto`](../../apps/retold-facto)
(the "Store Connections" form). One view; three hosts.

## What it does

Given an array of connection schemas - one per provider type (MySQL,
PostgreSQL, MSSQL, SQLite, MongoDB, Solr, RocksDB, Bibliograph, ...) -
this view renders:

- a provider `<select>` (optional)
- one form block per provider, only the active one visible
- per-field inputs typed by the schema (`String` | `Number` | `Password` | `Boolean` | `Path` | `Select`)
- an "Advanced" `<details>` block for fields tagged `Group: 'Advanced'`
- a "no schemas detected" notice when the schemas array is empty

It also collects values back out of the DOM into the canonical wire
format each connection driver expects, honoring the schema's
`Multiplier` (sec->ms unit conversion), `MapTo` (one input to multiple
nested-config keys - e.g. MSSQL retry timing populates both
`ConnectRetryOptions.*` and `DDLRetryOptions.*`), and `OmitIfFalsy`
(don't emit zero/empty/false keys).

The view is **pure presentation**. It does not fetch schemas itself -
each host application owns the fetch (typically `GET /<app>/connection/schemas`
backed by `meadow-connection-manager.getAllProviderFormSchemas()`) and
calls `setSchemas()` once the response arrives.

## Installation

```
npm install pict-section-connection-form
```

Peer expectations:
- `pict` ≥ 1.0.364
- `pict-view` ≥ 1.0.68
- `meadow-connection-manager` ≥ 1.1.0 on the server side (for the
  schemas endpoint).

## Quick start

Register the view, fetch schemas, hand them in:

```javascript
const libPictSectionConnectionForm = require('pict-section-connection-form');

// In your application's constructor:
this.pict.addView('PictSection-ConnectionForm',
    Object.assign({}, libPictSectionConnectionForm.default_configuration,
        {
            ContainerSelector:         '#MyApp-Connection-FormSlot',
            DefaultDestinationAddress: '#MyApp-Connection-FormSlot',
            SchemasAddress:            'AppData.MyApp.ConnectionSchemas',
            ActiveAddress:             'AppData.MyApp.ConnectionActiveProvider',
            FieldIDPrefix:             'myapp-conn'
        }), libPictSectionConnectionForm);

// After the layout has rendered (so the slot div exists):
fetch('/myapp/connection/schemas').then((r) => r.json()).then((p) =>
{
    this.pict.views['PictSection-ConnectionForm'].setSchemas(p.Schemas || []);
});

// On Save / Connect / Test:
let { Provider, Config } = this.pict.views['PictSection-ConnectionForm'].getProviderConfig();
fetch('/myapp/connection', { method: 'POST', body: JSON.stringify({ Provider, Config }) });
```

## Configuration

All options are merged on top of `default_configuration` when you
register the view. Hosts override at registration time.

| Option | Default | Purpose |
|--------|---------|---------|
| `ContainerSelector` | `'#PictSection-ConnectionForm-Slot'` | CSS selector where the form renders |
| `SchemasAddress` | `'AppData.Connection.Schemas'` | AppData address the view mirrors `Schemas` to |
| `ActiveAddress` | `'AppData.Connection.ActiveProvider'` | AppData address the view mirrors `ActiveProvider` to |
| `FieldIDPrefix` | `'pict-conn'` | DOM-id namespace - pick a unique value per concurrent form on a page |
| `ShowProviderSelect` | `true` | Whether to render the provider `<select>`. Set `false` for single-provider edit forms |
| `ShowAdvancedToggle` | `true` | Whether `Group: 'Advanced'` fields are rendered inside a collapsible `<details>` |
| `OnProviderChange(provider)` | `undefined` | Optional callback fired when the user picks a different provider |

## Public API

```javascript
view.setSchemas(schemas)
    Replace the schema list and re-render.

view.setActiveProvider(provider)
    Switch the visible provider form.  Triggers OnProviderChange.

view.getActiveProvider() -> string
    Currently selected provider id.

view.getProviderConfig() -> { Provider, Config }
    Read the active form's values into the canonical wire format.
    Honors Multiplier, MapTo, OmitIfFalsy, type-aware DOM reads
    (Boolean -> .checked, Number -> parseInt, else trimmed string).

view.setValues(provider, configBlob)
    Populate the form from a saved config blob.  Used by edit
    workflows.  Reverse-applies Multiplier (storage -> display) and
    follows MapTo[0] when reading from nested config.

view.clear()
    Reset to the first schema's defaults.

view.fieldDOMId(provider, fieldName) -> string
    Resolve the DOM id for a specific field.  Useful when host code
    needs to focus, blur, or attach extra listeners to an input.
```

## Field shape

Each schema's `Fields` array follows the same contract as the
`Meadow-Connection-<Type>-FormSchema.js` files exported by every
`meadow-connection-*` module:

```javascript
{
    Name:        'host',                     // canonical config key
    Label:       'Server',                   // UI label
    Type:        'String',                   // String | Number | Password | Boolean | Path | Select
    Default:     '127.0.0.1',                // initial value
    Required:    true,
    Placeholder: '127.0.0.1',
    Help:        'Hostname or IP address.',
    Min: 1, Max: 65535,                      // Number bounds
    Group:       'Advanced',                 // 'Basic' (default) or 'Advanced'
    Multiplier:  1000,                       // form value × multiplier = stored value (sec->ms)
    MapTo:       [ 'a.b.c', 'd.e.f' ],       // dotted-path targets; absent => stored at Name
    OmitIfFalsy: true,                       // drop key when value is 0/empty/false
    Options:     [ { Value, Label }, ... ]   // for Select
}
```

## Running the tests

```
npm install
npm test
```

The test suite uses `browser-env` (jsdom) to mount a real Pict instance
plus a synthetic DOM, so the rendering and collection paths are
exercised end-to-end without a browser.

## Running the example

A standalone interactive demo lives under `example_applications/connection_form_demo`.
It renders the form against a hardcoded schema fixture and provides
buttons that exercise `getProviderConfig()`, `setValues()`, and
`clear()`.

```
npm install
npm run example
```

That's it - `npx quack examples` auto-installs the example's deps,
builds the bundle, and starts a server. The console prints the URL
(typically `http://localhost:9004/connection_form_demo/dist/index.html`).
Ctrl-C to stop.

Things to try in the demo:
- Pick **MSSQL** and expand the Advanced settings - note that "Retry
  initial delay (sec)" is one input, but the emitted config splits
  it across `ConnectRetryOptions.InitialDelayMs` and
  `DDLRetryOptions.InitialDelayMs` (×1000).
- Click **Set MSSQL example** - note the input shows seconds, but the
  saved blob stored milliseconds; the view reverse-applies `Multiplier`
  on display.
- Set the request timeout to 0 and click **Read config** - the key is
  omitted entirely (`OmitIfFalsy`).

## License

MIT - Steven Velozo
