/**
 * PictSection-ConnectionForm
 *
 * Schema-driven Meadow connection-form view.  Renders a provider
 * <select> + per-provider field block from the form schemas exported
 * by each `meadow-connection-*` module (and aggregated server-side via
 * `meadow-connection-manager#getAllProviderFormSchemas()`).
 *
 * Three host applications consume this:
 *   - retold-data-service / DataCloner     (single active provider, "connect/test" UX)
 *   - retold-databeacon / Connection list  (add/edit named saved connections)
 *   - retold-facto / Store connections     (add/edit named saved connections)
 *
 * Each host wires it with a different DOM destination + AppData
 * address + DOM-id prefix so multiple connection forms can coexist
 * without colliding on element ids.
 *
 * ── Wiring contract ────────────────────────────────────────────────
 * Host AppData (configurable via SchemasAddress / ActiveAddress):
 *   AppData.<...>.Schemas         array of schemas (see field shape)
 *   AppData.<...>.ActiveProvider  string — currently selected Provider
 *
 * Host options on the view (registered via pict.addView):
 *   ContainerSelector    — where to render (overrides DefaultDestinationAddress)
 *   SchemasAddress       — AppData address of the Schemas array
 *   ActiveAddress        — AppData address of the ActiveProvider string
 *   FieldIDPrefix        — DOM-id namespace ('pict-conn' default)
 *   ShowProviderSelect   — whether to render the <select> (false = single-provider mode)
 *   ShowAdvancedToggle   — whether the Advanced group is collapsible
 *   OnProviderChange(p)  — optional callback when the user picks a different provider
 *
 * Host calls (instance methods):
 *   setSchemas(pSchemas)            — replace schema list and re-render
 *   setActiveProvider(pProvider)    — switch active provider
 *   getProviderConfig()             — collect form values → { Provider, Config }
 *   setValues(pProvider, pConfig)   — populate fields from a saved config blob
 *   clear()                         — reset all fields to schema defaults
 *
 * ── Field shape (from each meadow-connection-* schema) ─────────────
 *   Name        — canonical config key (lowercase for SQL drivers, dotted for nested)
 *   Label       — UI label
 *   Type        — String | Number | Password | Boolean | Path | Select
 *   Default     — initial value
 *   Required    — boolean
 *   Placeholder, Help, Min, Max — UI hints
 *   Group       — 'Basic' (default) or 'Advanced' (rendered under <details>)
 *   Multiplier  — form value × multiplier = stored value (sec→ms via 1000)
 *   MapTo       — array of dotted-path targets (one input → multiple keys)
 *   OmitIfFalsy — drop key from emitted config when value is 0/empty/false
 *   Options     — for Select: [{ Value, Label }]
 *
 * Pure presentation — does NOT fetch schemas itself.  Host fetches
 * them however it likes (typical: GET /<app>/connection/schemas
 * backed by MCM) and calls setSchemas() once they arrive.
 */
'use strict';

const libPictView = require('pict-view');
const _DefaultConfiguration = require('./Pict-Section-ConnectionForm-DefaultConfiguration.js');

const _BaseCSS = /*css*/`
.pict-conn-form {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.pict-conn-form__provider-row {
	display: flex;
	gap: 10px;
	align-items: flex-end;
}
.pict-conn-form__provider-row label {
	font-size: 12px;
	font-weight: 600;
	color: #475569;
	text-transform: uppercase;
	letter-spacing: 0.3px;
	display: flex;
	flex-direction: column;
	gap: 4px;
	flex: 0 0 200px;
}
.pict-conn-form__provider-row select {
	font-family: inherit;
	font-size: 14px;
	padding: 7px 10px;
	border: 1px solid #cbd5e1;
	border-radius: 6px;
	background: #fff;
	color: #0f172a;
	height: 36px;
}
.pict-conn-form__provider-form {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 10px 16px;
}
.pict-conn-form__field {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.pict-conn-form__field label {
	font-size: 12px;
	font-weight: 600;
	color: #475569;
	text-transform: uppercase;
	letter-spacing: 0.3px;
}
.pict-conn-form__field input,
.pict-conn-form__field select {
	font-family: inherit;
	font-size: 14px;
	padding: 7px 10px;
	border: 1px solid #cbd5e1;
	border-radius: 6px;
	background: #fff;
	color: #0f172a;
}
.pict-conn-form__field input[type="checkbox"] {
	width: auto;
	height: auto;
	align-self: flex-start;
}
.pict-conn-form__field-help {
	font-size: 11px;
	color: #64748b;
}
.pict-conn-form__advanced {
	grid-column: 1 / -1;
	margin-top: 4px;
}
.pict-conn-form__advanced > summary {
	cursor: pointer;
	font-weight: 600;
	color: #475569;
	font-size: 12px;
	text-transform: uppercase;
	letter-spacing: 0.3px;
	padding: 4px 0;
}
.pict-conn-form__advanced > p {
	margin: 8px 0;
	font-size: 12px;
	color: #64748b;
}
.pict-conn-form__advanced > .pict-conn-form__advanced-fields {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 10px 16px;
}
.pict-conn-form__no-schemas {
	padding: 12px;
	background: #fef3c7;
	border: 1px solid #f59e0b;
	border-radius: 6px;
	color: #92400e;
	font-size: 13px;
}
`;

const _BaseTemplates =
[
	{
		Hash: 'PictSection-ConnectionForm-Main',
		Template: /*html*/`
<div class="pict-conn-form" id="{~D:AppData.PictSectionConnectionForm.RootId~}">
	{~TS:PictSection-ConnectionForm-Selector:AppData.PictSectionConnectionForm.SelectorSlot~}
	<div class="pict-conn-form__forms" id="{~D:AppData.PictSectionConnectionForm.FormsId~}">
		{~TS:PictSection-ConnectionForm-ProviderForm:AppData.PictSectionConnectionForm.ProviderForms~}
	</div>
	{~TS:PictSection-ConnectionForm-NoSchemas:AppData.PictSectionConnectionForm.NoSchemasSlot~}
</div>`
	},
	{
		Hash: 'PictSection-ConnectionForm-Selector',
		Template: /*html*/`
<div class="pict-conn-form__provider-row">
	<label>Provider
		<select id="{~D:Record.SelectId~}" onchange="{~P~}.views['{~D:Record.ViewHash~}'].onProviderSelectChange(this.value)">
			{~TS:PictSection-ConnectionForm-ProviderOption:Record.Options~}
		</select>
	</label>
</div>`
	},
	{
		Hash: 'PictSection-ConnectionForm-ProviderOption',
		Template: /*html*/`<option value="{~D:Record.Provider~}" {~D:Record.SelectedAttr~}>{~D:Record.DisplayName~}</option>`
	},
	{
		Hash: 'PictSection-ConnectionForm-ProviderForm',
		Template: /*html*/`
<div class="pict-conn-form__provider-form" id="{~D:Record.FormId~}" style="display:{~D:Record.DisplayStyle~}">
	{~TS:PictSection-ConnectionForm-Field:Record.BasicFields~}
	{~TS:PictSection-ConnectionForm-Advanced:Record.AdvancedSlot~}
</div>`
	},
	{
		Hash: 'PictSection-ConnectionForm-Field',
		Template: /*html*/`
<div class="pict-conn-form__field">
	<label for="{~D:Record.DOMId~}">{~D:Record.Label~}</label>
	{~D:Record.InputHTML~}
	{~TS:PictSection-ConnectionForm-FieldHelp:Record.HelpSlot~}
</div>`
	},
	{
		Hash: 'PictSection-ConnectionForm-FieldHelp',
		Template: /*html*/`<small class="pict-conn-form__field-help">{~D:Record.Help~}</small>`
	},
	{
		Hash: 'PictSection-ConnectionForm-Advanced',
		Template: /*html*/`
<details class="pict-conn-form__advanced">
	<summary>Advanced settings</summary>
	<p>Optional tuning — leave blank or zero to use the connection driver's defaults.</p>
	<div class="pict-conn-form__advanced-fields">
		{~TS:PictSection-ConnectionForm-Field:Record.Fields~}
	</div>
</details>`
	},
	{
		Hash: 'PictSection-ConnectionForm-NoSchemas',
		Template: /*html*/`<div class="pict-conn-form__no-schemas">No connection providers detected.  Either <code>meadow-connection-manager</code> is older than 1.1.0 or no provider modules are installed in the host environment.</div>`
	}
];

class PictSectionConnectionForm extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		// Merge host-supplied options on top of the module defaults.
		// Templates + CSS come from this module; host can override the
		// AppData addresses, the DOM destination, and the field-id prefix.
		let tmpOptions = Object.assign({}, _DefaultConfiguration, pOptions || {});
		if (!tmpOptions.Templates) { tmpOptions.Templates = _BaseTemplates; }
		if (!tmpOptions.CSS)        { tmpOptions.CSS = _BaseCSS; }
		if (!tmpOptions.Renderables)
		{
			tmpOptions.Renderables =
			[
				{
					RenderableHash:            'PictSection-ConnectionForm-Main',
					TemplateHash:              'PictSection-ConnectionForm-Main',
					ContentDestinationAddress: tmpOptions.ContainerSelector || tmpOptions.DefaultDestinationAddress,
					RenderMethod:              'replace'
				}
			];
		}

		super(pFable, tmpOptions, pServiceHash);

		this._Schemas        = [];
		this._ActiveProvider = '';
	}

	// ====================================================================
	//  Public API — hosts call these to drive the view
	// ====================================================================

	setSchemas(pSchemas)
	{
		this._Schemas = Array.isArray(pSchemas) ? pSchemas : [];
		// If no active provider yet, default to the first schema.
		if (!this._ActiveProvider && this._Schemas.length > 0)
		{
			this._ActiveProvider = this._Schemas[0].Provider;
		}
		this._writeAppData();
		this.render();
	}

	setActiveProvider(pProvider)
	{
		this._ActiveProvider = pProvider || '';
		this._writeAppData();
		this.render();
		this._invokeProviderChangeCallback();
	}

	getActiveProvider()
	{
		return this._ActiveProvider;
	}

	/**
	 * Read the active provider's form values out of the DOM and
	 * collect them into the canonical wire-format config blob the
	 * provider's connection driver expects.  Honors:
	 *   - Multiplier (form value × multiplier = stored value)
	 *   - MapTo (one input → multiple dotted-path targets)
	 *   - OmitIfFalsy (drop key when value is 0/empty/false)
	 *   - Type-aware reads (Boolean→.checked, Number→parseInt, else trimmed string)
	 *
	 * @returns {{Provider: string, Config: object}}
	 */
	getProviderConfig()
	{
		let tmpProvider = this._ActiveProvider;
		let tmpSchema = this._Schemas.find((pS) => pS.Provider === tmpProvider);
		if (!tmpSchema) { return { Provider: tmpProvider, Config: {} }; }

		let tmpConfig = {};
		(tmpSchema.Fields || []).forEach((pField) => this._collectField(tmpProvider, pField, tmpConfig));
		return { Provider: tmpProvider, Config: tmpConfig };
	}

	/**
	 * Populate the form from a saved config blob.  Used by edit
	 * workflows (DataBeacon / Facto) that load a named connection
	 * record and want its values pre-filled.
	 *
	 * @param {string} pProvider
	 * @param {object} pConfig — wire-format config (same shape getProviderConfig returns)
	 */
	setValues(pProvider, pConfig)
	{
		this._ActiveProvider = pProvider || '';
		this._writeAppData();
		this.render();

		let tmpSchema = this._Schemas.find((pS) => pS.Provider === pProvider);
		if (!tmpSchema || typeof(document) === 'undefined') { return; }

		(tmpSchema.Fields || []).forEach((pField) =>
		{
			let tmpDOMId = this.fieldDOMId(pProvider, pField.Name);
			let tmpEl = document.getElementById(tmpDOMId);
			if (!tmpEl) { return; }

			let tmpVal = this._readNested(pConfig || {}, pField.MapTo && pField.MapTo[0] ? pField.MapTo[0] : pField.Name);
			// Reverse-apply Multiplier (storage unit → display unit).
			if (pField.Multiplier && typeof(tmpVal) === 'number')
			{
				tmpVal = Math.floor(tmpVal / pField.Multiplier);
			}

			if (pField.Type === 'Boolean')        { tmpEl.checked = !!tmpVal; }
			else if (tmpVal === undefined || tmpVal === null) { /* leave default */ }
			else                                  { tmpEl.value = String(tmpVal); }
		});
	}

	clear()
	{
		this._ActiveProvider = this._Schemas.length > 0 ? this._Schemas[0].Provider : '';
		this._writeAppData();
		this.render();
	}

	// ====================================================================
	//  DOM-id helper — host code can use this to find a specific input
	// ====================================================================

	fieldDOMId(pProvider, pFieldName)
	{
		let tmpPrefix   = this.options.FieldIDPrefix || 'pict-conn';
		let tmpProvider = String(pProvider || '').toLowerCase();
		let tmpField    = String(pFieldName || '').replace(/\./g, '_');
		return `${tmpPrefix}-${tmpProvider}-${tmpField}`;
	}

	// ====================================================================
	//  Lifecycle hooks
	// ====================================================================

	onBeforeRender(pRenderable)
	{
		this._writeAppData();
		return super.onBeforeRender(pRenderable);
	}

	onAfterRender(pRenderable, pAddress, pRecord, pContent)
	{
		// Toggle visibility on the active provider's form (the templates
		// pre-render a wrapper for every schema so values persist when
		// the user switches between providers).
		if (typeof(document) !== 'undefined')
		{
			this._Schemas.forEach((pSchema) =>
			{
				let tmpEl = document.getElementById(this._formId(pSchema.Provider));
				if (tmpEl)
				{
					tmpEl.style.display = (pSchema.Provider === this._ActiveProvider) ? '' : 'none';
				}
			});
		}
		this.pict.CSSMap.injectCSS();
		return super.onAfterRender(pRenderable, pAddress, pRecord, pContent);
	}

	// ====================================================================
	//  Selector-change handler (called from the rendered <select>)
	// ====================================================================

	onProviderSelectChange(pProvider)
	{
		this.setActiveProvider(pProvider);
	}

	// ====================================================================
	//  Internals
	// ====================================================================

	/**
	 * Push the computed render records into AppData under the address
	 * the templates read from.  Templates always read from
	 * `AppData.PictSectionConnectionForm.*` regardless of where the
	 * host's "real" Schemas / ActiveProvider live; that's because Pict
	 * template addresses are static strings and we want one set of
	 * templates to work for many host configurations.  The real
	 * SchemasAddress / ActiveAddress are also written so hosts can
	 * read them out for their own state-tracking.
	 */
	_writeAppData()
	{
		if (!this.pict.AppData) { this.pict.AppData = {}; }
		let tmpRoot = this.pict.AppData.PictSectionConnectionForm = (this.pict.AppData.PictSectionConnectionForm || {});

		let tmpPrefix = this.options.FieldIDPrefix || 'pict-conn';
		tmpRoot.RootId  = `${tmpPrefix}-root`;
		tmpRoot.FormsId = `${tmpPrefix}-forms`;

		// Selector slot — empty array hides the <select>, single-element
		// renders it once.  Honors ShowProviderSelect.
		if (this.options.ShowProviderSelect && this._Schemas.length > 0)
		{
			tmpRoot.SelectorSlot =
				[
					{
						SelectId: `${tmpPrefix}-provider-select`,
						ViewHash: this.Hash,
						Options:  this._Schemas.map((pS) => (
							{
								Provider:     pS.Provider,
								DisplayName:  this._escape(pS.DisplayName || pS.Provider),
								SelectedAttr: (pS.Provider === this._ActiveProvider) ? 'selected' : ''
							}))
					}
				];
		}
		else
		{
			tmpRoot.SelectorSlot = [];
		}

		tmpRoot.ProviderForms = this._Schemas.map((pSchema) =>
			this._buildProviderForm(pSchema, pSchema.Provider === this._ActiveProvider));

		tmpRoot.NoSchemasSlot = this._Schemas.length === 0 ? [{}] : [];

		// Mirror state into the host's configured AppData addresses (so
		// hosts that read AppData directly see live values).
		if (this.options.SchemasAddress)
		{
			this._writeAppDataAddress(this.options.SchemasAddress, this._Schemas);
		}
		if (this.options.ActiveAddress)
		{
			this._writeAppDataAddress(this.options.ActiveAddress, this._ActiveProvider);
		}
	}

	_buildProviderForm(pSchema, pIsActive)
	{
		let tmpFields = pSchema.Fields || [];
		let tmpBasic = [];
		let tmpAdvanced = [];

		tmpFields.forEach((pField) =>
		{
			let tmpRecord = this._buildFieldRecord(pField, pSchema.Provider);
			if (pField.Group === 'Advanced') { tmpAdvanced.push(tmpRecord); }
			else { tmpBasic.push(tmpRecord); }
		});

		return {
			Provider:     pSchema.Provider,
			FormId:       this._formId(pSchema.Provider),
			DisplayStyle: pIsActive ? '' : 'none',
			BasicFields:  tmpBasic,
			AdvancedSlot: (this.options.ShowAdvancedToggle && tmpAdvanced.length > 0)
				? [{ Fields: tmpAdvanced }]
				: []
		};
	}

	_buildFieldRecord(pField, pProvider)
	{
		let tmpDOMId = this.fieldDOMId(pProvider, pField.Name);
		return {
			DOMId:     tmpDOMId,
			Label:     this._escape(pField.Label || pField.Name),
			InputHTML: this._buildInputHTML(pField, tmpDOMId),
			HelpSlot:  pField.Help ? [{ Help: this._escape(pField.Help) }] : []
		};
	}

	_buildInputHTML(pField, pDOMId)
	{
		let tmpDefault     = (pField.Default !== undefined && pField.Default !== null) ? String(pField.Default) : '';
		let tmpPlaceholder = pField.Placeholder ? this._escape(pField.Placeholder) : '';
		let tmpRequired    = pField.Required ? ' required' : '';

		switch (pField.Type)
		{
			case 'Number':
			{
				let tmpMin = (pField.Min !== undefined && pField.Min !== null) ? ` min="${this._escape(String(pField.Min))}"` : '';
				let tmpMax = (pField.Max !== undefined && pField.Max !== null) ? ` max="${this._escape(String(pField.Max))}"` : '';
				return `<input type="number" id="${this._escape(pDOMId)}" value="${this._escape(tmpDefault)}" placeholder="${tmpPlaceholder}"${tmpMin}${tmpMax}${tmpRequired}>`;
			}
			case 'Password':
				return `<input type="password" id="${this._escape(pDOMId)}" placeholder="${tmpPlaceholder || '(optional)'}"${tmpRequired}>`;
			case 'Boolean':
			{
				let tmpChecked = pField.Default ? ' checked' : '';
				return `<input type="checkbox" id="${this._escape(pDOMId)}"${tmpChecked}>`;
			}
			case 'Select':
			{
				let tmpOptions = (pField.Options || []).map((pOpt) =>
					{
						let tmpVal = String(pOpt.Value);
						let tmpSel = (tmpVal === tmpDefault) ? ' selected' : '';
						return `<option value="${this._escape(tmpVal)}"${tmpSel}>${this._escape(pOpt.Label || tmpVal)}</option>`;
					}).join('');
				return `<select id="${this._escape(pDOMId)}"${tmpRequired}>${tmpOptions}</select>`;
			}
			case 'Path':
			case 'String':
			default:
				return `<input type="text" id="${this._escape(pDOMId)}" value="${this._escape(tmpDefault)}" placeholder="${tmpPlaceholder}"${tmpRequired}>`;
		}
	}

	_collectField(pProvider, pField, pConfigOut)
	{
		if (typeof(document) === 'undefined') { return; }
		let tmpDOMId = this.fieldDOMId(pProvider, pField.Name);
		let tmpEl    = document.getElementById(tmpDOMId);
		if (!tmpEl) { return; }

		let tmpRaw;
		if (pField.Type === 'Boolean')
		{
			tmpRaw = !!tmpEl.checked;
		}
		else if (pField.Type === 'Number')
		{
			let tmpParsed = parseInt(tmpEl.value, 10);
			tmpRaw = isNaN(tmpParsed) ? 0 : tmpParsed;
		}
		else
		{
			tmpRaw = String(tmpEl.value || '').trim();
		}

		let tmpFinal = tmpRaw;
		if (pField.Multiplier && typeof(tmpFinal) === 'number')
		{
			tmpFinal = tmpFinal * pField.Multiplier;
		}

		if (pField.OmitIfFalsy && !tmpFinal) { return; }

		let tmpTargets = (pField.MapTo && pField.MapTo.length) ? pField.MapTo : [ pField.Name ];
		tmpTargets.forEach((pPath) => this._setNested(pConfigOut, pPath, tmpFinal));
	}

	_setNested(pTarget, pPath, pValue)
	{
		let tmpParts = String(pPath).split('.');
		let tmpCursor = pTarget;
		for (let i = 0; i < tmpParts.length - 1; i++)
		{
			let tmpKey = tmpParts[i];
			if (typeof(tmpCursor[tmpKey]) !== 'object' || tmpCursor[tmpKey] === null)
			{
				tmpCursor[tmpKey] = {};
			}
			tmpCursor = tmpCursor[tmpKey];
		}
		tmpCursor[tmpParts[tmpParts.length - 1]] = pValue;
	}

	_readNested(pSource, pPath)
	{
		let tmpParts = String(pPath).split('.');
		let tmpCursor = pSource;
		for (let i = 0; i < tmpParts.length; i++)
		{
			if (tmpCursor === undefined || tmpCursor === null) { return undefined; }
			tmpCursor = tmpCursor[tmpParts[i]];
		}
		return tmpCursor;
	}

	_writeAppDataAddress(pAddress, pValue)
	{
		// Address is "AppData.X.Y" — drop the leading "AppData." prefix
		// before walking; if it's missing, fall through and treat the
		// whole string as a property chain off pict.AppData.
		let tmpRoot = this.pict.AppData;
		let tmpAddr = String(pAddress || '');
		if (tmpAddr.indexOf('AppData.') === 0) { tmpAddr = tmpAddr.substring('AppData.'.length); }
		if (!tmpAddr) { return; }
		let tmpParts = tmpAddr.split('.');
		let tmpCursor = tmpRoot;
		for (let i = 0; i < tmpParts.length - 1; i++)
		{
			let tmpKey = tmpParts[i];
			if (typeof(tmpCursor[tmpKey]) !== 'object' || tmpCursor[tmpKey] === null)
			{
				tmpCursor[tmpKey] = {};
			}
			tmpCursor = tmpCursor[tmpKey];
		}
		tmpCursor[tmpParts[tmpParts.length - 1]] = pValue;
	}

	_invokeProviderChangeCallback()
	{
		let tmpCb = this.options.OnProviderChange;
		if (typeof(tmpCb) === 'function')
		{
			try { tmpCb(this._ActiveProvider); }
			catch (pError)
			{
				if (this.log && this.log.warn) { this.log.warn(`PictSection-ConnectionForm: OnProviderChange callback threw: ${pError && pError.message}`); }
			}
		}
	}

	_formId(pProvider)
	{
		let tmpPrefix = this.options.FieldIDPrefix || 'pict-conn';
		return `${tmpPrefix}-form-${String(pProvider || '').toLowerCase()}`;
	}

	_escape(pStr)
	{
		return String(pStr == null ? '' : pStr)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}
}

module.exports = PictSectionConnectionForm;
module.exports.default_configuration = _DefaultConfiguration;
