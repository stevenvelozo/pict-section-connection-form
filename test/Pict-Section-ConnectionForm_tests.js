/**
 * Unit tests for pict-section-connection-form.
 *
 * Three layers exercised:
 *   1. Module exports + default configuration
 *   2. Pure-data helpers (DOM-id derivation, schema field shape contract)
 *   3. End-to-end rendering + collection inside a real Pict instance
 *      with a jsdom-backed DOM (via browser-env).  Each provider type
 *      (String / Number / Password / Boolean / Path / Select) is
 *      exercised, plus the MSSQL-style Multiplier + MapTo + OmitIfFalsy
 *      knobs that justify the schema's existence.
 *
 * @license MIT
 * @author <steven@velozo.com>
 */
'use strict';

// Inline jsdom shim — replaces `browser-env` which dragged in a
// deprecated `request` chain (and with it tough-cookie / form-data /
// uuid / qs CVE noise from `npm audit`).  Direct jsdom@25 has none of
// those transitives.  We expose only the globals our tests touch
// (window, document) and skip `navigator`/`HTMLElement` because Node 22+
// already defines them as non-writable globals.
const { JSDOM } = require('jsdom');
const _DOM = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
global.window = _DOM.window;
global.document = _DOM.window.document;

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');
const libPictSectionConnectionForm = require('../source/Pict-Section-ConnectionForm.js');

// ─────────────────────────────────────────────────────────────────────
//  Test helpers — synthetic schemas, minimal Pict factory, slot mount
// ─────────────────────────────────────────────────────────────────────

const SQLITE_SCHEMA =
{
	Provider:    'SQLite',
	DisplayName: 'SQLite',
	Description: 'Open or create a local SQLite database file.',
	Fields:
	[
		{ Name: 'SQLiteFilePath', Label: 'SQLite File Path', Type: 'Path', Default: '~/foo.sqlite', Required: true, Placeholder: '~/foo.sqlite', Help: 'Tilde expands.' }
	]
};

const MYSQL_SCHEMA =
{
	Provider:    'MySQL',
	DisplayName: 'MySQL',
	Description: 'Connect to a MySQL or MariaDB server.',
	Fields:
	[
		{ Name: 'host',            Label: 'Server',           Type: 'String',   Default: '127.0.0.1', Required: true },
		{ Name: 'port',            Label: 'Port',             Type: 'Number',   Default: 3306,        Required: true, Min: 1, Max: 65535 },
		{ Name: 'user',            Label: 'User',             Type: 'String',   Default: 'root' },
		{ Name: 'password',        Label: 'Password',         Type: 'Password' },
		{ Name: 'database',        Label: 'Database',         Type: 'String' },
		{ Name: 'connectionLimit', Label: 'Connection Limit', Type: 'Number',   Default: 20, Group: 'Advanced' }
	]
};

const MSSQL_SCHEMA =
{
	Provider:    'MSSQL',
	DisplayName: 'MSSQL',
	Description: 'Connect to a Microsoft SQL Server instance.',
	Fields:
	[
		{ Name: 'server',           Label: 'Server',           Type: 'String',   Default: '127.0.0.1', Required: true },
		{ Name: 'port',             Label: 'Port',             Type: 'Number',   Default: 1433,        Required: true },
		{ Name: 'user',             Label: 'User',             Type: 'String',   Default: 'sa' },
		{ Name: 'password',         Label: 'Password',         Type: 'Password' },
		{ Name: 'LegacyPagination', Label: 'Legacy Pagination', Type: 'Boolean' },
		{ Name: 'RequestTimeoutMs', Label: 'Request timeout (sec)', Type: 'Number', Default: 120, Multiplier: 1000, OmitIfFalsy: true, Group: 'Advanced' },
		{
			Name:        'RetryInitialDelaySec',
			Label:       'Retry initial delay (sec)',
			Type:        'Number',
			Default:     3,
			Multiplier:  1000,
			MapTo:       [ 'ConnectRetryOptions.InitialDelayMs', 'DDLRetryOptions.InitialDelayMs' ],
			OmitIfFalsy: true,
			Group:       'Advanced'
		}
	]
};

const SELECT_SCHEMA =
{
	Provider:    'WidgetEngine',
	DisplayName: 'Widget Engine',
	Description: 'Hypothetical engine to exercise the Select field type.',
	Fields:
	[
		{
			Name:    'Edition',
			Label:   'Edition',
			Type:    'Select',
			Default: 'Developer',
			Options:
			[
				{ Value: 'Developer', Label: 'Developer' },
				{ Value: 'Express',   Label: 'Express' },
				{ Value: 'Enterprise', Label: 'Enterprise' }
			]
		}
	]
};

/**
 * Build a Pict instance with a known DOM slot the view can render into.
 * Returns { pict, view } so each test can mount + drive the view.
 */
function mountView(pOptions)
{
	// Reset DOM between tests so id collisions don't leak.
	document.body.innerHTML = '<div id="test-form-slot"></div>';

	let tmpPict = new libPict({ LogStreams: [{ loggertype: 'console', streamtype: 'console', level: 'error' }] });

	let tmpOptions = Object.assign({},
		libPictSectionConnectionForm.default_configuration,
		{
			ContainerSelector:         '#test-form-slot',
			DefaultDestinationAddress: '#test-form-slot',
			SchemasAddress:            'AppData.Test.Schemas',
			ActiveAddress:             'AppData.Test.ActiveProvider',
			FieldIDPrefix:             'test-conn'
		},
		pOptions || {});

	tmpPict.addView('PictSection-ConnectionForm', tmpOptions, libPictSectionConnectionForm);
	let tmpView = tmpPict.views['PictSection-ConnectionForm'];
	return { pict: tmpPict, view: tmpView };
}

// ─────────────────────────────────────────────────────────────────────
//  Module-level tests
// ─────────────────────────────────────────────────────────────────────

suite('pict-section-connection-form', () =>
{
	suite('Module exports', () =>
	{
		test('exports a class', () =>
		{
			Expect(typeof(libPictSectionConnectionForm)).to.equal('function');
		});

		test('exports a default_configuration object', () =>
		{
			Expect(libPictSectionConnectionForm.default_configuration).to.be.an('object');
			Expect(libPictSectionConnectionForm.default_configuration.ViewIdentifier).to.equal('PictSection-ConnectionForm');
		});

		test('default_configuration has the host-overridable knobs', () =>
		{
			let tmpDC = libPictSectionConnectionForm.default_configuration;
			Expect(tmpDC).to.have.property('SchemasAddress');
			Expect(tmpDC).to.have.property('ActiveAddress');
			Expect(tmpDC).to.have.property('FieldIDPrefix');
			Expect(tmpDC).to.have.property('ShowProviderSelect');
			Expect(tmpDC).to.have.property('ShowAdvancedToggle');
		});
	});

	// ─────────────────────────────────────────────────────────────
	//  DOM-id helper
	// ─────────────────────────────────────────────────────────────

	suite('fieldDOMId()', () =>
	{
		test('namespaces by lower-cased provider + replaces dots with underscores', () =>
		{
			let { view } = mountView();
			Expect(view.fieldDOMId('MySQL', 'host')).to.equal('test-conn-mysql-host');
			Expect(view.fieldDOMId('MSSQL', 'ConnectRetryOptions.MaxAttempts')).to.equal('test-conn-mssql-ConnectRetryOptions_MaxAttempts');
			Expect(view.fieldDOMId('SQLite', 'SQLiteFilePath')).to.equal('test-conn-sqlite-SQLiteFilePath');
		});

		test('honors a host-supplied FieldIDPrefix', () =>
		{
			let { view } = mountView({ FieldIDPrefix: 'foo' });
			Expect(view.fieldDOMId('MySQL', 'host')).to.equal('foo-mysql-host');
		});
	});

	// ─────────────────────────────────────────────────────────────
	//  Render path
	// ─────────────────────────────────────────────────────────────

	suite('setSchemas() rendering', () =>
	{
		test('renders an empty-state notice when no schemas are present', () =>
		{
			let { view } = mountView();
			view.setSchemas([]);
			let tmpNotice = document.querySelector('.pict-conn-form__no-schemas');
			Expect(tmpNotice, 'expected an empty-state notice').to.exist;
		});

		test('renders the provider <select> with one option per schema', () =>
		{
			let { view } = mountView();
			view.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			let tmpSelect = document.getElementById('test-conn-provider-select');
			Expect(tmpSelect, 'expected the provider <select>').to.exist;
			Expect(tmpSelect.children.length).to.equal(2);
			Expect(tmpSelect.children[0].value).to.equal('SQLite');
			Expect(tmpSelect.children[1].value).to.equal('MySQL');
		});

		test('hides the provider <select> when ShowProviderSelect=false', () =>
		{
			let { view } = mountView({ ShowProviderSelect: false });
			view.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			let tmpSelect = document.getElementById('test-conn-provider-select');
			Expect(tmpSelect).to.be.null;
		});

		test('renders one form wrapper per schema (active visible, others hidden)', () =>
		{
			let { view } = mountView();
			view.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			let tmpSQLiteForm = document.getElementById('test-conn-form-sqlite');
			let tmpMySQLForm  = document.getElementById('test-conn-form-mysql');
			Expect(tmpSQLiteForm).to.exist;
			Expect(tmpMySQLForm).to.exist;
			Expect(tmpSQLiteForm.style.display).to.equal('');         // active
			Expect(tmpMySQLForm.style.display).to.equal('none');      // inactive
		});

		test('inputs reflect Default values on first render', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MYSQL_SCHEMA ]);
			Expect(document.getElementById('test-conn-mysql-host').value).to.equal('127.0.0.1');
			Expect(document.getElementById('test-conn-mysql-port').value).to.equal('3306');
			Expect(document.getElementById('test-conn-mysql-user').value).to.equal('root');
			// Password fields don't inherit Default by design (avoids leaking placeholders into pw inputs).
			Expect(document.getElementById('test-conn-mysql-password').value).to.equal('');
		});

		test('renders Boolean fields as checkboxes', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MSSQL_SCHEMA ]);
			let tmpEl = document.getElementById('test-conn-mssql-LegacyPagination');
			Expect(tmpEl, 'expected LegacyPagination checkbox').to.exist;
			Expect(tmpEl.type).to.equal('checkbox');
		});

		test('renders Select fields with all Options', () =>
		{
			let { view } = mountView();
			view.setSchemas([ SELECT_SCHEMA ]);
			let tmpEl = document.getElementById('test-conn-widgetengine-Edition');
			Expect(tmpEl, 'expected Edition <select>').to.exist;
			Expect(tmpEl.tagName.toLowerCase()).to.equal('select');
			Expect(tmpEl.children.length).to.equal(3);
			Expect(tmpEl.value).to.equal('Developer');
		});

		test('Advanced fields land inside a <details> when ShowAdvancedToggle=true', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MYSQL_SCHEMA ]);
			let tmpDetails = document.querySelector('#test-conn-form-mysql .pict-conn-form__advanced');
			Expect(tmpDetails, 'expected <details> wrapping advanced fields').to.exist;
			// connectionLimit lives inside Advanced
			let tmpAdvField = tmpDetails.querySelector('#test-conn-mysql-connectionLimit');
			Expect(tmpAdvField, 'expected connectionLimit input inside Advanced').to.exist;
		});

		test('Help text renders when a field declares Help', () =>
		{
			let { view } = mountView();
			view.setSchemas([ SQLITE_SCHEMA ]);
			let tmpHelp = document.querySelector('#test-conn-form-sqlite .pict-conn-form__field-help');
			Expect(tmpHelp, 'expected help text under SQLiteFilePath').to.exist;
			Expect(tmpHelp.textContent).to.contain('Tilde expands');
		});
	});

	// ─────────────────────────────────────────────────────────────
	//  setActiveProvider
	// ─────────────────────────────────────────────────────────────

	suite('setActiveProvider()', () =>
	{
		test('toggles per-schema form visibility', () =>
		{
			let { view } = mountView();
			view.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			view.setActiveProvider('MySQL');
			Expect(document.getElementById('test-conn-form-sqlite').style.display).to.equal('none');
			Expect(document.getElementById('test-conn-form-mysql').style.display).to.equal('');
		});

		test('invokes OnProviderChange callback with the new provider', () =>
		{
			let tmpCalls = [];
			let { view } = mountView({ OnProviderChange: (p) => tmpCalls.push(p) });
			view.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			view.setActiveProvider('MySQL');
			Expect(tmpCalls).to.deep.equal([ 'MySQL' ]);
		});

		test('getActiveProvider returns the most recent value', () =>
		{
			let { view } = mountView();
			view.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			view.setActiveProvider('MySQL');
			Expect(view.getActiveProvider()).to.equal('MySQL');
		});
	});

	// ─────────────────────────────────────────────────────────────
	//  getProviderConfig — the actual reason this view exists
	// ─────────────────────────────────────────────────────────────

	suite('getProviderConfig()', () =>
	{
		test('returns Defaults when no edits are made (MySQL)', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MYSQL_SCHEMA ]);
			let tmpResult = view.getProviderConfig();
			Expect(tmpResult.Provider).to.equal('MySQL');
			Expect(tmpResult.Config.host).to.equal('127.0.0.1');
			Expect(tmpResult.Config.port).to.equal(3306);
			Expect(tmpResult.Config.user).to.equal('root');
			Expect(tmpResult.Config.connectionLimit).to.equal(20);
		});

		test('reflects user edits to text + number inputs', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MYSQL_SCHEMA ]);
			document.getElementById('test-conn-mysql-host').value = '10.0.0.5';
			document.getElementById('test-conn-mysql-port').value = '13306';
			document.getElementById('test-conn-mysql-password').value = 'hunter2';
			let tmpResult = view.getProviderConfig();
			Expect(tmpResult.Config.host).to.equal('10.0.0.5');
			Expect(tmpResult.Config.port).to.equal(13306);
			Expect(tmpResult.Config.password).to.equal('hunter2');
		});

		test('reads Boolean fields from .checked', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MSSQL_SCHEMA ]);
			document.getElementById('test-conn-mssql-LegacyPagination').checked = true;
			let tmpResult = view.getProviderConfig();
			Expect(tmpResult.Config.LegacyPagination).to.equal(true);
		});

		test('applies Multiplier to numeric fields', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MSSQL_SCHEMA ]);
			// Default 120 sec → 120000 ms after Multiplier
			let tmpResult = view.getProviderConfig();
			Expect(tmpResult.Config.RequestTimeoutMs).to.equal(120000);
		});

		test('honors OmitIfFalsy when a Number input is zero', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MSSQL_SCHEMA ]);
			document.getElementById('test-conn-mssql-RequestTimeoutMs').value = '0';
			let tmpResult = view.getProviderConfig();
			Expect(tmpResult.Config).to.not.have.property('RequestTimeoutMs');
		});

		test('MapTo writes the value to every dotted-path target with Multiplier', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MSSQL_SCHEMA ]);
			// Default 3 sec → 3000 ms in BOTH ConnectRetryOptions and DDLRetryOptions
			let tmpResult = view.getProviderConfig();
			Expect(tmpResult.Config.ConnectRetryOptions).to.deep.equal({ InitialDelayMs: 3000 });
			Expect(tmpResult.Config.DDLRetryOptions).to.deep.equal({ InitialDelayMs: 3000 });
		});

		test('returns the active provider, not the first schema', () =>
		{
			let { view } = mountView();
			view.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			view.setActiveProvider('MySQL');
			Expect(view.getProviderConfig().Provider).to.equal('MySQL');
		});

		test('Select field value flows through to the config', () =>
		{
			let { view } = mountView();
			view.setSchemas([ SELECT_SCHEMA ]);
			document.getElementById('test-conn-widgetengine-Edition').value = 'Express';
			let tmpResult = view.getProviderConfig();
			Expect(tmpResult.Config.Edition).to.equal('Express');
		});
	});

	// ─────────────────────────────────────────────────────────────
	//  setValues — populating from a saved blob (edit workflows)
	// ─────────────────────────────────────────────────────────────

	suite('setValues()', () =>
	{
		test('populates basic fields and switches active provider', () =>
		{
			let { view } = mountView();
			view.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			view.setValues('MySQL', { host: '10.0.0.5', port: 13306, user: 'admin', database: 'analytics' });

			Expect(view.getActiveProvider()).to.equal('MySQL');
			Expect(document.getElementById('test-conn-mysql-host').value).to.equal('10.0.0.5');
			Expect(document.getElementById('test-conn-mysql-port').value).to.equal('13306');
			Expect(document.getElementById('test-conn-mysql-user').value).to.equal('admin');
			Expect(document.getElementById('test-conn-mysql-database').value).to.equal('analytics');
		});

		test('reverse-applies Multiplier (storage ms → display sec)', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MSSQL_SCHEMA ]);
			view.setValues('MSSQL', { RequestTimeoutMs: 90000 });
			Expect(document.getElementById('test-conn-mssql-RequestTimeoutMs').value).to.equal('90');
		});

		test('reads MapTo fields via the first dotted-path target', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MSSQL_SCHEMA ]);
			view.setValues('MSSQL', { ConnectRetryOptions: { InitialDelayMs: 5000 } });
			Expect(document.getElementById('test-conn-mssql-RetryInitialDelaySec').value).to.equal('5');
		});

		test('Boolean values land on .checked, not .value', () =>
		{
			let { view } = mountView();
			view.setSchemas([ MSSQL_SCHEMA ]);
			view.setValues('MSSQL', { LegacyPagination: true });
			Expect(document.getElementById('test-conn-mssql-LegacyPagination').checked).to.equal(true);
		});
	});

	// ─────────────────────────────────────────────────────────────
	//  clear()
	// ─────────────────────────────────────────────────────────────

	suite('clear()', () =>
	{
		test('resets the active provider to the first schema and re-renders defaults', () =>
		{
			let { view } = mountView();
			view.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			view.setActiveProvider('MySQL');
			document.getElementById('test-conn-mysql-host').value = 'edited';

			view.clear();

			Expect(view.getActiveProvider()).to.equal('SQLite');
			Expect(document.getElementById('test-conn-mysql-host').value).to.equal('127.0.0.1');
		});
	});

	// ─────────────────────────────────────────────────────────────
	//  AppData round-trip
	// ─────────────────────────────────────────────────────────────

	suite('AppData wiring', () =>
	{
		test('mirrors Schemas + ActiveProvider into the host-configured AppData addresses', () =>
		{
			let { pict, view } = mountView();
			view.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			view.setActiveProvider('MySQL');

			Expect(pict.AppData.Test).to.be.an('object');
			Expect(pict.AppData.Test.Schemas).to.have.length(2);
			Expect(pict.AppData.Test.ActiveProvider).to.equal('MySQL');
		});
	});
});
