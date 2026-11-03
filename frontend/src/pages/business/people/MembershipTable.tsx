/**
 * Venue membership list — name, email, roles, employment status, join date.
 */
import { useTranslation } from "react-i18next";

import { useFormatting } from "@/hooks/useFormatting";
import { calendarDatePart } from "@/lib/calendarDate";
import type { VenueMembership } from "@/services/employees/employeesService";
import {
  roleLabelKey,
  statusLabelKey,
} from "./peopleLabels";

export default function MembershipTable({ rows }: { rows: VenueMembership[] }) {
  const { t } = useTranslation("business");
  const { formatDate } = useFormatting();

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("people.list.name")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("people.list.email")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("people.list.roles")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("people.list.status")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("people.list.joinDate")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => {
            const joinDate = member.joinDate
              ? calendarDatePart(member.joinDate)
              : null;
            return (
              <tr key={member._id} className="border-t border-border align-top">
                <td className="px-3 py-2 font-medium text-foreground">
                  {member.displayName}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {member.email}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {member.allEmployeeRoles.length > 0
                    ? member.allEmployeeRoles
                        .map((role) =>
                          t(`people.roles.${roleLabelKey(role)}`),
                        )
                        .join(", ")
                    : t("people.notSet")}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {member.employmentStatus
                    ? t(`people.statuses.${statusLabelKey(member.employmentStatus)}`)
                    : t("people.notSet")}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {joinDate ? formatDate(joinDate) : t("people.notSet")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
