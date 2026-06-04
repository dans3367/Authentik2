import { type ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";

// Boxed page header shared by the Appointments / Availability / Settings tabs so
// each section opens with the same gradient title + helper text (and optional action).
export function TabHeaderCard({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      </CardHeader>
    </Card>
  );
}

export default TabHeaderCard;
