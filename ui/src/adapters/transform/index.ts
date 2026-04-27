// Re-export all registry types and functions from the registry module
export type { TransformType, WireTransformConfig, TransformPlugin } from './registry'
export { registerTransformPlugin, getTransformPlugin, getAllTransformPlugins } from './registry'

// Import plugins to trigger registration on module load (must come after registry exports)
import './deduplication/plugin'
import './join/plugin'
import './filter/plugin'
import './stateless/plugin'
