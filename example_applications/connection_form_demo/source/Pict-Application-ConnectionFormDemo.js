/**
 * Connection Form Demo — Pict Application
 *
 * Standalone demo for pict-section-connection-form.  Mirrors the
 * production wiring (lab + databeacon + facto + datacloner) without a
 * server — the schemas come from a hardcoded fixture below so the demo
 * runs as a single-page bundle.
 *
 * Usage:
 *   cd example_applications/connection_form_demo
 *   npm install
 *   npm run build      # quack build + copy
 *   open dist/index.html
 */
'use strict';

const libPictApplication = require('pict-application');

const libPictSectionConnectionForm = require('pict-section-connection-form');
const libViewLayout = require('./views/PictView-ConnectionFormDemo-Layout.js');

// ───────────────────────────────────────────────────────────────────────
//  Hardcoded schemas — same shape that meadow-connection-manager's
//  getAllProviderFormSchemas() emits at runtime, so the demo exercises
//  the exact contract production hosts use.  Keeping them inline here
//  means the demo doesn't need a backing server.
// ───────────────────────────────────────────────────────────────────────

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
	{
		Provider:    'PostgreSQL',
		DisplayName: 'PostgreSQL',
		Description: 'Connect to a PostgreSQL server.',
		Fields:
		[
			{ Name: 'host',     Label: 'Host',                  Type: 'String',   Default: '127.0.0.1', Required: true },
			{ Name: 'port',     Label: 'Port',                  Type: 'Number',   Default: 5432,        Required: true, Min: 1, Max: 65535 },
			{ Name: 'user',     Label: 'User',                  Type: 'String',   Default: 'postgres',  Required: true },
			{ Name: 'password', Label: 'Password',              Type: 'Password' },
			{ Name: 'database', Label: 'Database',              Type: 'String',   Placeholder: 'meadow_clone' },
			{ Name: 'max',      Label: 'Connection Pool Limit', Type: 'Number',   Default: 10, Min: 1, Group: 'Advanced' }
		]
	},
	{
		Provider:    'MSSQL',
		DisplayName: 'MSSQL',
		Description: 'Microsoft SQL Server — exercises all advanced schema features.',
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
	},
	{
		Provider:    'Solr',
		DisplayName: 'Solr',
		Description: 'Apache Solr — exercises the Boolean field type.',
		Fields:
		[
			{ Name: 'host',   Label: 'Host',      Type: 'String',  Default: 'localhost', Required: true },
			{ Name: 'port',   Label: 'Port',      Type: 'Number',  Default: 8983,        Required: true, Min: 1, Max: 65535 },
			{ Name: 'core',   Label: 'Core',      Type: 'String',  Default: 'default',   Required: true },
			{ Name: 'path',   Label: 'Path',      Type: 'String',  Default: '/solr',     Required: true },
			{ Name: 'secure', Label: 'Use HTTPS', Type: 'Boolean' }
		]
	}
];

class PictApplicationConnectionFormDemo extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		// Register the layout view first.
		this.pict.addView('ConnectionFormDemo-Layout',
			libViewLayout.default_configuration, libViewLayout);

		// Register the shared schema-driven connection form.  We point
		// it at the slot the layout view exposes.  The OnProviderChange
		// callback flows back into the layout's status line so users
		// see the event fire when they switch providers.
		let tmpSelf = this;
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
	}

	onAfterInitializeAsync(fCallback)
	{
		// Stash the demo schemas in AppData so the layout view can read
		// them out and hand them to the shared form during onAfterRender.
		this.pict.AppData.ConnectionFormDemo =
			{
				Schemas:        DEMO_SCHEMAS,
				ActiveProvider: ''
			};

		// Make pict available for inline onclick handlers in the layout
		// template.
		if (typeof(window) !== 'undefined') { window.pict = this.pict; }

		// Render the layout — its onAfterRender pumps the schemas into
		// the shared form, which then renders into #demo-form-slot.
		this.pict.views['ConnectionFormDemo-Layout'].render();

		return super.onAfterInitializeAsync(fCallback);
	}
}

module.exports = PictApplicationConnectionFormDemo;

module.exports.default_configuration =
{
	Name: 'ConnectionFormDemoExample',
	Hash: 'ConnectionFormDemoExample'
};
