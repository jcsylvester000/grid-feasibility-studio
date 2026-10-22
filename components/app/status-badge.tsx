import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/reports/service";
import type { ReportStatus } from "@/lib/db/schema";

export function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
