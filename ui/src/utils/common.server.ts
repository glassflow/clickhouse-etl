// import { generateAuthToken } from 'aws-msk-iam-sasl-signer-js'
import { createMechanism } from '@jm18457/kafkajs-msk-iam-authentication-mechanism'

interface ClickhouseConnectionConfig {
  host: string
  port: string
  username: string
  password: string
  useSSL: boolean
  nativePort?: string
}
// export async function oauthBearerTokenProvider(region: string, accessKey: string, secretAccessKey: string) {
//   const authTokenResponse = await generateAuthToken({
//     region,
//   })
//   return {
//     value: authTokenResponse.token,
//   }
// }

export function createAwsIamMechanism(region: string, accessKey: string, secretAccessKey: string) {
  // Use the built-in mechanism creator
  const mechanism = createMechanism({
    region: region || '',
    // Pass credentials directly
    credentials: {
      accessKeyId: accessKey || '',
      secretAccessKey: secretAccessKey || '',
    },
  })

  return mechanism
}

export const generateHost = (connectionConfig: ClickhouseConnectionConfig) => {
  // Remove any existing protocol (http:// or https://) from the host
  const cleanHost = connectionConfig.host.replace(/^https?:\/\//, '')

  if (connectionConfig.useSSL) {
    return `https://${cleanHost}:${connectionConfig.port}`
  } else {
    return `http://${cleanHost}:${connectionConfig.port}`
  }
}

// export function createAwsIamMechanism(region: string, accessKey: string, secretAccessKey: string) {
//   // The authentication provider function must return a properly formatted payload
//   const getAuthenticationProvider = async () => {
//     // Create a formatted date string for AWS signature (ISO8601 format)
//     const date = new Date()
//     const formattedDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '')

//     // Configure AWS credentials
//     const credentials = {
//       accessKeyId: accessKey || '',
//       secretAccessKey: secretAccessKey || '',
//     }

//     // Set up the AWS signature
//     const signer = new SignatureV4({
//       credentials: credentials,
//       region: region || 'eu-central-1',
//       service: 'kafka',
//       sha256: Sha256,
//       applyChecksum: true,
//     })

//     // Create the request that will be signed
//     const request = new XMLHttpRequest()
//     request.open('GET', 'https://kafka.amazonaws.com/', true)
//     request.setRequestHeader('x-amz-date', formattedDate)
//     request.setRequestHeader('host', 'kafka.amazonaws.com')
//     // request.send()

//     // Sign the request
//     const signed = await signer.sign(request)

//     // Return the properly formatted authentication payload for AWS MSK IAM
//     return {
//       // Use the exact format AWS MSK IAM expects
//       authorizationIdentity: credentials.accessKeyId,
//       // Include the complete Authorization header as the authentication data
//       // This includes the AWS Signature v4
//       authorizationPayload: signed.headers.Authorization,
//     }
//   }
//   return mechanism
// }
