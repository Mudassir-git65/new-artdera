import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function DashboardChart({
  data,
  variant,
}: {
  data: Array<Record<string, string | number>>;
  variant: "overview" | "analytics";
}) {
  return variant === "overview" ? (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="dashboardViews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6e2334" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6e2334" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ddd4c7" />
        <XAxis dataKey="date" tickFormatter={(value) => value.slice(8)} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={35} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="storeViews"
          stroke="#6e2334"
          strokeWidth={2}
          fill="url(#dashboardViews)"
        />
      </AreaChart>
    </ResponsiveContainer>
  ) : (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="storeAnalytics" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#263454" stopOpacity={0.35} />
            <stop offset="1" stopColor="#263454" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#ddd4c7" />
        <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="artworkViews"
          stroke="#263454"
          strokeWidth={2}
          fill="url(#storeAnalytics)"
        />
        <Area
          type="monotone"
          dataKey="storeViews"
          stroke="#b65f42"
          strokeWidth={2}
          fill="transparent"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
