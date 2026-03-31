import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StandaloneAdvancedTable } from "@/features/advancedTable/components/StandaloneAdvancedTable";
import type { FilterConfig, TableColumnConfig } from "@/features/advancedTable/types/tableContracts";
import {
  buildTablePersistenceKeyPrefix,
  createPersistenceAdapter,
} from "@/features/advancedTable/services/persistenceService";
import { queryKeys } from "@/services/queryKeys";

interface BusinessAdvancedTableSectionProps {
  businessId?: string;
  businessEmail?: string;
}

interface MockBusinessRow {
  id: string;
  ticketNumber: string;
  tableLabel: string;
  status: string;
  total: string;
}

function getRowValue(row: MockBusinessRow, key: string): string {
  return String((row as unknown as Record<string, unknown>)[key] ?? "");
}

/**
 * Page-level integration container for advanced table wiring.
 * Route/session concerns stay here and are passed to table config later.
 */
export default function BusinessAdvancedTableSection({
  businessId,
  businessEmail,
}: BusinessAdvancedTableSectionProps) {
  const { t } = useTranslation("business");

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
    ] as TableColumnConfig<MockBusinessRow>[];
  }, [t]);

  const mockRows = useMemo<MockBusinessRow[]>(
    () =>
      Array.from({ length: 180 }, (_, index) => {
        const ticket = index + 1;
        return {
          id: `${businessId ?? "biz"}-${ticket}`,
          ticketNumber: `T-${String(ticket).padStart(4, "0")}`,
          tableLabel: `Table ${((ticket - 1) % 12) + 1}`,
          status: ticket % 3 === 0 ? "Open" : ticket % 2 === 0 ? "In prep" : "Paid",
          total: `$${(10 + (ticket % 9) * 3).toFixed(2)}`,
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
      { columnId: "ticketNumber", filterType: "input", realtime: false },
      { columnId: "tableLabel", filterType: "input", realtime: false },
      { columnId: "total", filterType: "input", realtime: false },
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
          if (Array.isArray(raw)) {
            rows = rows.filter((row) => raw.includes(getRowValue(row, filterId)));
            continue;
          }
          if (raw == null || String(raw).trim() === "") continue;
          const needle = String(raw).toLowerCase();
          rows = rows.filter((row) => getRowValue(row, filterId).toLowerCase().includes(needle));
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

        void page;
        void pageSize;
        return rows;
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
