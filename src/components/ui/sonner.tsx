import { BellRing, CircleCheck } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = (props: ToasterProps) => (
  <Sonner
    position="top-center"
    icons={{
      info: <BellRing className="size-4" aria-hidden="true" />,
      success: <CircleCheck className="size-4" aria-hidden="true" />,
    }}
    toastOptions={{
      classNames: {
        toast:
          "!rounded-lg !border-0 !bg-card !text-card-foreground !shadow-[0_14px_40px_rgba(0,0,0,0.16),0_0_0_1px_rgba(0,0,0,0.08)]",
        title: "!font-semibold",
        description: "!text-muted-foreground",
        actionButton:
          "!h-8 !rounded-md !bg-primary !px-3 !text-sm !font-medium !text-primary-foreground",
      },
    }}
    {...props}
  />
);

export { Toaster };
