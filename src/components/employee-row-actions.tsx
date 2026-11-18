"use client";

import { RowActionsMenu } from "@/components/ui/row-actions-menu";

type Props = {
  employeeName: string;
  onEdit: () => void;
  onDelete: () => void;
};

export function EmployeeRowActions({ employeeName, onEdit, onDelete }: Props) {
  return <RowActionsMenu itemName={employeeName} onEdit={onEdit} onDelete={onDelete} />;
}
