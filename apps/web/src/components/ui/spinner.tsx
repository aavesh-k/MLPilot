import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {}

export function Spinner({ className, ...props }: SpinnerProps) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" {...props} />;
}
Spinner.displayName = "Spinner";
