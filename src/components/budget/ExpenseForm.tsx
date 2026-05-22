"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createExpense } from "@/app/trips/[tripId]/budget/actions";
import type { ExpenseCategory } from "@/types";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createExpenseSchema, type CreateExpenseInput } from "@/lib/validations";

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "flights", label: "Flights" },
  { value: "lodging", label: "Lodging" },
  { value: "food", label: "Food" },
  { value: "transport", label: "Transport" },
  { value: "activities", label: "Activities" },
  { value: "misc", label: "Misc" },
];

interface ExpenseFormProps {
  tripId: string;
  onSuccess?: () => void;
}

export function ExpenseForm({ tripId, onSuccess }: ExpenseFormProps) {
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<CreateExpenseInput, unknown, CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema) as any,
    defaultValues: { tripId, category: "misc" },
  });

  function onSubmit(data: CreateExpenseInput) {
    startTransition(async () => {
      await createExpense(data);
      reset({ tripId, category: "misc" });
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("tripId")} />

      <div className="space-y-2">
        <Label htmlFor="label">Description</Label>
        <Input id="label" {...register("label")} placeholder="Flight to Tokyo" className="rounded-xl" />
        {errors.label && <p className="text-xs text-red-500">{errors.label.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount ($)</Label>
        <Input id="amount" type="number" step="0.01" min="0" {...register("amount")} placeholder="0.00" className="rounded-xl font-mono" />
        {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-odyssey-teal hover:bg-odyssey-teal/90 text-white"
      >
        {isPending ? "Adding..." : "Add Expense"}
      </Button>
    </form>
  );
}
