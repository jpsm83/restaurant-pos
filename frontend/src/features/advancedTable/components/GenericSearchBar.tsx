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

import { Button } from "ui/button";
import { Label } from "ui/label";
import { Calendar } from "ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "ui/popover";
import {
  formatCalendarDate,
  formatReadableDate,
  getQuickRange,
  isValidCalendarDate,
  parseCalendarDate,
  resolveQuickRangeSelection,
} from "@/features/advancedTable/utils/dateFilter";

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
  const quickOptions = [
    {
      value: "today",
      label: t("dateFilter.quickOptions.today", { defaultValue: "Today" }),
    },
    {
      value: "thisWeek",
      label: t("dateFilter.quickOptions.thisWeek", {
        defaultValue: "This week",
      }),
    },
    {
      value: "thisMonth",
      label: t("dateFilter.quickOptions.thisMonth", {
        defaultValue: "This month",
      }),
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
              title={t("dateFilter.filterByDate", {
                defaultValue: "Filter by date",
              })}
              disabled={disabled}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-4 bg-white border border-gray-200 shadow-lg"
            align="start"
          >
            <div className="flex flex-col gap-2 min-w-[300px]">
              <Label className="text-sm font-medium text-gray-900 mb-2">
                {t("dateFilter.quickDateRange", {
                  defaultValue: "Quick date range",
                })}
              </Label>
              <Select
                value={selectedQuickOption}
                onValueChange={handleQuickSelect}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t("dateFilter.selectQuickTimeRange", {
                      defaultValue: "Select quick time range",
                    })}
                  />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                  {quickOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="hover:bg-gray-200"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <hr className="my-4 border-gray-300" />
              <Label className="text-sm font-medium text-gray-900 mb-2">
                {t("dateFilter.customDateRange", {
                  defaultValue: "Custom date range",
                })}
              </Label>
              <div className="flex gap-4">
                <div className="flex flex-col gap-3">
                  <Label className="px-1">
                    {t("dateFilter.startDate", {
                      defaultValue: "Start date",
                    })}
                  </Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-32 justify-between font-normal"
                        aria-label={t("dateFilter.startDate", {
                          defaultValue: "Start date",
                        })}
                      >
                        {localStartDate
                          ? formatReadableDate(localStartDate)
                          : t("dateFilter.selectDate", {
                              defaultValue: "Select date",
                            })}
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto overflow-hidden p-0 bg-white"
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
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col gap-3">
                  <Label className="px-1">
                    {t("dateFilter.endDate", { defaultValue: "End date" })}
                  </Label>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-32 justify-between font-normal"
                        aria-label={t("dateFilter.endDate", {
                          defaultValue: "End date",
                        })}
                      >
                        {localEndDate
                          ? formatReadableDate(localEndDate)
                          : t("dateFilter.selectDate", {
                              defaultValue: "Select date",
                            })}
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto overflow-hidden p-0 bg-white"
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
                  ? t("dateFilter.applyDateRange", {
                      defaultValue: "Apply date range",
                    })
                  : t("dateFilter.noChanges", { defaultValue: "No changes" })}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Label className="w-full text-xs text-gray-700 font-bold bg-[#f1f4f8] px-4 py-1 border border-gray-400 rounded-md h-9 whitespace-nowrap">
          {selectedQuickOption ? (
            <span className="text-gray-600">
              {quickOptionLabelMap[selectedQuickOption] ?? selectedQuickOption}
            </span>
          ) : (
            <>
              <span className="text-gray-600">
                {t("dateFilter.from", { defaultValue: "From" })}
              </span>{" "}
              {formatReadableDate(startDate)}{" "}
              <span className="text-gray-600">
                {t("dateFilter.until", { defaultValue: "Until" })}
              </span>{" "}
              {formatReadableDate(endDate)}
            </>
          )}
        </Label>
        <Button
          onClick={handleRefreshQuickDate}
          variant="outline"
          className={`${selectedQuickOption ? "visible" : "hidden"} w-[36.6px] disabled:cursor-not-allowed`}
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
    searchLabel || t("searchBar.search", { defaultValue: "Search" });

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
        t("searchBar.exportSuccess", {
          defaultValue: "Export completed successfully.",
        }),
        {
          duration: 3000,
          closeButton: false,
        },
      );
    } catch (error) {
      console.error("Export error:", error);
      toast.error(
        t("searchBar.exportError", { defaultValue: "Failed to export data." }),
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
          <Search className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-600 mr-2">
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
              ? t("searchBar.exporting", { defaultValue: "Exporting..." })
              : t("searchBar.exportAll", { defaultValue: "Export all" })}
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
