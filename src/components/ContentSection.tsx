import { ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type ContentSectionProps = {
  id: string;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  delay?: number;
  className?: string;
  children: ReactNode;
};

export function ContentSection({
  id,
  title,
  description,
  icon,
  actions,
  defaultOpen = false,
  delay = 0,
  className,
  children,
}: ContentSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className={cn("editorial-panel", className)}
      >
        <div className={cn("section-header", !open && "!mb-0")}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left transition-colors hover:bg-background/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:items-end"
              aria-expanded={open}
              aria-controls={`${id}-content`}
            >
              {icon}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="section-title">{title}</h2>
                  <ChevronDown
                    size={18}
                    className={cn(
                      "shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
                      open && "rotate-180",
                    )}
                  />
                </div>
                {description && <div className="section-copy">{description}</div>}
              </div>
            </button>
          </CollapsibleTrigger>
          {actions && (
            <div
              className="flex flex-wrap items-center justify-end gap-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          )}
        </div>
        <CollapsibleContent id={`${id}-content`} className="overflow-hidden">
          {children}
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
}
