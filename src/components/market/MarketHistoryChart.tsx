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

export function MarketHistoryChart({ history }: { history: HistoryPoint[] }) {
  if (!history || history.length === 0) return null;

  const parsed = history.map((h) => ({
    date: h.datetime instanceof Date ? h.datetime : h.datetime.toDate(),
    value: Math.round(h.yesChance * 100),
  }));

  const data = {
    datasets: [
      {
        label: "JA-sjanse (%)",
        data: parsed.map(p => ({ x: p.date, y: p.value })),
        borderColor: "#16a34a",
        backgroundColor: "rgba(22, 163, 74, 0.2)",
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.25,
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
        ticks: {
          maxRotation: 0,
          autoSkip: true, // automatically skip ticks to avoid overlap
          maxTicksLimit: 6, // max number of ticks shown
        },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (v: number) => `${v}%`,
        },
        title: {
          display: true,
          text: "JA-sjanse (%)",
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.raw.y}%`,
        },
      },
    },
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
      <h2 className="text-lg font-semibold mb-2">Prishistorikk</h2>
      <Line data={data} options={options} height={80} />
    </div>
  );
}
