import { datumsToSpherical } from './mapUtils'

// Convert coordinates to scene coordinates.
// Initially looking at Munich (10, 355, 545 is roughly 48.1351 N, 11.5820 E)
export const INITIAL_COORDS = datumsToSpherical(48.1351, 11.582)
