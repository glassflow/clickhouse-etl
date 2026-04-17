export enum PipelineVersion {
  V1 = 'v1',
  V2 = 'v2',
  V3 = 'v3',
  V3_NEXT = 'v3-next', // Prepared adapter for the upcoming sources[]/transforms[] format — not yet active
}

export const SUPPORTED_PIPELINE_VERSIONS = [PipelineVersion.V1, PipelineVersion.V2, PipelineVersion.V3]
export const LATEST_PIPELINE_VERSION = PipelineVersion.V3
