export type Contexts = Record<string, string>

export type Event = {
  name: string
  key: string
  contexts?: Contexts
}

export type EventGroup = {
  [key: string]: Event
}

export const dictionary: EventGroup = {
  // View events - page navigation
  pageView: {
    name: 'Page View',
    key: 'pageView',
    contexts: {
      home: 'Home',
      pipelines: 'Pipelines',
      pipelineCreate: 'Pipeline Create',
      pipelineDetail: 'Pipeline Detail',
      documentation: 'Documentation',
      feedback: 'Feedback',
      blog: 'Blog',
    },
  },

  // User preference events
  userPreference: {
    name: 'User Preference',
    key: 'userPreference',
    contexts: {
      analyticsConsent: 'Analytics Consent',
      themeChanged: 'Theme Changed',
      satisfactionScore: 'Satisfaction Score',
    },
  },

  // Funnel events - tracks each step in the pipeline creation process
  funnel: {
    name: 'Funnel Step',
    key: 'funnel',
    contexts: {
      operationSelected: 'Operation Selected', // User selects data operation type
      kafkaConnectionStarted: 'Kafka Connection Started', // User starts entering Kafka connection details
      kafkaConnectionSuccess: 'Kafka Connection Success', // Kafka connection is successful
      kafkaConnectionFailed: 'Kafka Connection Failed', // Kafka connection failed
      topicSelected: 'Topic Selected', // Topic is selected
      eventReceived: 'Event Received', // Event from topic is received
      deduplicateKeyAdded: 'Deduplicate Key Added', // Deduplicate key is configured
      joinKeyAdded: 'Join Key Added', // Join key is configured
      clickhouseConnectionStarted: 'Clickhouse Connection Started', // User starts entering Clickhouse connection
      clickhouseConnectionSuccess: 'Clickhouse Connection Success', // Clickhouse connection successful
      clickhouseConnectionFailed: 'Clickhouse Connection Failed', // Clickhouse connection failed
      databaseSelected: 'Database Selected', // Database selected
      tableSelected: 'Table Selected', // Table selected
      eventsMapped: 'Events Mapped', // Events are mapped to destination
      deployClicked: 'Deploy Clicked', // Deploy button is clicked
      deploySuccess: 'Deploy Success', // Pipeline deployed successfully
      deployFailed: 'Deploy Failed', // Pipeline deployment failed
    },
  },

  // Pipeline events
  pipelineAction: {
    name: 'Pipeline Action',
    key: 'pipelineAction',
    contexts: {
      create: 'Create',
      delete: 'Delete',
      modify: 'Modify',
      deploy: 'Deploy',
      pause: 'Pause',
      resume: 'Resume',
    },
  },

  // Configuration events
  configurationAction: {
    name: 'Configuration Action',
    key: 'configurationAction',
    contexts: {
      save: 'Save',
      load: 'Load',
      delete: 'Delete',
      export: 'Export',
      import: 'Import',
    },
  },

  // Feature usage events
  featureUsage: {
    name: 'Feature Usage',
    key: 'featureUsage',
    contexts: {
      deduplication: 'Deduplication',
      joining: 'Joining',
      ingestOnly: 'Ingest Only',
      advancedMapping: 'Advanced Mapping',
      timeWindow: 'Time Window Configuration',
    },
  },

  // User engagement events
  engagement: {
    name: 'User Engagement',
    key: 'engagement',
    contexts: {
      sendFeedback: 'Send Feedback',
      viewDocumentation: 'View Documentation',
      shareLink: 'Share Link',
      downloadResource: 'Download Resource',
      joinWaitlist: 'Join Waitlist',
      contactSupport: 'Contact Support',
    },
  },

  // Error events
  errorOccurred: {
    name: 'Error Occurred',
    key: 'errorOccurred',
    contexts: {
      connection: 'Connection Error',
      validation: 'Validation Error',
      deployment: 'Deployment Error',
      runtime: 'Runtime Error',
      timeout: 'Timeout Error',
      authentication: 'Authentication Error',
    },
  },

  // Performance metrics
  performance: {
    name: 'Performance Metrics',
    key: 'performance',
    contexts: {
      pageLoadTime: 'Page Load Time',
      apiResponseTime: 'API Response Time',
      operationDuration: 'Operation Duration',
      renderTime: 'Render Time',
    },
  },
}
