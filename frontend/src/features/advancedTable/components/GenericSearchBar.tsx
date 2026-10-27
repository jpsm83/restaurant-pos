import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Calendar as CalendarIcon,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatCalendarDate,
  getQuickRange,
  isValidCalendarDate,
  parseCalendarDate,
  resolveQuickRangeSelection,
} from "@/features/advancedTable/utils/dateFilter";
import { useFormatting } from "@/hooks/useFormatting";

// Types
export interface GenericSearchBarProps {
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
  defaultQuickRange?: "today" | "thisWeek" | "thisMonth";
  weekStartsOn?: number;
  searchLabel?: string;
  disableExport?: boolean;
  showExportButton?: boolean;
  onExport?: () => void | Promise<void>;
  onConfigClick?: () => void;
  showConfigButton?: boolean;
  children?: React.ReactNode; // Search fields specific to each table (type selector, custom inputs, etc.)
}

function DateRangeFilter({
  startDate,
  endDate,
  disabled,
  defaultQuickRange,
  weekStartsOn,
  onDateChange,
}: {
  startDate: string;
  endDate: string;
  disabled?: boolean;
  defaultQuickRange: NonNullable<GenericSearchBarProps["defaultQuickRange"]>;
  weekStartsOn?: number;
  onDateChange: (startDate: string, endDate: string) => void;
}) {
  const { t } = useTranslation("business");
  const { formatDate, dateFnsLocale } = useFormatting();
  const quickOptions = [
    {
      value: "today",
      label: t("advancedTable.dateFilter.quickOptions.today"),
    },
    {
      value: "thisWeek",
      label: t("advancedTable.dateFilter.quickOptions.thisWeek"),
    },
    {
      value: "thisMonth",
      label: t("advancedTable.dateFilter.quickOptions.thisMonth"),
    },
  ] as const;
  const quickOptionLabelMap = Object.fromEntries(
    quickOptions.map((option) => [option.value, option.label]),
  );

  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const parsedStart = startDate ? parseCalendarDate(startDate) : null;
  const parsedEnd = endDate ? parseCalendarDate(endDate) : null;

  const selectedQuickOption = (() => {
    if (!startDate || !endDate) return "";
    const resolved = resolveQuickRangeSelection(startDate, endDate, {
      weekStartsOn,
    });
    return quickOptions.some((option) => option.value === resolved)
      ? resolved
      : "";
  })();
  const activeQuickOption = selectedQuickOption || defaultQuickRange;

  const [localStartDate, setLocalStartDate] = useState<Date | undefined>(
    () => parsedStart ?? undefined,
  );
  const [localEndDate, setLocalEndDate] = useState<Date | undefined>(
    () => parsedEnd ?? undefined,
  );

  const syncDraftFromCurrent = () => {
    if (parsedStart && parsedEnd) {
      setLocalStartDate(parsedStart);
      setLocalEndDate(parsedEnd);
      return;
    }
    setLocalStartDate(undefined);
    setLocalEndDate(undefined);
  };

  const handleFilterPopoverOpenChange = (open: boolean) => {
    setFilterPopoverOpen(open);
    if (open) {
      syncDraftFromCurrent();
    }
  };

  const handleQuickSelect = (option: string) => {
    const [nextStart, nextEnd] = getQuickRange(option, new Date(), {
      weekStartsOn,
    });
    onDateChange(nextStart, nextEnd);
    setTimeout(() => setFilterPopoverOpen(false), 10);
  };

  const handleRefreshQuickDate = useCallback(() => {
    const [nextStart, nextEnd] = getQuickRange(activeQuickOption, new Date(), {
      weekStartsOn,
    });
    onDateChange(nextStart, nextEnd);
  }, [activeQuickOption, onDateChange, weekStartsOn]);

  const hasDateRangeChanged = (() => {
    if (!localStartDate || !localEndDate) return false;
    const nextStart = formatCalendarDate(localStartDate);
    const nextEnd = formatCalendarDate(localEndDate);
    return nextStart !== startDate || nextEnd !== endDate;
  })();

  const applyCustomRange = () => {
    if (!localStartDate || !localEndDate) return;
    const nextStart = formatCalendarDate(localStartDate);
    const nextEnd = formatCalendarDate(localEndDate);
    if (nextStart === startDate && nextEnd === endDate) {
      setFilterPopoverOpen(false);
      return;
    }
    onDateChange(nextStart, nextEnd);
    setFilterPopoverOpen(false);
  };

  return (
    <div className="relative flex flex-col items-end">
      <div className="flex gap-2">
        <Popover
          open={filterPopoverOpen}
          onOpenChange={handleFilterPopoverOpenChange}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className="flex items-center gap-2 disabled:cursor-not-allowed"
              title={t("advancedTable.dateFilter.filterByDate")}
              disabled={disabled}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 shadow-lg" align="start">
            <div className="flex min-w-75 flex-col gap-2">
              <Label className="mb-2 text-sm font-medium text-foreground">
                {t("advancedTable.dateFilter.quickDateRange")}
              </Label>
              <Select
                value={selectedQuickOption}
                onValueChange={handleQuickSelect}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t("advancedTable.dateFilter.selectQuickTimeRange")}
                  />
                </SelectTrigger>
                <SelectContent className="shadow-lg">
                  {quickOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="hover:bg-accent"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <hr className="my-4 border-border" />
              <Label className="mb-2 text-sm font-medium text-foreground">
                {t("advancedTable.dateFilter.customDateRange")}
              </Label>
              <div className="flex gap-4">
                <div className="flex flex-col gap-3">
                  <Label className="px-1">
                    {t("advancedTable.dateFilter.startDate")}
                  </Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-32 justify-between font-normal"
                        aria-label={t("advancedTable.dateFilter.startDate")}
                      >
                        {localStartDate
                          ? formatDate(localStartDate)
                          : t("advancedTable.dateFilter.selectDate")}
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto overflow-hidden p-0"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={localStartDate}
                        onSelect={(selected) => {
                          if (!selected) return;
                          setLocalStartDate(selected);
                          setStartDateOpen(false);
                        }}
                        className="rounded-md border shadow-md"
                        captionLayout="dropdown"
                        locale={dateFnsLocale}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col gap-3">
                  <Label className="px-1">
                    {t("advancedTable.dateFilter.endDate")}
                  </Label>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-32 justify-between font-normal"
                        aria-label={t("advancedTable.dateFilter.endDate")}
                      >
                        {localEndDate
                          ? formatDate(localEndDate)
                          : t("advancedTable.dateFilter.selectDate")}
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto overflow-hidden p-0"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={localEndDate}
                        onSelect={(selected) => {
                          if (!selected) return;
                          setLocalEndDate(selected);
                          setEndDateOpen(false);
                        }}
                        className="rounded-md border shadow-md"
                        captionLayout="dropdown"
                        locale={dateFnsLocale}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button
                onClick={applyCustomRange}
                variant="outline"
                className="w-full disabled:cursor-not-allowed"
                disabled={disabled || !localStartDate || !localEndDate}
              >
                <Search className="h-4 w-4 mr-2" />
                {hasDateRangeChanged
                  ? t("advancedTable.dateFilter.applyDateRange")
                  : t("advancedTable.dateFilter.noChanges")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Label className="h-9 w-full whitespace-nowrap rounded-md border border-border bg-muted px-4 py-1 text-xs font-bold text-foreground">
          {selectedQuickOption ? (
            <span className="text-muted-foreground">
              {quickOptionLabelMap[selectedQuickOption] ?? selectedQuickOption}
            </span>
          ) : (
            <>
              <span className="text-muted-foreground">
                {t("advancedTable.dateFilter.from")}
              </span>{" "}
              {formatDate(startDate)}{" "}
              <span className="text-muted-foreground">
                {t("advancedTable.dateFilter.until")}
              </span>{" "}
              {formatDate(endDate)}
            </>
          )}
        </Label>
        <Button
          onClick={handleRefreshQuickDate}
          variant="outline"
          className={cn(
            "w-9 disabled:cursor-not-allowed",
            selectedQuickOption ? "visible" : "hidden",
          )}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const GenericSearchBar: React.FC<GenericSearchBarProps> = ({
  startDate,
  endDate,
  onDateChange,
  defaultQuickRange = "today",
  weekStartsOn = 1,
  searchLabel,
  disableExport,
  showExportButton = true,
  onExport,
  onConfigClick,
  showConfigButton = false,
  children,
}) => {
  // APP shared presentation component.
  // Boundary rule: this component receives authorization/config-visibility decisions via props
  // and stays decoupled from CORE business/auth hooks.
  // Hooks
  const { t } = useTranslation("business");

  const [isExporting, setIsExporting] = useState(false);
  const isMountedRef = useRef(false);

  // Use translation if searchLabel is not provided
  const displaySearchLabel =
    searchLabel || t("advancedTable.searchBar.search");

  // Effects
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleDateChange = useCallback(
    (nextStartDate: string, nextEndDate: string) => {
      // Guard invalid date payloads before delegating URL updates to parent.
      if (
        !isValidCalendarDate(nextStartDate) ||
        !isValidCalendarDate(nextEndDate)
      ) {
        return;
      }
      onDateChange(nextStartDate, nextEndDate);
    },
    [onDateChange],
  );

  const handleExport = useCallback(async () => {
    if (!onExport || isExporting) return;

    if (isMountedRef.current) {
      setIsExporting(true);
    }

    try {
      await onExport();
      toast.success(
        t("advancedTable.searchBar.exportSuccess"),
        {
          duration: 3000,
          closeButton: false,
        },
      );
    } catch (error) {
      console.error("Export error:", error);
      toast.error(
        t("advancedTable.searchBar.exportError"),
        {
          duration: 3000,
          closeButton: false,
        },
      );
    } finally {
      if (isMountedRef.current) {
        setIsExporting(false);
      }
    }
  }, [onExport, isExporting, t]);

  return (
    <div className="flex justify-between items-center">
      {/* Left Section - Search Controls */}
      <div className="flex justify-center items-center gap-2 flex-wrap">
        <div className="relative flex justify-center items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="mr-2 text-sm font-semibold text-muted-foreground">
            {displaySearchLabel}
          </h3>

          {/* Custom search fields specific to this table */}
          {children}

          <DateRangeFilter
            onDateChange={handleDateChange}
            startDate={startDate}
            endDate={endDate}
            defaultQuickRange={defaultQuickRange}
            weekStartsOn={weekStartsOn}
          />
        </div>
      </div>

      {/* Right Section - Export and Config */}
      <div className="flex justify-end items-center gap-4">
        {showExportButton && (
          <Button
            variant="outline"
            size="default"
            className="flex items-center gap-2"
            onClick={handleExport}
            disabled={isExporting || disableExport}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin cursor-not-allowed" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting
              ? t("advancedTable.searchBar.exporting")
              : t("advancedTable.searchBar.exportAll")}
          </Button>
        )}
        {onConfigClick && showConfigButton && (
          <Button
            variant="outline"
            size="default"
            className="flex items-center gap-2"
            onClick={onConfigClick}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default GenericSearchBar;
