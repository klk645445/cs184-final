import { Style } from './Style.js';
import { ToonStyle } from './toon.js';
import { halftoneStyle } from './halftone.js';
import { hatchScreenStyle } from './hatchScreen.js';
import { HatchTAMStyle } from './hatchTAM.js';
import { posterizeStyle } from './posterize.js';
import { kuwaharaStyle } from './kuwahara.js';
import { WatercolorStyle } from './watercolor.js';

// Every style in the app, in the order they appear in the GUI. Construct a fresh list per app.
export function createStyles(tam) {
	return [
		new Style({ id: 'base', name: 'Base (Lambert)', track: 'Starter' }),
		new ToonStyle(),
		halftoneStyle(),
		hatchScreenStyle(),
		new HatchTAMStyle(tam),
		posterizeStyle(),
		kuwaharaStyle(),
		new WatercolorStyle(),
	];
}
