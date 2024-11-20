const getNodeEnv = () => {
  try {
    return process?.env?.NODE_ENV || 'development';
  } catch {
    return 'development';
  }
};

export const inDevEnvironment = getNodeEnv() === 'development';

export const baseUrl = inDevEnvironment 
  ? 'http://localhost:3000' 
  : 'https://my.aios.foundation';

// Use fixed server address
export const serverUrl = 'http://35.232.56.61:8000';

// Add agentApiUrl for agents endpoints
export const agentApiUrl = 'https://my.aios.foundation';

