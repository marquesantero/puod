import type { CardConfig } from "@/types/cards";

const STORAGE_KEY = "puod.cards.v1";

const fallbackCards: CardConfig[] = [
  {
    id: 1,
    title: "Airflow: Critical DAGs",
    templateId: "airflow-dag-overview",
    layoutId: "list",
    sourceId: 1,
    refresh: "5m",
    params: {
      dags: [
        "saz_br_technology_auxiliary_sheets_transformation",
        "saz_br_technology_cubo_fornec_sybase_queries_13m",
      ],
    },
  },
  {
    id: 2,
    title: "ADF Pipelines: Iris",
    templateId: "adf-pipeline-status",
    layoutId: "grid",
    sourceId: 2,
    refresh: "15m",
    params: {
      pipelines: ["main_ingest", "daily_kpis", "finops_refresh"],
    },
  },
  {
    id: 3,
    title: "Ops Health Strip",
    templateId: "kpi-strip",
    layoutId: "kpi",
    sourceId: 1,
    refresh: "1m",
    params: {
      metrics: ["success_rate", "avg_runtime", "queue_depth"],
    },
  },
];

export const getCards = (): CardConfig[] => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallbackCards;
  }

  try {
    const parsed = JSON.parse(raw) as CardConfig[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallbackCards;
  } catch {
    return fallbackCards;
  }
};

export const saveCards = (cards: CardConfig[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
};

export const upsertCard = (card: CardConfig) => {
  const cards = getCards();
  const index = cards.findIndex((item) => item.id === card.id);
  if (index === -1) {
    saveCards([card, ...cards]);
    return;
  }

  const updated = [...cards];
  updated[index] = card;
  saveCards(updated);
};

export const removeCard = (id: number) => {
  const cards = getCards().filter((card) => card.id !== id);
  saveCards(cards);
};
