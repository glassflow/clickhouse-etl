export enum PipelineVersion {
  V1 = 'v1', // Updated to match actual version strings in JSON
  V2 = 'v2', // Hypothetical V2 version string based on requirement (or use "2.0.0" if explicit)
}

// Map "v1" etc to 1.0.0 if needed, but for now assuming direct values
// Actually, looking at the JSON "version": "1.0.0", we should probably use strict strings

export const SUPPORTED_PIPELINE_VERSIONS = [PipelineVersion.V1, PipelineVersion.V2]
export const LATEST_PIPELINE_VERSION = PipelineVersion.V2
