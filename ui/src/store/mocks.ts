// Mock data for KafkaConnection
const mockKafkaConnection = {
  authMethod: 'SASL/PLAIN',
  securityProtocol: 'SASL_PLAINTEXT',
  bootstrapServers: 'localhost:9092, localhost:9093, localhost:9094',
  isConnected: true,
  skipAuth: false,
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
  noAuth: {
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
  // Mock actions
  setKafkaAuthMethod: () => {},
  setKafkaSecurityProtocol: () => {},
  setKafkaBootstrapServers: () => {},
  setKafkaNoAuth: () => {},
  setKafkaSaslPlain: () => {},
  setKafkaSaslJaas: () => {},
  setKafkaSaslGssapi: () => {},
  setKafkaSaslOauthbearer: () => {},
  setKafkaSaslScram256: () => {},
  setKafkaSaslScram512: () => {},
  setKafkaAwsIam: () => {},
  setKafkaDelegationTokens: () => {},
  setKafkaLdap: () => {},
  setKafkaMtls: () => {},
  setKafkaTruststore: () => {},
  setKafkaConnection: () => {},
  setKafkaSkipAuth: () => {},
  setIsConnected: () => {},
  getIsKafkaConnectionDirty: () => false,
  resetKafkaStore: () => {},
}

// Mock data for ClickhouseConnector
const mockClickhouseConnector = {
  clickhouseConnection: {
    connectionType: 'direct',
    directConnection: {
      host: 'https://t6nh3rt60e.eu-central-1.aws.clickhouse.cloud',
      httpPort: '8443',
      username: 'default',
      password: 'SYEq_Q2KGWO.u',
      nativePort: '',
      useSSL: false,
      skipCertificateVerification: false,
    },
    connectionStatus: 'success',
    connectionError: null,
  },
  clickhouseMetadata: null,
  // Mock actions
  setClickhouseConnection: () => {},
  getIsClickhouseConnectionDirty: () => false,
  updateDatabases: () => {},
  updateTables: () => {},
  updateTableSchema: () => {},
  clearData: () => {},
  getDatabases: () => [],
  getTables: () => [],
  getTableSchema: () => [],
  getConnectionId: () => null,
}

// Mock data for ClickhouseDestination
const mockClickhouseDestination = {
  clickhouseDestination: {
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
    maxBatchSize: 1000,
    maxDelayTime: 1,
    maxDelayTimeUnit: 'm',
  },
  // Mock actions
  setClickhouseDestination: () => {},
  resetDestinationState: () => {},
  getIsDestinationMappingDirty: () => false,
}

// Mock data for TopicsStore (updated to remove deduplication)
const mockTopicsStore = {
  availableTopics: ['transactions', 'credit_card_1_transactions', '__consumer_offsets'],
  topicCount: 1,
  topics: {
    '0': {
      index: 0,
      name: 'credit_card_1_transactions',
      initialOffset: 'latest',
      replicaCount: 3,
      partitionCount: 3,
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
    },
  },
  // Mock actions
  updateTopic: () => {},
  invalidateTopicDependentState: () => {},
  resetTopicsStore: () => {},
  markAsValid: () => {},
  markAsInvalidated: () => {},
  getTopic: (index: number) => mockTopicsStore.topics[index.toString() as keyof typeof mockTopicsStore.topics],
  getEvent: () => null,
  validation: { isValid: true, isInvalidated: false },
}

// Mock data for DeduplicationStore (new separated store)
const mockDeduplicationStore = {
  deduplicationConfigs: {
    '0': {
      enabled: true,
      window: 5,
      unit: 'minutes',
      key: 'booking_date',
      keyType: 'string',
    },
  },
  // Mock actions
  updateDeduplication: () => {},
  invalidateDeduplication: () => {},
  getDeduplication: (index: number) =>
    mockDeduplicationStore.deduplicationConfigs[
      index.toString() as keyof typeof mockDeduplicationStore.deduplicationConfigs
    ],
  validation: { isValid: true, isInvalidated: false },
}

// Mock data for OperationsSelected
const mockOperationsSelected = {
  operation: 'deduplication',
}

// Mock data for JoinConfig
const mockJoinConfig = {
  enabled: false,
  type: 'temporal',
  streams: [],
  // Mock actions
  setEnabled: () => {},
  setType: () => {},
  setStreams: () => {},
  getIsJoinDirty: () => false,
  resetJoinStore: () => {},
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

// Mock data for steps store
const mockStepsStore = {
  activeStep: mockWizardState.activeStep,
  completedSteps: mockWizardState.completedSteps,
  editingStep: mockWizardState.editingStep,
  // Mock actions
  setActiveStep: () => {},
  setCompletedSteps: () => {},
  addCompletedStep: () => {},
  removeCompletedStepsAfter: () => {},
  setEditingStep: () => {},
  resetStepsStore: () => {},
}

// Combined mock data object
const mockData = {
  kafkaStore: mockKafkaConnection,
  clickhouseConnectionStore: mockClickhouseConnector,
  clickhouseDestinationStore: mockClickhouseDestination,
  topicsStore: mockTopicsStore,
  deduplicationStore: mockDeduplicationStore,
  coreStore: {
    pipelineId: '',
    pipelineName: '',
    operationsSelected: mockOperationsSelected,
    outboundEventPreview: mockOutboundEventPreview,
    analyticsConsent: false,
    consentAnswered: false,
    isDirty: false,
    apiConfig: {},
    // Mock actions (these will be overridden by the actual slice)
    setPipelineId: () => {},
    setPipelineName: () => {},
    setOperationsSelected: () => {},
    setOutboundEventPreview: () => {},
    setAnalyticsConsent: () => {},
    setConsentAnswered: () => {},
    markAsDirty: () => {},
    markAsClean: () => {},
    setApiConfig: () => {},
    resetPipelineState: () => {},
  },
  joinStore: mockJoinConfig,
  stepsStore: mockStepsStore,
}

export default mockData
