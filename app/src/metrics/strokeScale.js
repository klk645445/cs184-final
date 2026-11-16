import { lumaAt } from './image.js';

// Part B6: Stroke scale. The average spacing between strokes (hatch lines or halftone dots) in
// pixels. For a drawn look it should stay roughly constant as the camera moves towards and away
// from the model; run it along the "Dolly in and out" path.
//
//   frame: a captured frame (see Pipeline.capture())
// Returns the average spacing in pixels, or NaN if no strokes were found.
export function strokeSpacing(frame) {
	// TODO (Part B6): Threshold the luminance (lumaAt) into ink and paper, ignoring background
	// pixels (frame.depth == 0). Walk along every row (and every column, since hatching can be at
	// any angle) and record the distance between the starts of consecutive ink runs. Return the
	// mean (or median, which is more robust) distance.
	return NaN;
}
