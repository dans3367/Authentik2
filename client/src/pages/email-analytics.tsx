import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  PieChart,
  Mail,
  Eye,
  MousePointer,
  Users,
  Calendar,
  Download,
  Filter,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";

const emailPerformanceData = [
  { date: "Jul 23", sent: 1250, opened: 875, clicked: 312 },
  { date: "Jul 24", sent: 1890, opened: 1323, clicked: 478 },
  { date: "Jul 25", sent: 980, opened: 686, clicked: 245 },
  { date: "Jul 26", sent: 2100, opened: 1470, clicked: 525 },
  { date: "Jul 27", sent: 1560, opened: 1092, clicked: 390 },
  { date: "Jul 28", sent: 1780, opened: 1246, clicked: 445 },
  { date: "Jul 29", sent: 2200, opened: 1540, clicked: 550 },
];

const deviceData = [
  { name: "Desktop", value: 45, color: "#3B82F6" },
  { name: "Mobile", value: 38, color: "#10B981" },
  { name: "Tablet", value: 12, color: "#F59E0B" },
  { name: "Other", value: 5, color: "#6B7280" },
];

const topCampaigns = [
  { name: "Summer Sale Announcement", sent: 5420, openRate: 68.5, clickRate: 24.3, revenue: "$12,450" },
  { name: "Q2 Product Launch", sent: 4200, openRate: 72.1, clickRate: 28.7, revenue: "$18,920" },
  { name: "Newsletter - July Edition", sent: 8900, openRate: 45.2, clickRate: 12.8, revenue: "$3,200" },
  { name: "Customer Appreciation", sent: 3500, openRate: 61.4, clickRate: 19.5, revenue: "$7,890" },
];

const engagementByHour = [
  { hour: "12AM", opens: 120 },
  { hour: "2AM", opens: 80 },
  { hour: "4AM", opens: 95 },
  { hour: "6AM", opens: 220 },
  { hour: "8AM", opens: 580 },
  { hour: "10AM", opens: 890 },
  { hour: "12PM", opens: 750 },
  { hour: "2PM", opens: 920 },
  { hour: "4PM", opens: 1100 },
  { hour: "6PM", opens: 850 },
  { hour: "8PM", opens: 680 },
  { hour: "10PM", opens: 420 },
];

export default function EmailAnalytics() {
  const [dateRange, setDateRange] = useState("last7days");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    changeType, 
    icon: Icon 
  }: { 
    title: string; 
    value: string; 
    change: string; 
    changeType: "increase" | "decrease"; 
    icon: React.ComponentType<any>;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
            <div className="flex items-center mt-2">
              {changeType === "increase" ? (
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm ${changeType === "increase" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {change} from last period
              </span>
            </div>
          </div>
          <div className="h-12 w-12 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-center justify-center">
            <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Analytics</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track performance and insights from your email campaigns
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last7days">Last 7 days</SelectItem>
                <SelectItem value="last30days">Last 30 days</SelectItem>
                <SelectItem value="last90days">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Emails Sent"
          value="23,847"
          change="+12.5%"
          changeType="increase"
          icon={Mail}
        />
        <MetricCard
          title="Average Open Rate"
          value="58.3%"
          change="+3.2%"
          changeType="increase"
          icon={Eye}
        />
        <MetricCard
          title="Average Click Rate"
          value="21.7%"
          change="-1.8%"
          changeType="decrease"
          icon={MousePointer}
        />
        <MetricCard
          title="Total Revenue"
          value="$42,460"
          change="+18.9%"
          changeType="increase"
          icon={TrendingUp}
        />
      </div>

      {/* Email Performance Chart */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Email Performance Over Time</CardTitle>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                <SelectItem value="promotional">Promotional</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={emailPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
              <XAxis dataKey="date" stroke={isDark ? "#9ca3af" : "#6b7280"} />
              <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                  border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                  borderRadius: "8px",
                  color: isDark ? "#f3f4f6" : "#111827",
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="sent"
                stackId="1"
                stroke="#3b82f6"
                fill={isDark ? "rgba(59,130,246,0.2)" : "#dbeafe"}
                name="Emails Sent"
              />
              <Area
                type="monotone"
                dataKey="opened"
                stackId="2"
                stroke="#10b981"
                fill={isDark ? "rgba(16,185,129,0.2)" : "#d1fae5"}
                name="Emails Opened"
              />
              <Area
                type="monotone"
                dataKey="clicked"
                stackId="3"
                stroke="#f59e0b"
                fill={isDark ? "rgba(245,158,11,0.2)" : "#fed7aa"}
                name="Links Clicked"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Device Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Email Opens by Device</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {deviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#fff",
                    border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                    borderRadius: "8px",
                    color: isDark ? "#f3f4f6" : "#111827",
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {deviceData.map((device) => (
                <div key={device.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: device.color }}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{device.name}</span>
                  </div>
                  <span className="text-sm font-medium">{device.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Best Time to Send */}
        <Card>
          <CardHeader>
            <CardTitle>Best Time to Send</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={engagementByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                <XAxis dataKey="hour" stroke={isDark ? "#9ca3af" : "#6b7280"} />
                <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1f2937" : "#fff",
                    border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                    borderRadius: "8px",
                    color: isDark ? "#f3f4f6" : "#111827",
                  }}
                />
                <Bar dataKey="opens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Peak engagement:</strong> 2PM - 5PM (your timezone)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Campaigns */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Top Performing Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topCampaigns.map((campaign, index) => (
              <div
                key={index}
                className="p-4 border dark:border-neutral-700 rounded-lg hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                      {campaign.name}
                    </h3>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Emails Sent</p>
                        <p className="font-medium">{campaign.sent.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Open Rate</p>
                        <p className="font-medium text-green-600 dark:text-green-400">{campaign.openRate}%</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Click Rate</p>
                        <p className="font-medium text-blue-600 dark:text-blue-400">{campaign.clickRate}%</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Revenue</p>
                        <p className="font-medium text-purple-600 dark:text-purple-400">{campaign.revenue}</p>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Engagement Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Delivery Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Delivered</span>
                </div>
                <span className="font-medium">94.2%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">Bounced</span>
                </div>
                <span className="font-medium">3.1%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm">Failed</span>
                </div>
                <span className="font-medium">2.7%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Subscriber Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">New Subscribers</span>
                <span className="font-medium text-green-600 dark:text-green-400">+342</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Unsubscribes</span>
                <span className="font-medium text-red-600 dark:text-red-400">-48</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Net Growth</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">+294</span>
              </div>
              <div className="pt-2 border-t dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Growth Rate</span>
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">+8.7%</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Campaign Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">Open Rate Goal</span>
                  <span className="text-sm font-medium">58.3% / 60%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: "97.2%" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">Click Rate Goal</span>
                  <span className="text-sm font-medium">21.7% / 20%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: "100%" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">Revenue Goal</span>
                  <span className="text-sm font-medium">$42.5k / $50k</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: "85%" }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}