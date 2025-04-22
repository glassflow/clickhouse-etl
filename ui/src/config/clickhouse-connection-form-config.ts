export const ClickhouseConnectionFormConfig = {
  directConnectionForm: {
    fields: {
      host: {
        name: 'directConnection.host',
        label: 'Host',
        placeholder: 'Enter host',
        required: 'Host is required',
        type: 'text',
      },
      port: {
        name: 'directConnection.port',
        label: 'Port',
        placeholder: 'Enter port',
        required: 'Port is required',
        type: 'text',
      },
      username: {
        name: 'directConnection.username',
        label: 'Username',
        placeholder: 'Enter username',
        required: 'Username is required',
        type: 'text',
      },
      password: {
        name: 'directConnection.password',
        label: 'Password',
        placeholder: 'Enter password',
        required: 'Password is required',
        type: 'password',
      },
      nativePort: {
        name: 'directConnection.nativePort',
        label: 'Native Port',
        placeholder: 'Enter native port',
        required: 'Native port is required',
        type: 'text',
      },
      useSSL: {
        name: 'directConnection.useSSL',
        label: 'Use SSL',
        type: 'boolean',
        defaultValue: true,
        placeholder: 'Use SSL',
      },
    },
  },
  proxyConnectionForm: {
    fields: {
      proxyUrl: {
        name: 'proxyConnection.proxyUrl',
        label: 'Proxy URL',
        placeholder: 'Enter proxy URL',
        required: 'Proxy URL is required',
        type: 'text',
      },
      proxyUsername: {
        name: 'proxyConnection.proxyUsername',
        label: 'Proxy Username',
        placeholder: 'Enter proxy username',
        required: 'Proxy username is required',
        type: 'text',
      },
      proxyPassword: {
        name: 'proxyConnection.proxyPassword',
        label: 'Proxy Password',
        placeholder: 'Enter proxy password',
        required: 'Proxy password is required',
        type: 'password',
      },
    },
  },
  connectionStringConnectionForm: {
    fields: {
      connectionString: {
        name: 'connectionStringConnection.connectionString',
        label: 'Connection String',
        placeholder: 'Enter connection string',
        required: 'Connection string is required',
        type: 'text',
      },
    },
  },
}
