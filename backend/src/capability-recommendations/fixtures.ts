import type { CapabilityRecommendationInput } from './types';

export function analysisSimpleSearch(): CapabilityRecommendationInput {
  return {
    problemSummary: 'Staff look up customer records by name in a logged-in web app.',
    spec: {
      problemSummary: 'Staff look up customer records by name in a logged-in web app.',
      entities: {
        determined: true,
        items: [{ name: 'Customer', fields: ['name', 'email'], description: 'Searchable by name.' }],
      },
      likelyDataRequirements: {
        determined: true,
        items: [{ name: 'customers table', description: 'Keyword search by name.' }],
      },
    },
    mappings: [
      {
        requirement: 'Users search customer records by name',
        category: 'data',
        existingCapability: 'database',
        newProblemLogic: 'unknown',
        confidence: 0.91,
        evidence: 'Simple keyword lookup, not meaning search.',
      },
      {
        requirement: 'Users must log in',
        category: 'security',
        existingCapability: 'auth',
        newProblemLogic: 'unknown',
        confidence: 0.94,
      },
    ],
  };
}

export function analysisSemanticSearch(): CapabilityRecommendationInput {
  return {
    problemSummary: 'Reviewers search uploaded policy documents by meaning using embeddings.',
    spec: {
      problemSummary: 'Reviewers search uploaded policy documents by meaning using embeddings.',
      documents: {
        determined: true,
        items: [{ name: 'Policy PDF', description: 'Untrusted document corpus.' }],
      },
      aiRequirements: {
        determined: true,
        items: [{ name: 'Semantic search', description: 'Find similar documents by embedding.' }],
      },
    },
    mappings: [
      {
        requirement: 'Semantic search over policy documents',
        category: 'ai',
        existingCapability: 'rag',
        newProblemLogic: 'unknown',
        confidence: 0.87,
        evidence: 'Search by meaning / vector similarity. pgvector was mentioned as a possible store.',
      },
    ],
  };
}

export function analysisLargeScaleSearch(): CapabilityRecommendationInput {
  return {
    problemSummary:
      'The product must run large-scale search over billions of documents with an Elasticsearch cluster.',
    spec: {
      problemSummary:
        'The product must run large-scale search over billions of documents with an Elasticsearch cluster.',
      likelyInfrastructureRequirements: {
        determined: true,
        items: [{ name: 'elasticsearch', description: 'Distributed search cluster.' }],
      },
    },
    mappings: [
      {
        requirement: 'Large-scale search across billions of documents',
        category: 'infrastructure',
        existingCapability: 'unknown',
        newProblemLogic: 'External search cluster is outside this kit.',
        confidence: 0.6,
        evidence: 'Elasticsearch was named in the statement.',
      },
    ],
  };
}

export function analysisBackgroundJobs(): CapabilityRecommendationInput {
  return {
    problemSummary: 'Generate PDFs in the background and send email asynchronously after a form submit.',
    spec: {
      problemSummary: 'Generate PDFs in the background and send email asynchronously after a form submit.',
      reports: {
        determined: true,
        items: [{ name: 'PDF summary', description: 'Rendered off the request path.' }],
      },
    },
    mappings: [
      {
        requirement: 'Background PDF generation and async email',
        category: 'automation',
        existingCapability: 'jobs',
        newProblemLogic: 'unknown',
        confidence: 0.9,
        evidence: 'Use the existing job queue, not a streaming broker.',
      },
    ],
  };
}

export function analysisEventStreaming(): CapabilityRecommendationInput {
  return {
    problemSummary:
      'Ingest millions of events per second through Kafka distributed event streaming and fan out workers.',
    spec: {
      problemSummary:
        'Ingest millions of events per second through Kafka distributed event streaming and fan out workers.',
      likelyInfrastructureRequirements: {
        determined: true,
        items: [{ name: 'kafka', description: 'Distributed event streaming bus.' }],
      },
    },
    mappings: [
      {
        requirement: 'Distributed event streaming at high volume',
        category: 'infrastructure',
        existingCapability: 'unknown',
        newProblemLogic: 'A streaming broker is not a kit capability.',
        confidence: 0.55,
        evidence: 'Kafka / event streaming.',
      },
    ],
  };
}

export function analysisDefaultArchitecture(): CapabilityRecommendationInput {
  return {
    problemSummary: 'Staff log in and create a work item. A manager reviews it on a dashboard.',
    spec: {
      problemSummary: 'Staff log in and create a work item. A manager reviews it on a dashboard.',
      users: {
        determined: true,
        items: [{ name: 'Staff', description: 'Creates the core record.' }],
      },
      entities: {
        determined: true,
        items: [{ name: 'Work item', fields: ['title', 'status'], description: 'Core domain record.' }],
      },
    },
    mappings: [
      {
        requirement: 'Users must log in',
        category: 'security',
        existingCapability: 'auth',
        newProblemLogic: 'unknown',
        confidence: 0.93,
      },
      {
        requirement: 'Store hackathon-specific work items',
        category: 'entity',
        existingCapability: 'database',
        newProblemLogic: 'Define the work-item model under modules/problem.',
        confidence: 0.88,
      },
    ],
    unknowns: ['Odoo models'],
  };
}

export function analysisOdooAndAi(): CapabilityRecommendationInput {
  return {
    problemSummary: 'Managers summarize Odoo sale orders with Gemini after login.',
    spec: {
      problemSummary: 'Managers summarize Odoo sale orders with Gemini after login.',
      odooRequirements: {
        determined: true,
        items: [{ app: 'Sales', model: 'sale.order', operation: 'read', notes: 'Read orders only.' }],
      },
      aiRequirements: {
        determined: true,
        items: [{ name: 'Summarize orders', description: 'Structured summary JSON.' }],
      },
    },
    mappings: [
      {
        requirement: 'Read sale orders from Odoo',
        category: 'odoo',
        existingCapability: 'odoo',
        newProblemLogic: 'Register an allowlisted sale.order read capability.',
        confidence: 0.9,
      },
      {
        requirement: 'Summarize each order',
        category: 'ai',
        existingCapability: 'ai.summarization',
        newProblemLogic: 'unknown',
        confidence: 0.86,
      },
    ],
  };
}

export function analysisMicroservicesAndK8s(): CapabilityRecommendationInput {
  return {
    problemSummary: 'Split the app into microservices and deploy on Kubernetes with Helm.',
    spec: {
      problemSummary: 'Split the app into microservices and deploy on Kubernetes with Helm.',
      likelyInfrastructureRequirements: {
        determined: true,
        items: [{ name: 'kubernetes', description: 'Helm charts.' }],
      },
    },
    mappings: [
      {
        requirement: 'Independently deployable microservices on Kubernetes',
        category: 'infrastructure',
        existingCapability: 'architecture.microservices',
        newProblemLogic: 'unknown',
        confidence: 0.4,
      },
    ],
  };
}

export function analysisTimeSeriesAnalytics(): CapabilityRecommendationInput {
  return {
    problemSummary:
      'Managers need KPI definitions, time-series aggregations, dashboard filters, and CSV export. Someone mentioned ClickHouse.',
    spec: {
      problemSummary:
        'Managers need KPI definitions, time-series aggregations, dashboard filters, and CSV export. Someone mentioned ClickHouse.',
      likelyInfrastructureRequirements: {
        determined: true,
        items: [{ name: 'clickhouse', description: 'Analytics warehouse.' }],
      },
    },
    mappings: [
      {
        requirement: 'Time series KPI dashboard with filters and export',
        category: 'report',
        existingCapability: 'analytics',
        newProblemLogic: 'unknown',
        confidence: 0.9,
        evidence: 'KPI definition, metric aggregation, analytics export.',
      },
    ],
  };
}
