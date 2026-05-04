/**
 * Default Pict-view configuration for PictSection-ConnectionForm.
 *
 * Host applications register the view with their own ContainerSelector
 * and field-id prefix (so multiple connection forms can coexist without
 * DOM-id collisions).  All other defaults live here.
 *
 * The host owns:
 *   - Where in the DOM the form lands (DefaultDestinationAddress / TargetSelector)
 *   - Where in AppData the schemas + active provider live (SchemasAddress / ActiveAddress)
 *   - The DOM-id prefix used to namespace per-field input ids (FieldIDPrefix)
 *   - Whether the provider <select> is visible at all (ShowProviderSelect)
 *   - Whether the "Advanced" <details> block is rendered (ShowAdvancedToggle)
 */
'use strict';

module.exports =
{
	ViewIdentifier:            'PictSection-ConnectionForm',
	DefaultRenderable:         'PictSection-ConnectionForm-Main',
	DefaultDestinationAddress: '#PictSection-ConnectionForm-Slot',

	AutoRender: false,

	// Host-overridable knobs
	SchemasAddress:     'AppData.Connection.Schemas',
	ActiveAddress:      'AppData.Connection.ActiveProvider',
	FieldIDPrefix:      'pict-conn',
	ShowProviderSelect: true,
	ShowAdvancedToggle: true
};
