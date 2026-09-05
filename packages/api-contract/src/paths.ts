export const API_PREFIX = '/api/v1';
export const API_VERSION = 'v1';

export const OPERATIONAL_PATHS = {
  health: '/health',
  ready: '/ready',
} as const;

/**
 * Paths relative to {@link API_PREFIX}. Express routers mount these on the v1 router.
 * Auth routes are relative to {@link API_ROUTE_PATHS.auth.root}.
 */
export const API_ROUTE_PATHS = {
  root: '/',
  features: '/features',
  capabilities: '/capabilities',
  auth: {
    root: '/auth',
    register: '/register',
    login: '/login',
    refresh: '/refresh',
    logout: '/logout',
    me: '/me',
    otpRequest: '/otp/request',
    otpVerify: '/otp/verify',
    passwordResetRequest: '/password-reset/request',
    passwordResetConfirm: '/password-reset/confirm',
  },
  jobs: {
    byId: '/jobs/:jobId',
  },
  notifications: {
    root: '/notifications',
    unreadCount: '/notifications/unread-count',
    preferences: '/notifications/preferences',
    deliveriesById: '/notifications/deliveries/:id',
    send: '/notifications/send',
    create: '/notifications',
    readAll: '/notifications/read-all',
    read: '/notifications/:id/read',
  },
  automations: {
    catalog: '/automations/catalog',
    rules: '/automations/rules',
    ruleById: '/automations/rules/:id',
    validateRule: '/automations/rules/:id/validate',
    enableRule: '/automations/rules/:id/enable',
    disableRule: '/automations/rules/:id/disable',
    executions: '/automations/executions',
    executionById: '/automations/executions/:id',
    events: '/automations/events',
    webhooks: '/automations/webhooks',
  },
  copilot: {
    tools: '/copilot/tools',
    chat: '/copilot/chat',
    conversations: '/copilot/conversations',
    conversationById: '/copilot/conversations/:id',
    clearConversation: '/copilot/conversations/:id/clear',
  },
  intents: {
    root: '/intents',
    execute: '/intents/execute',
  },
  rag: {
    index: '/rag/index',
    documentById: '/rag/documents/:id',
    search: '/rag/search',
    ask: '/rag/ask',
  },
  search: {
    root: '/search',
    indexes: '/search/indexes',
    documents: '/search/documents',
    documentById: '/search/documents/:index/:documentId',
  },
  analytics: {
    kpis: '/analytics/kpis',
    dashboards: '/analytics/dashboards',
    dashboardById: '/analytics/dashboards/:name',
    query: '/analytics/query',
    export: '/analytics/export',
    facts: '/analytics/facts',
  },
  anomalies: {
    root: '/anomalies',
    evaluate: '/anomalies/evaluate',
    byId: '/anomalies/:id',
  },
  realtime: {
    events: '/realtime/events',
    channels: '/realtime/channels',
  },
  pdf: {
    generate: '/pdf/generate',
  },
  reports: {
    types: '/reports/types',
    generate: '/reports/generate',
  },
  files: {
    root: '/files',
    byId: '/files/:id',
    content: '/files/:id/content',
    signedUrl: '/files/:id/url',
  },
  storage: {
    download: '/storage/download',
  },
  problemIntelligence: {
    analyze: '/problem-intelligence/analyze',
  },
  capabilityRecommendations: {
    recommend: '/capability-recommendations/recommend',
  },
  projectPlanning: {
    analyze: '/project-planning/analyze',
    validate: '/project-planning/validate',
    approve: '/project-planning/approve',
  },
  projectGenerator: {
    preview: '/project-generator/preview',
    generate: '/project-generator/generate',
  },
} as const;

export function apiUrl(routePath: string): string {
  if (routePath === '/') {
    return API_PREFIX;
  }
  return `${API_PREFIX}${routePath}`;
}

function fillParam(template: string, token: string, value: string): string {
  return template.replace(token, encodeURIComponent(value));
}

function authUrl(routePath: string): string {
  return apiUrl(`${API_ROUTE_PATHS.auth.root}${routePath}`);
}

export const API_PATHS = {
  root: API_PREFIX,
  features: apiUrl(API_ROUTE_PATHS.features),
  capabilities: apiUrl(API_ROUTE_PATHS.capabilities),
  auth: {
    root: apiUrl(API_ROUTE_PATHS.auth.root),
    register: authUrl(API_ROUTE_PATHS.auth.register),
    login: authUrl(API_ROUTE_PATHS.auth.login),
    refresh: authUrl(API_ROUTE_PATHS.auth.refresh),
    logout: authUrl(API_ROUTE_PATHS.auth.logout),
    me: authUrl(API_ROUTE_PATHS.auth.me),
    otpRequest: authUrl(API_ROUTE_PATHS.auth.otpRequest),
    otpVerify: authUrl(API_ROUTE_PATHS.auth.otpVerify),
    passwordResetRequest: authUrl(API_ROUTE_PATHS.auth.passwordResetRequest),
    passwordResetConfirm: authUrl(API_ROUTE_PATHS.auth.passwordResetConfirm),
  },
  jobs: {
    byId: (jobId: string) => apiUrl(fillParam(API_ROUTE_PATHS.jobs.byId, ':jobId', jobId)),
  },
  notifications: {
    root: apiUrl(API_ROUTE_PATHS.notifications.root),
    unreadCount: apiUrl(API_ROUTE_PATHS.notifications.unreadCount),
    preferences: apiUrl(API_ROUTE_PATHS.notifications.preferences),
    send: apiUrl(API_ROUTE_PATHS.notifications.send),
    readAll: apiUrl(API_ROUTE_PATHS.notifications.readAll),
    read: (id: string) => apiUrl(fillParam(API_ROUTE_PATHS.notifications.read, ':id', id)),
  },
  automations: {
    catalog: apiUrl(API_ROUTE_PATHS.automations.catalog),
    rules: apiUrl(API_ROUTE_PATHS.automations.rules),
    enableRule: (id: string) => apiUrl(fillParam(API_ROUTE_PATHS.automations.enableRule, ':id', id)),
    disableRule: (id: string) => apiUrl(fillParam(API_ROUTE_PATHS.automations.disableRule, ':id', id)),
    events: apiUrl(API_ROUTE_PATHS.automations.events),
    executions: apiUrl(API_ROUTE_PATHS.automations.executions),
  },
  copilot: {
    chat: apiUrl(API_ROUTE_PATHS.copilot.chat),
    clearConversation: (id: string) =>
      apiUrl(fillParam(API_ROUTE_PATHS.copilot.clearConversation, ':id', id)),
  },
  intents: {
    root: apiUrl(API_ROUTE_PATHS.intents.root),
    execute: apiUrl(API_ROUTE_PATHS.intents.execute),
  },
  rag: {
    index: apiUrl(API_ROUTE_PATHS.rag.index),
    search: apiUrl(API_ROUTE_PATHS.rag.search),
    ask: apiUrl(API_ROUTE_PATHS.rag.ask),
  },
  search: {
    root: apiUrl(API_ROUTE_PATHS.search.root),
    indexes: apiUrl(API_ROUTE_PATHS.search.indexes),
    documents: apiUrl(API_ROUTE_PATHS.search.documents),
    documentById: (index: string, documentId: string) =>
      apiUrl(
        fillParam(fillParam(API_ROUTE_PATHS.search.documentById, ':index', index), ':documentId', documentId),
      ),
  },
  analytics: {
    kpis: apiUrl(API_ROUTE_PATHS.analytics.kpis),
    dashboards: apiUrl(API_ROUTE_PATHS.analytics.dashboards),
    dashboardById: (name: string) =>
      apiUrl(fillParam(API_ROUTE_PATHS.analytics.dashboardById, ':name', name)),
    query: apiUrl(API_ROUTE_PATHS.analytics.query),
    export: apiUrl(API_ROUTE_PATHS.analytics.export),
    facts: apiUrl(API_ROUTE_PATHS.analytics.facts),
  },
  anomalies: {
    root: apiUrl(API_ROUTE_PATHS.anomalies.root),
    evaluate: apiUrl(API_ROUTE_PATHS.anomalies.evaluate),
    byId: (id: string) => apiUrl(fillParam(API_ROUTE_PATHS.anomalies.byId, ':id', id)),
  },
  realtime: {
    events: apiUrl(API_ROUTE_PATHS.realtime.events),
    channels: apiUrl(API_ROUTE_PATHS.realtime.channels),
  },
  pdf: {
    generate: apiUrl(API_ROUTE_PATHS.pdf.generate),
  },
  reports: {
    types: apiUrl(API_ROUTE_PATHS.reports.types),
    generate: apiUrl(API_ROUTE_PATHS.reports.generate),
  },
  files: {
    byId: (id: string) => apiUrl(fillParam(API_ROUTE_PATHS.files.byId, ':id', id)),
    signedUrl: (id: string) => apiUrl(fillParam(API_ROUTE_PATHS.files.signedUrl, ':id', id)),
  },
  problemIntelligence: {
    analyze: apiUrl(API_ROUTE_PATHS.problemIntelligence.analyze),
  },
  capabilityRecommendations: {
    recommend: apiUrl(API_ROUTE_PATHS.capabilityRecommendations.recommend),
  },
  projectPlanning: {
    analyze: apiUrl(API_ROUTE_PATHS.projectPlanning.analyze),
    validate: apiUrl(API_ROUTE_PATHS.projectPlanning.validate),
    approve: apiUrl(API_ROUTE_PATHS.projectPlanning.approve),
  },
  projectGenerator: {
    preview: apiUrl(API_ROUTE_PATHS.projectGenerator.preview),
    generate: apiUrl(API_ROUTE_PATHS.projectGenerator.generate),
  },
} as const;
