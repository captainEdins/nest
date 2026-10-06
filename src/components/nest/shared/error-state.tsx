"use client";

/** Error state — destructive Alert + retry (design-system §8: section/screen errors). */

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useI18n();
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle aria-hidden />
      <AlertTitle>{message ?? t("errors.couldNotLoad")}</AlertTitle>
      <AlertDescription className="flex items-center gap-2">
        {onRetry ? (
          <Button
            size="sm"
            variant="outline"
            className="border-destructive text-destructive bg-transparent dark:bg-transparent mt-1"
            onClick={onRetry}
          >
            {t("common.retry")}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
