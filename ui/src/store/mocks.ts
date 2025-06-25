// Mock data for KafkaConnection
const mockKafkaConnection = {
  authMethod: 'SASL/PLAIN',
  securityProtocol: 'SASL_PLAINTEXT',
  bootstrapServers: 'localhost:9092, localhost:9093, localhost:9094',
  isConnected: true,
  saslPlain: {
    username: 'admin',
    password: 'admin-secret',
    consumerGroup: 'default',
  },
  saslJaas: {
    jaasConfig: '',
  },
  saslGssapi: {
    kerberosPrincipal: '',
    kerberosKeytab: '',
  },
  saslOauthbearer: {
    oauthBearerToken: '',
  },
  saslScram256: {
    username: '',
    password: '',
    consumerGroup: '',
  },
  saslScram512: {
    username: '',
    password: '',
    consumerGroup: '',
  },
  awsIam: {
    awsAccessKey: '',
    awsAccessKeySecret: '',
    awsRegion: '',
    awsIAMRoleArn: '',
  },
  delegationTokens: {
    delegationToken: '',
  },
  ldap: {
    ldapServerUrl: '',
    ldapServerPort: '',
    ldapBaseDn: '',
    ldapBindDn: '',
    ldapBindPassword: '',
    ldapUserSearchFilter: '',
  },
  mtls: {
    clientCert: '',
    clientKey: '',
    password: '',
  },
  truststore: {
    location: '',
    password: '',
    type: '',
    algorithm: '',
    certificates: '',
  },
  delegationToken: {
    delegationToken: '',
  },
  trustStore: {
    location: '',
    password: '',
    type: '',
    algorithm: '',
    certificates: '',
  },
}

// Mock data for ClickhouseConnector
const mockClickhouseConnector = {
  host: 'https://t6nh3rt60e.eu-central-1.aws.clickhouse.cloud',
  port: '8443',
  username: 'default',
  password: 'SYEq_Q2KGWO.u',
  database: 'default',
  table: 'DE47100400000156459000_EUR_10_03_2025_1143',
  useSSL: false,
  connectionType: 'direct',
  proxyUrl: '',
  connectionString: '',
  connectionStatus: 'success',
  connectionError: null,
}

// Mock data for ClickhouseDestination
const mockClickhouseDestination = {
  scheme: '',
  database: 'default',
  table: 'DE47100400000156459000_EUR_10_03_2025_1143',
  destinationColumns: [
    {
      name: 'Bookind date',
      type: 'Date',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
    },
    {
      name: 'Value date',
      type: 'Date',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
    },
    {
      name: 'Transaction type',
      type: 'String',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
    },
    {
      name: 'Booking text',
      type: 'String',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
    },
    {
      name: 'Amount',
      type: 'Float32',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
    },
    {
      name: 'Currency',
      type: 'String',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
    },
    {
      name: 'Account IBAN',
      type: 'String',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
    },
    {
      name: 'Category',
      type: 'String',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
    },
  ],
  mapping: [
    {
      name: 'Bookind date',
      type: 'Date',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
      jsonType: 'string',
      isNullable: false,
      isKey: false,
      eventField: 'booking_date',
    },
    {
      name: 'Value date',
      type: 'Date',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
      jsonType: 'string',
      isNullable: false,
      isKey: false,
      eventField: 'transaction_type',
    },
    {
      name: 'Transaction type',
      type: 'String',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
      jsonType: 'string',
      isNullable: false,
      isKey: false,
      eventField: 'value_date',
    },
    {
      name: 'Booking text',
      type: 'String',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
      jsonType: 'number',
      isNullable: false,
      isKey: false,
      eventField: 'amount',
    },
    {
      name: 'Amount',
      type: 'Float32',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
      jsonType: 'string',
      isNullable: false,
      isKey: false,
      eventField: 'description',
    },
    {
      name: 'Currency',
      type: 'String',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
      jsonType: 'string',
      isNullable: false,
      isKey: false,
      eventField: '_metadata.offset',
    },
    {
      name: 'Account IBAN',
      type: 'String',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
      jsonType: 'string',
      isNullable: false,
      isKey: false,
      eventField: '_metadata.offset',
    },
    {
      name: 'Category',
      type: 'String',
      default_type: '',
      default_expression: '',
      comment: '',
      codec_expression: '',
      ttl_expression: '',
      jsonType: 'string',
      isNullable: false,
      isKey: false,
      eventField: '_metadata.timestamp',
    },
  ],
}

// Mock data for TopicsStore
const mockTopicsStore = {
  availableTopics: ['transactions', 'credit_card_1_transactions', '__consumer_offsets'],
  topicCount: 1,
  topics: {
    '0': {
      index: 0,
      name: 'credit_card_1_transactions',
      initialOffset: 'latest',
      events: [
        {
          event: {
            booking_date: '1970-01-01',
            value_date: '1970-01-01',
            transaction_type: 'Debit',
            description:
              'Commerzbank AG COMMERZBANK AG 5232249017093073 ABR ECHNUNG KREDITKARTE VOM 27.02.25 End-To-End Reference: 9440-8463529828357631-RD-2502272000 Mandate Reference: 100INH0002104832 ID Of Ordering Party: DE3810000000020140 SEPA-CORE-DIRECT DEBIT subsequent',
            amount: -507,
            currency: 'EUR',
            iban: 'DE47100400000156459000',
            category: 'Banking & Loans',
            _metadata: {
              topic: 'credit_card_1_transactions',
              partition: 0,
              offset: '0',
              timestamp: '1743086033817',
            },
            key: '1',
          },
          topicIndex: 0,
        },
      ],
      selectedEvent: {
        event: {
          booking_date: '1970-01-01',
          value_date: '1970-01-01',
          transaction_type: 'Debit',
          description:
            'Commerzbank AG COMMERZBANK AG 5232249017093073 ABR ECHNUNG KREDITKARTE VOM 27.02.25 End-To-End Reference: 9440-8463529828357631-RD-2502272000 Mandate Reference: 100INH0002104832 ID Of Ordering Party: DE3810000000020140 SEPA-CORE-DIRECT DEBIT subsequent',
          amount: -507,
          currency: 'EUR',
          iban: 'DE47100400000156459000',
          category: 'Banking & Loans',
          _metadata: {
            topic: 'credit_card_1_transactions',
            partition: 0,
            offset: '0',
            timestamp: '1743086033817',
          },
          key: '1',
        },
        topicIndex: 0,
      },
      deduplication: {
        enabled: true,
        index: 0,
        window: 5,
        unit: 'minutes',
        key: 'booking_date',
        keyType: 'string',
      },
    },
  },
}

// Mock data for OperationsSelected
const mockOperationsSelected = {
  operation: 'deduplication',
}

// Mock data for DeduplicationConfig
const mockDeduplicationConfig = {}

// Mock data for JoinConfig
const mockJoinConfig = {
  join: false,
  streams: [],
}

// Mock data for OutboundEventPreview
const mockOutboundEventPreview = {
  events: {},
}

// Mock data for wizard state
const mockWizardState = {
  activeStep: 'review-configuration',
  completedSteps: [
    'kafka-connection',
    'topic-selection',
    'deduplication-configurator',
    'clickhouse-connection',
    'clickhouse-mapper',
  ],
  editingStep: '',
}

// Combined mock data object
const mockData = {
  kafkaStore: mockKafkaConnection,
  clickhouseConnection: mockClickhouseConnector,
  clickhouseDestination: mockClickhouseDestination,
  topicsStore: mockTopicsStore,
  operationsSelected: mockOperationsSelected,
  deduplicationConfig: mockDeduplicationConfig,
  joinConfig: mockJoinConfig,
  outboundEventPreview: mockOutboundEventPreview,
  ...mockWizardState,
}

export default mockData
