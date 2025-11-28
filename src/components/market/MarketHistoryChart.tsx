import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  CategoryScale,
} from "chart.js";
import 'chartjs-adapter-date-fns';
import { Line } from "react-chartjs-2";
import type { Timestamp } from "firebase/firestore";

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend, CategoryScale);

interface HistoryPoint {
  datetime: Date | Timestamp;
  yesChance: number; // 0.0 → 1.0
}

interface Comment {
  id: string;
  content: string;
  referencedTimestamp?: number | null;
}

interface MarketHistoryChartProps {
  history: HistoryPoint[];
  comments?: Comment[];
  onTimestampSelect?: (timestamp: number) => void;
  highlightTimestamp?: number | null;
}

export function MarketHistoryChart({
  history,
  comments = [],
  onTimestampSelect,
  highlightTimestamp,
}: MarketHistoryChartProps) {
  if (!history || history.length === 0) return null;

  const parsed = history.map((h) => ({
    date: h.datetime instanceof Date ? h.datetime : h.datetime.toDate(),
    value: Math.round(h.yesChance * 100),
  }));

  const data = {
    datasets: [
      {
        label: "JA-sjanse (%)",
        data: parsed.map(p => ({
          x: p.date,
          y: p.value,
          // store timestamp for easy reference
          ts: p.date.getTime(),
        })),
        borderColor: "#16a34a",
        backgroundColor: "rgba(22, 163, 74, 0.2)",
        borderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 6,
        tension: 0.25,
        pointBackgroundColor: parsed.map(p =>
          highlightTimestamp && highlightTimestamp === p.date.getTime() ? "#facc15" : "#16a34a"
        ),
      }
    ]
  };

  const options = {
    responsive: true,
    scales: {
      x: {
        type: "time" as const,
        time: {
          tooltipFormat: "PPpp",
          displayFormats: {
            millisecond: "HH:mm:ss.SSS",
            second: "HH:mm:ss",
            minute: "HH:mm",
            hour: "HH:mm",
            day: "MMM d",
            month: "MMM yyyy",
            year: "yyyy",
          },
        },
        title: {
          display: true,
          text: "Tid",
        },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { callback: (v: string | number) => `${v}%` },
        title: { display: true, text: "JA-sjanse (%)" },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const ts = ctx.raw.ts;
            const value = ctx.raw.y;
            const relatedComments = comments
              .filter(c => c.referencedTimestamp === ts)
              .slice(0, 3)
              .map(c => `- ${c.content}`)
              .join("\n");
            return relatedComments ? `${value}%\n${relatedComments}` : `${value}%`;
          },
        },
      },
    },
    onClick: (_evt: any, elements: any[]) => {
      if (!elements || elements.length === 0) return;
      const element = elements[0];
      const datasetIndex = element.datasetIndex;
      const index = element.index;
      const ts = data.datasets[datasetIndex].data[index].ts;
      if (onTimestampSelect) onTimestampSelect(ts);
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Prishistorikk</h2>
      <Line data={data} options={options} height={80} />
    </div>
  );
}
