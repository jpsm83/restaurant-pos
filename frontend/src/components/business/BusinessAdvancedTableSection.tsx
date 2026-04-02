import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { queryKeys } from "@/services/queryKeys";
import { getQuickRange, parseDateTime } from "@/features/advancedTable/utils/dateFilter";

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
  total: string;
  createdAt: string;
}

const MOCK_BASE_TIME_MS = Date.now();

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

function formatCreatedAtForDisplay(value: string): string {
  const parsed = parseDateTime(value);
  if (!parsed) return value;

  const date = parsed.date;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("start-date") ?? "";
  const endDate = searchParams.get("end-date") ?? "";

  useEffect(() => {
    if (!enableDateToolbarFilter) return;
    const hasValidStart = Boolean(startDate) && Boolean(parseDateTime(startDate));
    const hasValidEnd = Boolean(endDate) && Boolean(parseDateTime(endDate));
    if (hasValidStart && hasValidEnd) return;

    const [defaultStart, defaultEnd] = getQuickRange("lastHour");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("start-date", defaultStart);
    nextParams.set("end-date", defaultEnd);
    setSearchParams(nextParams, { replace: true });
  }, [enableDateToolbarFilter, endDate, searchParams, setSearchParams, startDate]);

  const columns = useMemo<TableColumnConfig<MockBusinessRow>[]>(() => {
    return [
      {
        id: "ticketNumber",
        header: t("advancedTable.fields.ticket", { defaultValue: "Ticket" }),
        accessorKey: "ticketNumber",
        enableColumnFilter: true,
        enableSorting: true,
        enableHiding: true,
        meta: { label: t("advancedTable.fields.ticket", { defaultValue: "Ticket" }) },
      },
      {
        id: "tableLabel",
        header: t("advancedTable.fields.table", { defaultValue: "Table" }),
        accessorKey: "tableLabel",
        enableColumnFilter: true,
        enableSorting: true,
        enableHiding: true,
        meta: { label: t("advancedTable.fields.table", { defaultValue: "Table" }) },
      },
      {
        id: "status",
        header: t("advancedTable.fields.status", { defaultValue: "Status" }),
        accessorKey: "status",
        enableColumnFilter: true,
        enableSorting: true,
        enableHiding: true,
        meta: { label: t("advancedTable.fields.status", { defaultValue: "Status" }) },
      },
      {
        id: "total",
        header: t("advancedTable.fields.total", { defaultValue: "Total" }),
        accessorKey: "total",
        enableColumnFilter: true,
        enableSorting: true,
        enableHiding: true,
        meta: { label: t("advancedTable.fields.total", { defaultValue: "Total" }) },
      },
      {
        id: "createdAt",
        header: t("advancedTable.fields.createdAt", { defaultValue: "Created at" }),
        accessorFn: (row) => formatCreatedAtForDisplay(row.createdAt),
        enableColumnFilter: true,
        enableSorting: true,
        enableHiding: true,
        cell: ({ row }: { row: { original: MockBusinessRow } }) =>
          formatCreatedAtForDisplay(row.original.createdAt),
        meta: { label: t("advancedTable.fields.createdAt", { defaultValue: "Created at" }) },
      },
    ] as TableColumnConfig<MockBusinessRow>[];
  }, [t]);

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
          total: `$${(10 + (ticket % 9) * 3).toFixed(2)}`,
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
        options: [
          { value: "Open", label: t("advancedTable.status.open", { defaultValue: "Open" }) },
          { value: "In prep", label: t("advancedTable.status.inPrep", { defaultValue: "In prep" }) },
          { value: "Paid", label: t("advancedTable.status.paid", { defaultValue: "Paid" }) },
        ],
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
          rows = rows.filter((row) => getRowValue(row, filterId).toLowerCase().includes(needle));
        }

        const startDateFilterValue =
          params.startDate ??
          filters.find((filter) => filter?.id === "start-date")?.value;
        const endDateFilterValue =
          params.endDate ??
          filters.find((filter) => filter?.id === "end-date")?.value;
        const parsedStartDate = parseDateTime(String(startDateFilterValue ?? ""));
        const parsedEndDate = parseDateTime(String(endDateFilterValue ?? ""));
        if (parsedStartDate && parsedEndDate) {
          const startMs = parsedStartDate.date.getTime();
          const endMs = parsedEndDate.date.getTime();
          rows = rows.filter((row) => {
            const parsedCreatedAt = parseDateTime(row.createdAt);
            if (!parsedCreatedAt) return false;
            const createdAtMs = parsedCreatedAt.date.getTime();
            return createdAtMs >= startMs && createdAtMs <= endMs;
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
    [businessId, mockRows]
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
              defaultValue: "Record {{index}} of {{total}}",
              index: context.index + 1,
              total: context.total,
            })}
          </p>
          <p>
            {t("advancedTable.fields.ticket", { defaultValue: "Ticket" })}: {record.ticketNumber}
          </p>
          <p>
            {t("advancedTable.fields.table", { defaultValue: "Table" })}: {record.tableLabel}
          </p>
          <p>
            {t("advancedTable.fields.status", { defaultValue: "Status" })}: {record.status}
          </p>
          <p>
            {t("advancedTable.fields.total", { defaultValue: "Total" })}: {record.total}
          </p>
        </div>
      ),
    }),
    [t]
  );

  const defaultColumnOrder = useMemo(() => columns.map((column) => column.id), [columns]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {t("advancedTable.section.title", { defaultValue: "Advanced table integration target" })}
        </CardTitle>
        <CardDescription>
          {t("advancedTable.section.description", {
            defaultValue: "First production wiring will use this section as the integration boundary.",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-neutral-600">
        <p>
          {t("advancedTable.section.businessId", { defaultValue: "Business ID" })}:{" "}
          {businessId ?? t("advancedTable.section.unavailable", { defaultValue: "Unavailable" })}
        </p>
        <p>
          {t("advancedTable.section.businessEmail", { defaultValue: "Business Email" })}:{" "}
          {businessEmail ?? t("advancedTable.section.unavailable", { defaultValue: "Unavailable" })}
        </p>
        <div className="mt-4 h-[520px] rounded border p-3">
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
                  searchLabel={t("advancedTable.section.filters", { defaultValue: "Filters" })}
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
            emptyStateMessage={t("advancedTable.states.emptyMessage", {
              defaultValue: "No business records available.",
            })}
            emptyStateSubMessage={t("advancedTable.states.emptySubMessage", {
              defaultValue: "Try changing filters or check back later.",
            })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
