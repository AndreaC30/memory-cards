/** 13 fuentes del cuaderno NotebookLM (Datadog Fundamentals). */
export const NOTEBOOK_SOURCES = [
  {
    id: "getting-started",
    title: "Guía de inicio rápido",
    url: "https://docs.datadoghq.com/es/getting_started/",
    domain: "essential",
  },
  {
    id: "agent-host",
    title: "Datadog Agent (host)",
    url: "https://docs.datadoghq.com/es/agent/?tab=Host-based",
    domain: "infra",
  },
  {
    id: "metrics",
    title: "Métricas",
    url: "https://docs.datadoghq.com/es/metrics/",
    domain: "collection",
  },
  {
    id: "infra-list",
    title: "Lista de infraestructura",
    url: "https://docs.datadoghq.com/es/infrastructure/list/",
    domain: "viz",
  },
  {
    id: "api-keys",
    title: "Claves API y aplicación",
    url: "https://docs.datadoghq.com/es/account_management/api-app-keys/",
    domain: "essential",
  },
  {
    id: "agent-integration",
    title: "Integración basada en Agent",
    url: "https://docs.datadoghq.com/es/extend/integrations/agent_integration/?tab=integraciónootb",
    domain: "collection",
  },
  {
    id: "docker-integration",
    title: "Integración Docker Daemon",
    url: "https://docs.datadoghq.com/es/integrations/docker/",
    domain: "infra",
  },
  {
    id: "query-graph",
    title: "Consulta al gráfico",
    url: "https://docs.datadoghq.com/es/dashboards/guide/query-to-the-graph/",
    domain: "viz",
  },
  {
    id: "docker-agent",
    title: "Agente Docker en contenedores",
    url: "https://docs.datadoghq.com/es/containers/docker/?tab=linux",
    domain: "infra",
  },
  {
    id: "metrics-api",
    title: "API de métricas",
    url: "https://docs.datadoghq.com/es/api/latest/metrics/",
    domain: "collection",
  },
  {
    id: "monitor-types",
    title: "Tipos de monitores",
    url: "https://docs.datadoghq.com/es/monitors/types/",
    domain: "viz",
  },
  {
    id: "dogstatsd",
    title: "DogStatsD",
    url: "https://docs.datadoghq.com/es/extend/dogstatsd/?tab=agentedehost",
    domain: "collection",
  },
  {
    id: "ddtrace",
    title: "ddtrace (APM)",
    url: "https://ddtrace.readthedocs.io/en/stable/advanced_usage.html",
    domain: "collection",
  },
]

export const DOMAIN_LABELS = {
  essential: "Conceptos esenciales",
  infra: "Infraestructura y Agent",
  network: "Red y configuración",
  collection: "Recolección de datos",
  troubleshoot: "Troubleshooting",
  viz: "Visualización y uso",
}
