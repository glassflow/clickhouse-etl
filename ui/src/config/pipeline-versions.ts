export enum PipelineVersion {
  V1 = 'v1',
  V2 = 'v2',
  V3 = 'v3',
}

export const SUPPORTED_PIPELINE_VERSIONS = [PipelineVersion.V1, PipelineVersion.V2, PipelineVersion.V3]
export const LATEST_PIPELINE_VERSION = PipelineVersion.V3
