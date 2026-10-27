import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StandaloneAdvancedTable } from "@/features/advancedTable/components/StandaloneAdvancedTable";
import GenericSearchBar from "@/features/advancedTable/components/GenericSearchBar";
import type { FilterConfig, TableColumnConfig } from "@/features/advancedTable/types/tableContracts";
import {
  buildTablePersistenceKeyPrefix,
  createPersistenceAdapter,
} from "@/features/advancedTable/services/persistenceService";
import { useFormatting } from "@/hooks/useFormatting";
import { useBusinessProfileQuery } from "@/services/business/businessService";
import { queryKeys } from "@/services/queryKeys";
import {
  getQuickRange,
  isValidCalendarDate,
  parseDateTime,
  resolveCalendarDateBounds,
} from "@/features/advancedTable/utils/dateFilter";

interface BusinessAdvancedTableSectionProps {
  businessId?: string;
  businessEmail?: string;
  enableDateToolbarFilter?: boolean;
}

interface MockBusinessRow {
  id: string;
  ticketNumber: string;
  tableLabel: string;
  status: string;
  total: number;
  createdAt: string;
}

const MOCK_BASE_TIME_MS = Date.now();

const BUSINESS_STATUS_OPTIONS = [
  { value: "Open", labelKey: "advancedTable.status.open" },
  { value: "In prep", labelKey: "advancedTable.status.inPrep" },
  { value: "Paid", labelKey: "advancedTable.status.paid" },
] as const;

function getBusinessStatusLabel(status: string, t: TFunction): string {
  const option = BUSINESS_STATUS_OPTIONS.find(
    (candidate) => candidate.value === status,
  );
  return option ? t(option.labelKey) : status;
}

function getRowValue(row: MockBusinessRow, key: string): string {
  return String((row as unknown as Record<string, unknown>)[key] ?? "");
}

function toLocalDateTimeString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function seededNumber(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Page-level integration container for advanced table wiring.
 * Route/session concerns stay here and are passed to table config later.
 */
export default function BusinessAdvancedTableSection({
  businessId,
  businessEmail,
  enableDateToolbarFilter = true,
}: BusinessAdvancedTableSectionProps) {
  const { t } = useTranslation("business");
  const { formatCurrency, formatDateTime, formatNumber } = useFormatting();
  const profileQuery = useBusinessProfileQuery(businessId);
  const currencyTrade = profileQuery.data?.currencyTrade;
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("start-date") ?? "";
  const endDate = searchParams.get("end-date") ?? "";

  useEffect(() => {
    if (!enableDateToolbarFilter) return;
    const hasValidStart = Boolean(startDate) && isValidCalendarDate(startDate);
    const hasValidEnd = Boolean(endDate) && isValidCalendarDate(endDate);
    if (hasValidStart && hasValidEnd) return;

    const [defaultStart, defaultEnd] = getQuickRange("today");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("start-date", defaultStart);
    nextParams.set("end-date", defaultEnd);
    setSearchParams(nextParams, { replace: true });
  }, [enableDateToolbarFilter, endDate, searchParams, setSearchParams, startDate]);

  const columns = useMemo<TableColumnConfig<MockBusinessRow>[]>(() => {
    return [
      {
        id: "ticketNumber",
        header: t("advancedTable.fields.ticket"),
        accessorKey: "ticketNumber",
        enableColumnFilter: true,
        enableSorting: true,
        enableHiding: true,
        meta: { label: t("advancedTable.fields.ticket") },
      },
      {
        id: "tableLabel",
        header: t("advancedTable.fields.table"),
        accessorKey: "tableLabel",
        enableColumnFilter: true,
        enableSorting: true,
        enableHiding: true,
        meta: { label: t("advancedTable.fields.table") },
      },
      {
        id: "status",
        header: t("advancedTable.fields.status"),
        accessorKey: "status",
        enableColumnFilter: true,
        enableSorting: true,
        enableHiding: true,
        cell: ({ row }: { row: { original: MockBusinessRow } }) =>
          getBusinessStatusLabel(row.original.status, t),
        meta: { label: t("advancedTable.fields.status") },
      },
      {
        id: "total",
        header: t("advancedTable.fields.total"),
        accessorKey: "total",
        enableColumnFilter: true,
        enableSorting: true,
        enableHiding: true,
        cell: ({ row }: { row: { original: MockBusinessRow } }) =>
          formatCurrency(row.original.total, currencyTrade),
        meta: { label: t("advancedTable.fields.total") },
      },
      {
        id: "createdAt",
        header: t("advancedTable.fields.createdAt"),
        accessorFn: (row) => formatDateTime(row.createdAt),
        enableColumnFilter: true,
        enableSorting: true,
        enableHiding: true,
        cell: ({ row }: { row: { original: MockBusinessRow } }) =>
          formatDateTime(row.original.createdAt),
        meta: { label: t("advancedTable.fields.createdAt") },
      },
    ] as TableColumnConfig<MockBusinessRow>[];
  }, [currencyTrade, formatCurrency, formatDateTime, t]);

  const mockRows = useMemo<MockBusinessRow[]>(
    () =>
      Array.from({ length: 180 }, (_, index) => {
        const ticket = index + 1;
        const seed = `${businessId ?? "biz"}-${ticket}`;
        const randomDaysBack = seededNumber(`${seed}-days`) % 45;
        const randomSecondsBack = seededNumber(`${seed}-seconds`) % (24 * 60 * 60);
        const createdAtDate = new Date(
          MOCK_BASE_TIME_MS -
            randomDaysBack * 24 * 60 * 60 * 1000 -
            randomSecondsBack * 1000
        );
        return {
          id: `${businessId ?? "biz"}-${ticket}`,
          ticketNumber: `T-${String(ticket).padStart(4, "0")}`,
          tableLabel: `Table ${((ticket - 1) % 12) + 1}`,
          status: ticket % 3 === 0 ? "Open" : ticket % 2 === 0 ? "In prep" : "Paid",
          total: 10 + (ticket % 9) * 3,
          createdAt: toLocalDateTimeString(createdAtDate),
        };
      }),
    [businessId]
  );

  const filterConfigs = useMemo<FilterConfig[]>(
    () => [
      {
        columnId: "status",
        filterType: "dropdown",
        options: BUSINESS_STATUS_OPTIONS.map((option) => ({
          value: option.value,
          label: t(option.labelKey),
        })),
      },
      { columnId: "ticketNumber", filterType: "input", realtime: true },
      { columnId: "tableLabel", filterType: "input", realtime: true },
      { columnId: "total", filterType: "input", realtime: true },
      { columnId: "createdAt", filterType: "input", realtime: true },
    ],
    [t]
  );

  const fetchConfig = useMemo(
    () => ({
      queryKey: (params: Record<string, unknown>) =>
        queryKeys.advancedTable.businessDashboard(businessId ?? "unknown", params),
      params: {
        page: 1,
        pageSize: 25,
        sorting: [],
        filters: [],
      } as Record<string, unknown>,
      queryFn: async (params: Record<string, unknown>) => {
        const sorting = Array.isArray(params.sorting)
          ? (params.sorting as Array<{ id?: string; desc?: boolean }>)
          : [];
        const filters = Array.isArray(params.filters)
          ? (params.filters as Array<{ id?: string; value?: unknown }>)
          : [];
        const page = typeof params.page === "number" && params.page > 0 ? params.page : 1;
        const pageSize =
          typeof params.pageSize === "number" && params.pageSize > 0 ? params.pageSize : 25;

        let rows = [...mockRows];

        for (const filter of filters) {
          const filterId = filter?.id;
          if (!filterId) continue;
          const raw = filter.value;
          if (filterId === "start-date" || filterId === "end-date") {
            continue;
          }
          if (Array.isArray(raw)) {
            rows = rows.filter((row) => raw.includes(getRowValue(row, filterId)));
            continue;
          }
          if (raw == null || String(raw).trim() === "") continue;
          const needle = String(raw).toLowerCase();
          rows = rows.filter((row) => {
            const searchable =
              filterId === "total"
                ? `${getRowValue(row, filterId)} ${formatCurrency(row.total, currencyTrade)}`
                : getRowValue(row, filterId);
            return searchable.toLowerCase().includes(needle);
          });
        }

        const startDateFilterValue =
          params.startDate ??
          filters.find((filter) => filter?.id === "start-date")?.value;
        const endDateFilterValue =
          params.endDate ??
          filters.find((filter) => filter?.id === "end-date")?.value;
        const bounds = resolveCalendarDateBounds(
          String(startDateFilterValue ?? ""),
          String(endDateFilterValue ?? ""),
        );
        if (bounds) {
          rows = rows.filter((row) => {
            const parsedCreatedAt = parseDateTime(row.createdAt);
            if (!parsedCreatedAt) return false;
            const createdAtMs = parsedCreatedAt.date.getTime();
            return createdAtMs >= bounds.startMs && createdAtMs <= bounds.endMs;
          });
        }

        for (const sort of [...sorting].reverse()) {
          const sortId = sort?.id;
          if (!sortId) continue;
          rows.sort((a, b) => {
            const av = getRowValue(a, sortId);
            const bv = getRowValue(b, sortId);
            const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
            return sort.desc ? -cmp : cmp;
          });
        }

        const start = (page - 1) * pageSize;
        const pagedRows = rows.slice(start, start + pageSize);
        return pagedRows;
      },
    }),
    [businessId, currencyTrade, formatCurrency, mockRows]
  );

  const exportStoreColumns = useMemo(
    () =>
      columns.map((column) => ({
        columnKey: column.id,
        columnName: String(column.meta?.label ?? column.id),
      })),
    [columns]
  );

  const persistenceAdapter = useMemo(() => createPersistenceAdapter("localStorage"), []);
  const persistenceKeyPrefix = useMemo(
    () =>
      buildTablePersistenceKeyPrefix({
        screenId: "business-dashboard",
        tableId: "orders-table",
      }),
    []
  );

  const detailsModal = useMemo(
    () => ({
      enabled: true,
      allowKeyboardNavigation: true,
      renderDetails: (record: MockBusinessRow, context: { index: number; total: number }) => (
        <div className="space-y-2 p-4 text-sm">
          <p>
            {t("advancedTable.modal.recordCounter", {
              index: formatNumber(context.index + 1),
              total: formatNumber(context.total),
            })}
          </p>
          <p>
            {t("advancedTable.fields.ticket")}: {record.ticketNumber}
          </p>
          <p>
            {t("advancedTable.fields.table")}: {record.tableLabel}
          </p>
          <p>
            {t("advancedTable.fields.status")}:{" "}
            {getBusinessStatusLabel(record.status, t)}
          </p>
          <p>
            {t("advancedTable.fields.total")}:{" "}
            {formatCurrency(record.total, currencyTrade)}
          </p>
        </div>
      ),
    }),
    [currencyTrade, formatCurrency, formatNumber, t]
  );

  const defaultColumnOrder = useMemo(() => columns.map((column) => column.id), [columns]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {t("advancedTable.section.title")}
        </CardTitle>
        <CardDescription>
          {t("advancedTable.section.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>
          {t("advancedTable.section.businessId")}:{" "}
          {businessId ?? t("advancedTable.section.unavailable")}
        </p>
        <p>
          {t("advancedTable.section.businessEmail")}:{" "}
          {businessEmail ?? t("advancedTable.section.unavailable")}
        </p>
        <div className="mt-4 h-130 rounded border p-3">
          <StandaloneAdvancedTable
            fetchConfig={fetchConfig}
            columns={columns}
            filterConfigs={filterConfigs}
            dateRangeFilter={
              enableDateToolbarFilter
                ? { startDate, endDate, columnId: "createdAt" }
                : undefined
            }
            localOnlyFilterColumnIds={enableDateToolbarFilter ? ["createdAt"] : undefined}
            toolbar={
              enableDateToolbarFilter ? (
                <GenericSearchBar
                  startDate={startDate}
                  endDate={endDate}
                  weekStartsOn={1}
                  onDateChange={(nextStartDate, nextEndDate) => {
                    setSearchParams((previous) => {
                      const params = new URLSearchParams(previous);
                      params.set("start-date", nextStartDate);
                      params.set("end-date", nextEndDate);
                      return params;
                    });
                  }}
                  searchLabel={t("advancedTable.section.filters")}
                  showExportButton={false}
                />
              ) : undefined
            }
            getRowId={(row) => row.id}
            detailsModal={detailsModal}
            exportConfig={{
              enabled: true,
              storeColumns: exportStoreColumns,
              options: {
                fileName: `business-${businessId ?? "unknown"}-orders.xlsx`,
                sheetName: "BusinessOrders",
              },
            }}
            persistence={{
              enabled: true,
              adapter: persistenceAdapter,
              keyPrefix: persistenceKeyPrefix,
            }}
            defaultColumnOrder={defaultColumnOrder}
            initialColumnOrder={defaultColumnOrder}
            emptyStateMessage={t("advancedTable.states.emptyMessage")}
            emptyStateSubMessage={t("advancedTable.states.emptySubMessage")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
