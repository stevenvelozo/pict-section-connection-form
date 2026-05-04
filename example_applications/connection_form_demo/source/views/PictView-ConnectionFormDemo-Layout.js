/**
 * Connection Form Demo — Layout view
 *
 * Renders the demo shell: a card containing an explanation, a slot for
 * the shared connection form, action buttons, and a JSON output block
 * that shows the live result of getProviderConfig().
 *
 * The layout view doesn't own any schema knowledge — that's all handled
 * by pict-section-connection-form, which renders into our `#demo-form-slot`.
 */
'use strict';

const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier:            'ConnectionFormDemo-Layout',
	DefaultRenderable:         'ConnectionFormDemo-Layout',
	DefaultDestinationAddress: '#ConnectionFormDemo-Application-Container',

	Templates:
	[
		{
			Hash: 'ConnectionFormDemo-Layout',
			Template: /*html*/`
<div class="demo-card">
	<h2>Connection Form Demo</h2>
	<p>
		Renders the shared schema-driven connection form against a hardcoded
		set of provider schemas (no server needed).  Pick a provider, fill in
		fields, and click "Read config" to see the canonical wire-format
		payload that <code>getProviderConfig()</code> would emit.  The MSSQL
		schema exercises every advanced feature: <code>Multiplier</code> for
		sec→ms conversion, <code>MapTo</code> for one-input-many-targets
		retry config, and <code>OmitIfFalsy</code> so unset fields drop out.
	</p>

	<div class="demo-section-heading">Schema-driven form</div>
	<div id="demo-form-slot"></div>

	<div class="demo-actions">
		<button class="demo-btn" onclick="{~P~}.views['ConnectionFormDemo-Layout'].readConfig()">Read config</button>
		<button class="demo-btn secondary" onclick="{~P~}.views['ConnectionFormDemo-Layout'].applyMySQLExample()">Set MySQL example</button>
		<button class="demo-btn secondary" onclick="{~P~}.views['ConnectionFormDemo-Layout'].applyMSSQLExample()">Set MSSQL example</button>
		<button class="demo-btn danger" onclick="{~P~}.views['ConnectionFormDemo-Layout'].clearForm()">Clear</button>
	</div>

	<div class="demo-section-heading">Status</div>
	<div class="demo-status" id="demo-status">Idle.</div>

	<div class="demo-section-heading">Live config</div>
	<pre class="demo-output" id="demo-output">(click "Read config" to populate)</pre>
</div>`
		}
	],

	Renderables:
	[
		{
			RenderableHash:            'ConnectionFormDemo-Layout',
			TemplateHash:              'ConnectionFormDemo-Layout',
			ContentDestinationAddress: '#ConnectionFormDemo-Application-Container',
			RenderMethod:              'replace'
		}
	]
};

class ConnectionFormDemoLayoutView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

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

	// ────────────────────────────────────────────────────────────
	//  Action button handlers
	// ────────────────────────────────────────────────────────────

	readConfig()
	{
		let tmpForm = this.pict.views['PictSection-ConnectionForm'];
		if (!tmpForm) { return; }
		let tmpResult = tmpForm.getProviderConfig();
		document.getElementById('demo-output').textContent = JSON.stringify(tmpResult, null, 2);
		this._setStatus(`Read config for ${tmpResult.Provider} (${Object.keys(tmpResult.Config).length} keys).`);
	}

	applyMySQLExample()
	{
		let tmpForm = this.pict.views['PictSection-ConnectionForm'];
		if (!tmpForm) { return; }
		tmpForm.setValues('MySQL',
			{
				host:            'warehouse.internal',
				port:            33306,
				user:            'analytics',
				password:        'super-secret',
				database:        'metrics',
				connectionLimit: 50
			});
		this._setStatus('Loaded MySQL example values.  Click "Read config" to verify.');
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
		this._setStatus('Loaded MSSQL example values (note Multiplier converts ms↔sec on display).');
	}

	clearForm()
	{
		let tmpForm = this.pict.views['PictSection-ConnectionForm'];
		if (!tmpForm) { return; }
		tmpForm.clear();
		document.getElementById('demo-output').textContent = '(click "Read config" to populate)';
		this._setStatus('Form cleared back to schema defaults.');
	}

	// ────────────────────────────────────────────────────────────
	//  OnProviderChange callback target — wired in
	//  Pict-Application-ConnectionFormDemo via the shared view's
	//  OnProviderChange option.
	// ────────────────────────────────────────────────────────────

	notifyProviderChange(pProvider)
	{
		this._setStatus(`Active provider changed to ${pProvider}.`);
	}

	_setStatus(pMessage)
	{
		let tmpEl = document.getElementById('demo-status');
		if (tmpEl) { tmpEl.textContent = pMessage; }
	}
}

module.exports = ConnectionFormDemoLayoutView;
module.exports.default_configuration = _ViewConfiguration;
